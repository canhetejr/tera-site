/**
 * Tera Core — renderer.
 *
 * No engine, no CDN, no 600 KB of general-purpose 3D. Three instanced
 * programs — nodes, connections, surfaces — one shared quad, one draw call
 * each. The site argues that Tera builds systems; it would be strange to
 * import one.
 */

import { createContext, createProgram, createQuad, createStream, createVAO } from './gl.js';
import { hookedRoute, routePoint, HOOK } from './grammar.js';
import { clamp, lerp, project } from '../motion/math.js';
import { settle, pulse as pulseEase } from '../motion/easings.js';
import { STAGGER, AMBIENT } from '../motion/durations.js';

const NODE_STRIDE = 7;   // x y z | size alpha tone shape
const SEG_STRIDE = 9;    // ax ay az | bx by bz | alpha width tone
const PANEL_STRIDE = 9;  // cx cy cz | w h | alpha fill tone hook

const FOG_HEAD = /* glsl */ `
  uniform vec4 uFog; // nearIn, nearOut, farIn, farOut
  float fogAt(float d) {
    return smoothstep(uFog.x, uFog.y, d) * (1.0 - smoothstep(uFog.z, uFog.w, d));
  }
`;

const NODE_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aPos;
layout(location=2) in vec4 aData;
uniform mat4 uView, uProj;
uniform float uPixelWorld;
uniform vec2 uClampPx;
${FOG_HEAD}
out vec2 vCorner;
out float vAlpha;
flat out float vTone;
flat out float vShape;
void main() {
  vec4 vp = uView * vec4(aPos, 1.0);
  float d = max(0.001, -vp.z);
  float worldPerPx = uPixelWorld * d;
  float size = clamp(aData.x, uClampPx.x * worldPerPx, uClampPx.y * worldPerPx);
  vp.xy += aCorner * size * 2.0;
  gl_Position = uProj * vp;
  vCorner = aCorner;
  vAlpha = aData.y * fogAt(d);
  vTone = aData.z;
  vShape = aData.w;
}`;

const NODE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vCorner;
in float vAlpha;
flat in float vTone;
flat in float vShape;
uniform vec3 uFg, uAccent;
out vec4 outColor;
void main() {
  float mask;
  if (vShape < 0.5) {
    float d = length(vCorner);
    float aa = max(fwidth(d), 0.0015);
    mask = 1.0 - smoothstep(0.5 - aa, 0.5, d);
  } else if (vShape < 1.5) {
    vec2 q = abs(vCorner);
    float m = max(q.x, q.y);
    float aa = max(fwidth(m), 0.0015);
    mask = 1.0 - smoothstep(0.5 - aa, 0.5, m);
  } else {
    float d = length(vCorner);
    float aa = max(fwidth(d), 0.0015);
    mask = (1.0 - smoothstep(0.5 - aa, 0.5, d)) * smoothstep(0.30 - aa, 0.30 + aa, d);
  }
  float a = mask * vAlpha;
  if (a < 0.002) discard;
  vec3 c = mix(uFg, uAccent, vTone);
  outColor = vec4(c * a, a);
}`;

const SEG_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aA;
layout(location=2) in vec3 aB;
layout(location=3) in vec3 aParams; // alpha, widthPx, tone
uniform mat4 uViewProj, uView;
uniform vec2 uResolution;
${FOG_HEAD}
out float vAlpha;
out float vEdge;
flat out float vTone;
void main() {
  vec4 ca = uViewProj * vec4(aA, 1.0);
  vec4 cb = uViewProj * vec4(aB, 1.0);
  float t = aCorner.x + 0.5;
  // A segment with an endpoint behind the camera is collapsed rather than
  // wrapped around the screen.
  if (ca.w < 0.02 || cb.w < 0.02) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    vAlpha = 0.0; vEdge = 0.0; vTone = 0.0;
    return;
  }
  vec2 sa = (ca.xy / ca.w) * 0.5 * uResolution;
  vec2 sb = (cb.xy / cb.w) * 0.5 * uResolution;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 0.0001 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 sp = mix(sa, sb, t) + nrm * aCorner.y * 2.0 * max(aParams.y, 0.6);
  vec2 ndc = sp / (0.5 * uResolution);
  float w = mix(ca.w, cb.w, t);
  float z = mix(ca.z / ca.w, cb.z / cb.w, t);
  gl_Position = vec4(ndc * w, z * w, w);

  float dA = -(uView * vec4(aA, 1.0)).z;
  float dB = -(uView * vec4(aB, 1.0)).z;
  vAlpha = aParams.x * fogAt(mix(dA, dB, t));
  vEdge = aCorner.y * 2.0;
  vTone = aParams.z;
}`;

const SEG_FS = /* glsl */ `#version 300 es
precision highp float;
in float vAlpha;
in float vEdge;
flat in float vTone;
uniform vec3 uFg, uAccent;
out vec4 outColor;
void main() {
  float e = abs(vEdge);
  float aa = max(fwidth(e), 0.02);
  float mask = 1.0 - smoothstep(1.0 - aa, 1.0, e);
  float a = mask * vAlpha;
  if (a < 0.002) discard;
  vec3 c = mix(uFg, uAccent, vTone);
  outColor = vec4(c * a, a);
}`;

const PANEL_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aCenter;
layout(location=2) in vec2 aSize;
layout(location=3) in vec4 aParams; // alpha, fill, tone, hook
uniform mat4 uViewProj, uView;
${FOG_HEAD}
out vec2 vLocal;
out float vAlpha;
flat out vec2 vHalf;
flat out float vFill;
flat out float vTone;
flat out float vHook;
void main() {
  vec3 world = aCenter + vec3(aCorner * aSize, 0.0);
  gl_Position = uViewProj * vec4(world, 1.0);
  vLocal = aCorner * aSize;
  vHalf = aSize * 0.5;
  vAlpha = aParams.x * fogAt(-(uView * vec4(aCenter, 1.0)).z);
  vFill = aParams.y;
  vTone = aParams.z;
  vHook = aParams.w;
}`;

const PANEL_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
in float vAlpha;
flat in vec2 vHalf;
flat in float vFill;
flat in float vTone;
flat in float vHook;
uniform vec3 uFg, uAccent;
uniform float uBorderPx;
out vec4 outColor;
void main() {
  // One radius, bottom-right. Three square corners. The Tera hook.
  float r = min(vHook, min(vHalf.x, vHalf.y) * 0.9);
  float rr = (vLocal.x > 0.0 && vLocal.y < 0.0) ? r : 0.0;
  vec2 q = abs(vLocal) - vHalf + rr;
  float d = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rr;

  float aa = max(fwidth(d), 0.0001);
  float edge = aa * uBorderPx * 0.5;
  float line = 1.0 - smoothstep(edge, edge + aa, abs(d));
  float inside = 1.0 - smoothstep(-aa, 0.0, d);
  float a = clamp(line + inside * vFill, 0.0, 1.0) * vAlpha;
  if (a < 0.002) discard;
  vec3 c = mix(uFg, uAccent, vTone);
  outColor = vec4(c * a, a);
}`;

export class TeraCore {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./quality.js').TIERS.high} tier
   */
  constructor(canvas, tier) {
    this.canvas = canvas;
    this.tier = tier;
    this.gl = createContext(canvas);
    this.ok = !!this.gl;
    if (!this.ok) return;

    const gl = this.gl;
    this.quad = createQuad(gl);

    this.maxNodes = tier.nodes + 48; // headroom for travelling events
    this.maxSegments = tier.segments;
    this.maxPanels = tier.panels;

    this.nodeData = new Float32Array(this.maxNodes * NODE_STRIDE);
    this.segData = new Float32Array(this.maxSegments * SEG_STRIDE);
    this.panelData = new Float32Array(this.maxPanels * PANEL_STRIDE);

    this.nodeBuf = createStream(gl, this.nodeData.byteLength);
    this.segBuf = createStream(gl, this.segData.byteLength);
    this.panelBuf = createStream(gl, this.panelData.byteLength);

    this.nodeProg = createProgram(gl, NODE_VS, NODE_FS, 'node');
    this.segProg = createProgram(gl, SEG_VS, SEG_FS, 'segment');
    this.panelProg = createProgram(gl, PANEL_VS, PANEL_FS, 'panel');

    const F = Float32Array.BYTES_PER_ELEMENT;
    this.nodeVAO = createVAO(gl, [
      { buffer: this.quad, stride: 2 * F, divisor: 0, attributes: [{ loc: 0, size: 2, offset: 0 }] },
      { buffer: this.nodeBuf, stride: NODE_STRIDE * F, divisor: 1, attributes: [
        { loc: 1, size: 3, offset: 0 },
        { loc: 2, size: 4, offset: 3 * F },
      ] },
    ]);
    this.segVAO = createVAO(gl, [
      { buffer: this.quad, stride: 2 * F, divisor: 0, attributes: [{ loc: 0, size: 2, offset: 0 }] },
      { buffer: this.segBuf, stride: SEG_STRIDE * F, divisor: 1, attributes: [
        { loc: 1, size: 3, offset: 0 },
        { loc: 2, size: 3, offset: 3 * F },
        { loc: 3, size: 3, offset: 6 * F },
      ] },
    ]);
    this.panelVAO = createVAO(gl, [
      { buffer: this.quad, stride: 2 * F, divisor: 0, attributes: [{ loc: 0, size: 2, offset: 0 }] },
      { buffer: this.panelBuf, stride: PANEL_STRIDE * F, divisor: 1, attributes: [
        { loc: 1, size: 3, offset: 0 },
        { loc: 2, size: 2, offset: 3 * F },
        { loc: 3, size: 4, offset: 5 * F },
      ] },
    ]);

    this.palette = { fg: [1, 1, 1], accent: [0.84, 0.97, 0.36] };
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.quality = 1;

    this._route = new Float32Array(3 * 12);
    this._pt = { x: 0, y: 0, z: 0 };
    this._proj = { x: 0, y: 0, w: 0 };
    this.counts = { nodes: 0, segments: 0, panels: 0 };
  }

  /** Per-node arrival offset, so a morph lands like material, not like a fade. */
  prepare(layouts) {
    this.layouts = layouts;
    const n = this.tier.nodes;
    this.stagger = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Deterministic, but spatially incoherent enough that no wave is visible.
      this.stagger[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    }
    return this;
  }

  resize(cssWidth, cssHeight, dpr) {
    if (!this.ok) return;
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.gl.viewport(0, 0, w, h);
  }

  setPalette(fg, accent) {
    this.palette.fg = fg;
    this.palette.accent = accent;
  }

  /**
   * @param {object} state
   * @param {string} state.from layout key
   * @param {string} state.to layout key
   * @param {number} state.t 0..1 morph
   * @param {import('../motion/camera.js').Camera} state.camera
   * @param {number} state.time seconds
   * @param {number} state.accent 0..1 brand energy
   * @param {number} state.focus -1, or 0..4 for the capability being expressed
   * @param {number} state.event 0..1 one-shot pulse travelling the system
   */
  render(state) {
    if (!this.ok) return;
    const gl = this.gl;
    const { camera, time } = state;
    const A = this.layouts[state.from];
    const B = this.layouts[state.to];
    const t = clamp(state.t);

    const camDist = Math.hypot(
      camera.eye[0] - camera.look[0],
      camera.eye[1] - camera.look[1],
      camera.eye[2] - camera.look[2]
    );
    const fog = [0.35, 3.2, camDist * 1.25, camDist * 2.9];
    const pixelWorld = (2 * Math.tan(camera.fov / 2)) / this.height;

    const nodes = this._writeNodes(A, B, t, time, state);
    const segments = this._writeSegments(A, B, t, time, state);
    const panels = this._writePanels(A, B, t, state);
    this.counts = { nodes, segments, panels };

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const { fg, accent } = this.palette;

    // Surfaces first: they sit behind their own content.
    if (panels) {
      gl.useProgram(this.panelProg.program);
      const u = this.panelProg.uniforms;
      gl.uniformMatrix4fv(u.uViewProj, false, camera.viewProj);
      gl.uniformMatrix4fv(u.uView, false, camera.view);
      gl.uniform4fv(u.uFog, fog);
      gl.uniform3fv(u.uFg, fg);
      gl.uniform3fv(u.uAccent, accent);
      gl.uniform1f(u.uBorderPx, 1.15 * this.dpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.panelBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.panelData, 0, panels * PANEL_STRIDE);
      gl.bindVertexArray(this.panelVAO);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, panels);
    }

    if (segments) {
      gl.useProgram(this.segProg.program);
      const u = this.segProg.uniforms;
      gl.uniformMatrix4fv(u.uViewProj, false, camera.viewProj);
      gl.uniformMatrix4fv(u.uView, false, camera.view);
      gl.uniform2f(u.uResolution, this.width, this.height);
      gl.uniform4fv(u.uFog, fog);
      gl.uniform3fv(u.uFg, fg);
      gl.uniform3fv(u.uAccent, accent);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.segBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.segData, 0, segments * SEG_STRIDE);
      gl.bindVertexArray(this.segVAO);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, segments);
    }

    if (nodes) {
      gl.useProgram(this.nodeProg.program);
      const u = this.nodeProg.uniforms;
      gl.uniformMatrix4fv(u.uView, false, camera.view);
      gl.uniformMatrix4fv(u.uProj, false, camera.proj);
      gl.uniform1f(u.uPixelWorld, pixelWorld);
      gl.uniform2f(u.uClampPx, 0.85 * this.dpr, 9 * this.dpr);
      gl.uniform4fv(u.uFog, fog);
      gl.uniform3fv(u.uFg, fg);
      gl.uniform3fv(u.uAccent, accent);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.nodeData, 0, nodes * NODE_STRIDE);
      gl.bindVertexArray(this.nodeVAO);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nodes);
    }

    gl.bindVertexArray(null);
  }

  _writeNodes(A, B, t, time, state) {
    const out = this.nodeData;
    const n = Math.min(this.tier.nodes, A.n, B.n, Math.round(this.tier.nodes * this.quality));
    const spread = STAGGER.spread;
    const amp = AMBIENT.amplitude * this.tier.ambient;
    const speed = AMBIENT.speed;
    const detailStart = Math.round(n * 0.82);
    const accent = state.accent ?? 0;
    let w = 0;

    for (let i = 0; i < n; i++) {
      const s = this.stagger[i];
      const local = clamp((t - s * spread) / (1 - spread));
      const k = settle(local);

      const ai = i * 3;
      let sizeA = A.meta[ai];
      let sizeB = B.meta[ai];
      // A node absent from one side appears in place instead of flying in
      // from the origin.
      const ax = sizeA < 0.002 ? B.pos[ai] : A.pos[ai];
      const ay = sizeA < 0.002 ? B.pos[ai + 1] : A.pos[ai + 1];
      const az = sizeA < 0.002 ? B.pos[ai + 2] : A.pos[ai + 2];
      const bx = sizeB < 0.002 ? A.pos[ai] : B.pos[ai];
      const by = sizeB < 0.002 ? A.pos[ai + 1] : B.pos[ai + 1];
      const bz = sizeB < 0.002 ? A.pos[ai + 2] : B.pos[ai + 2];

      let x = ax + (bx - ax) * k;
      let y = ay + (by - ay) * k;
      let z = az + (bz - az) * k;

      // Nothing in this system is ever completely still.
      if (i >= detailStart) {
        const p = i * 0.7;
        x += Math.sin(time * speed + p) * amp * 9;
        y += Math.cos(time * speed * 0.83 + p * 1.4) * amp * 6;
        z += Math.sin(time * speed * 0.61 + p * 0.7) * amp * 7;
      } else {
        const p = i * 1.31;
        x += Math.sin(time * speed * 0.5 + p) * amp;
        y += Math.cos(time * speed * 0.44 + p) * amp;
      }

      const size = lerp(sizeA, sizeB, k);
      let tone = lerp(A.meta[ai + 1], B.meta[ai + 1], k) * (0.35 + accent * 0.9);

      // The capability being expressed lights up its own share of the system.
      if (state.focus >= 0 && i % 5 === state.focus) tone = Math.min(1, tone + 0.55 * state.focusAmount);

      out[w] = x;
      out[w + 1] = y;
      out[w + 2] = z;
      out[w + 3] = size;
      // Ambient material stays in the background where it belongs: present,
      // never competing with the structure that carries the meaning.
      out[w + 4] = size > 0.002 ? (i >= detailStart ? 0.4 : 1) : 0;
      out[w + 5] = tone;
      out[w + 6] = k < 0.5 ? A.meta[ai + 2] : B.meta[ai + 2];
      w += NODE_STRIDE;
    }

    // Events in transit. Same dots, moving along real routes.
    let count = n;
    const live = this._liveRoutes;
    if (live && live.length && state.event > 0.001) {
      const budget = Math.min(live.length, 24);
      for (let i = 0; i < budget && count < this.maxNodes; i++) {
        const r = live[i];
        const phase = (time * 0.42 + i * 0.37) % 1;
        routePoint(r.points, r.count, phase, this._pt);
        const fade = pulseEase(phase) * state.event;
        if (fade < 0.02) continue;
        out[w] = this._pt.x;
        out[w + 1] = this._pt.y;
        out[w + 2] = this._pt.z;
        out[w + 3] = 0.075;
        out[w + 4] = fade;
        out[w + 5] = 0.55 + 0.45 * accent;
        out[w + 6] = 0;
        w += NODE_STRIDE;
        count++;
      }
    }
    return count;
  }

  _writeSegments(A, B, t, time, state) {
    const out = this.segData;
    const nodes = this.nodeData;
    const max = Math.round(this.maxSegments * this.quality);
    const accent = state.accent ?? 0;
    let w = 0;
    let count = 0;
    const live = [];

    const emit = (set, weight, isB) => {
      if (weight <= 0.004) return;
      for (let i = 0; i < set.length && count < max; i++) {
        const l = set[i];
        const a = l.a * NODE_STRIDE;
        const b = l.b * NODE_STRIDE;
        if (a >= nodes.length || b >= nodes.length) continue;
        const ax = nodes[a], ay = nodes[a + 1], az = nodes[a + 2];
        const bx = nodes[b], by = nodes[b + 1], bz = nodes[b + 2];

        let pts;
        let n;
        if (l.style === 1) {
          this._route[0] = ax; this._route[1] = ay; this._route[2] = az;
          this._route[3] = bx; this._route[4] = by; this._route[5] = bz;
          pts = this._route;
          n = 2;
        } else {
          n = hookedRoute(this._route, ax, ay, az, bx, by, bz, HOOK);
          pts = this._route;
        }

        const energy = l.energy ?? 0;
        let tone = energy * accent * 1.4;
        if (state.focus >= 0 && i % 5 === state.focus) tone = Math.min(1, tone + 0.7 * state.focusAmount);
        const alpha = weight * (0.16 + energy * 0.5);
        const width = (0.55 + energy * 0.5) * this.dpr;

        for (let k = 0; k < n - 1 && count < max; k++) {
          out[w] = pts[k * 3];
          out[w + 1] = pts[k * 3 + 1];
          out[w + 2] = pts[k * 3 + 2];
          out[w + 3] = pts[(k + 1) * 3];
          out[w + 4] = pts[(k + 1) * 3 + 1];
          out[w + 5] = pts[(k + 1) * 3 + 2];
          out[w + 6] = alpha;
          out[w + 7] = width;
          out[w + 8] = tone;
          w += SEG_STRIDE;
          count++;
        }

        if (isB && l.live && live.length < 24) {
          live.push({ points: pts.slice(0, n * 3), count: n });
        }
      }
    };

    emit(A.links, 1 - t, false);
    emit(B.links, t, true);
    this._liveRoutes = live;
    return count;
  }

  _writePanels(A, B, t, state) {
    const out = this.panelData;
    const merged = this._mergedPanels(A, B);
    let w = 0;
    let count = 0;
    for (const m of merged) {
      if (count >= this.maxPanels) break;
      const a = m.a;
      const b = m.b;
      const alpha = lerp(a ? a.alpha : 0, b ? b.alpha : 0, t);
      if (alpha < 0.004) continue;
      const src = a || b;
      const dst = b || a;
      out[w] = lerp(src.x, dst.x, t);
      out[w + 1] = lerp(src.y, dst.y, t);
      out[w + 2] = lerp(src.z, dst.z, t);
      out[w + 3] = lerp(src.w, dst.w, t);
      out[w + 4] = lerp(src.h, dst.h, t);
      out[w + 5] = alpha * (state.panelAlpha ?? 1);
      out[w + 6] = lerp(src.fill, dst.fill, t);
      out[w + 7] = lerp(src.tone, dst.tone, t) * (0.4 + (state.accent ?? 0));
      out[w + 8] = HOOK * 0.55;
      w += PANEL_STRIDE;
      count++;
    }
    return count;
  }

  /** Panels sharing an id transform; the rest cross-fade. Cached per pair. */
  _mergedPanels(A, B) {
    this._panelCache ||= new Map();
    const key = `${A.key}>${B.key}`;
    let merged = this._panelCache.get(key);
    if (merged) return merged;
    const map = new Map();
    for (const p of A.panels) map.set(p.id, { a: p, b: null });
    for (const p of B.panels) {
      const e = map.get(p.id);
      if (e) e.b = p;
      else map.set(p.id, { a: null, b: p });
    }
    merged = [...map.values()];
    this._panelCache.set(key, merged);
    return merged;
  }

  /** World point → CSS pixels, so the DOM can attach itself to the scene. */
  project(camera, x, y, z, cssWidth, cssHeight) {
    return project(this._proj, camera.viewProj, x, y, z, cssWidth, cssHeight);
  }

  dispose() {
    if (!this.ok) return;
    const gl = this.gl;
    for (const b of [this.quad, this.nodeBuf, this.segBuf, this.panelBuf]) gl.deleteBuffer(b);
    for (const v of [this.nodeVAO, this.segVAO, this.panelVAO]) gl.deleteVertexArray(v);
    for (const p of [this.nodeProg, this.segProg, this.panelProg]) gl.deleteProgram(p.program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.ok = false;
  }
}
