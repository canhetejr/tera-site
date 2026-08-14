/**
 * Tera — the experience.
 *
 * One scroll position drives one camera, one structure, one palette and every
 * piece of DOM state on the page. There is no second animation system running
 * alongside this one, and no per-section observer arguing with it.
 *
 * WebGL is an enhancement. If it never starts, the page below is still the
 * whole story.
 */

import { Timeline } from './motion/timeline.js';
import { Camera } from './motion/camera.js';
import { SCENES, paletteAt, rgbCss } from './motion/scenes.js';
import { clamp, lerp, damp, smoothstep } from './motion/math.js';
import { settle, drift, pulse } from './motion/easings.js';
import { LAMBDA } from './motion/durations.js';
import { detectTier, Governor, TIERS } from './core/quality.js';
import { buildLayouts, LAB_SITES, UI } from './core/layouts.js';
import { TeraCore } from './core/renderer.js';
import { hookedPath } from './core/grammar.js';
import { createBindings } from './motion/transitions.js';

const ORDER = SCENES.map((s) => s.id);

/**
 * Points in the scene that the DOM is allowed to hold on to.
 * A label anchored here is not "positioned near the 3D thing" — it is at it.
 */
const ANCHORS = {
  'ui-series': { ui: [7.6, -0.55, 0.2], wire: [7.6, -0.9, 0.1] },
  'ui-list': { ui: [2.6, 1.2, 0.2] },
  'ui-nav': { ui: [-7.7, 2.08, 0.16], wire: [-7.7, 2.08, 0.1] },
  // Only under `lab`: naming a product is the lab scene's job. Once the
  // systems scene starts routing between them the names step aside.
  'lab-vertice': { lab: LAB_SITES[0].pos },
  'lab-epub': { lab: LAB_SITES[1].pos },
  'lab-context': { lab: LAB_SITES[2].pos },
  'lab-journey': { lab: LAB_SITES[3].pos },
};

export class Experience {
  constructor() {
    this.root = document.documentElement;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Reduced motion means no autonomous movement at all: the structure still
    // responds to scrolling, but nothing drifts on its own.
    this.tier = this.reduced ? { ...TIERS.low, ambient: 0, parallax: 0 } : detectTier();
    this.debug = /(\?|&)debug\b/.test(location.search);

    this.time = 0;
    this.last = performance.now();
    this.raf = 0;
    this.visible = true;
    this.light = SCENES[0].light.from;
    this.accent = 0;
    this.event = 0;
    this.eggUntil = -1;
    this._lightWritten = -1;
    this._disposed = false;

    this.timeline = new Timeline(ORDER, { reduced: this.reduced });
    this.camera = new Camera({ reduced: this.reduced });
    this.camera.travel = this.tier.travel;
    this.camera.distance = this.tier.distance;
    this.camera.parallax = this.tier.parallax;

    this._frame = this._frame.bind(this);
    this._onPointer = this._onPointer.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onKey = this._onKey.bind(this);
    this._keys = '';
  }

  mount() {
    this.timeline.mount();
    // Each scene owns one block of copy inside its act's pinned stage.
    this.stages = [...document.querySelectorAll('[data-scene-copy]')].map((el) => ({
      el,
      id: el.dataset.sceneCopy,
      base: ORDER.indexOf(el.dataset.sceneCopy),
      first: el.hasAttribute('data-first'),
      last: -1,
    })).filter((s) => s.base >= 0);
    this.anchorEls = [...document.querySelectorAll('[data-anchor]')];
    this.connectors = this._buildConnectors();

    this.bindings = createBindings();
    this.root.dataset.scene = ORDER[0];
    this.timeline.onScene((id) => { this.root.dataset.scene = id; });

    this._startCore();

    addEventListener('pointermove', this._onPointer, { passive: true });
    addEventListener('visibilitychange', this._onVisibility);
    addEventListener('resize', this._onResize, { passive: true });
    addEventListener('keydown', this._onKey);
    if (this.debug) this._mountDebug();

    this.root.classList.add('experience-ready');
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._frame);
    return this;
  }

  _startCore() {
    const canvas = document.getElementById('tera-core');
    if (!canvas) return;
    // A device that cannot spare the frames gets the same story in the DOM.
    try {
      this.core = new TeraCore(canvas, this.tier);
    } catch (err) {
      console.warn('[tera] core unavailable:', err.message);
      this.core = null;
    }
    this.canvas = canvas;
    if (!this.core?.ok) {
      this.root.classList.add('no-core');
      this.core = null;
      return;
    }
    this.layouts = buildLayouts(this.tier.nodes);
    for (const [key, layout] of Object.entries(this.layouts)) layout.key = key;
    this.core.prepare(this.layouts);
    this.governor = new Governor((level) => {
      this.core.quality = level;
      this.dpr = Math.max(1, this.dpr * 0.85);
      this._resizeCore();
    });
    this.dpr = Math.min(devicePixelRatio || 1, this.tier.dpr);
    this._resizeCore();
    this.root.classList.add('has-core');
  }

  _resizeCore() {
    if (!this.core) return;
    this.core.resize(innerWidth, innerHeight, this.dpr);
  }

  _onResize() {
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      this.dpr = Math.min(devicePixelRatio || 1, this.tier.dpr);
      this._resizeCore();
      for (const c of this.connectors) c.dirty = true;
    }, 120);
  }

  _onPointer(e) {
    this.camera.setPointer(
      (e.clientX / innerWidth) * 2 - 1,
      (e.clientY / innerHeight) * 2 - 1
    );
  }

  _onVisibility() {
    this.visible = !document.hidden;
    if (this.visible && !this.raf && !this._disposed) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this._frame);
    } else if (!this.visible && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  /** One hidden thing, for the people who would look. */
  _onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key.length !== 1) return;
    this._keys = (this._keys + e.key.toLowerCase()).slice(-5);
    if (this._keys === 'build') {
      this.eggUntil = this.time + 3.2;
      this.root.dataset.egg = 'on';
      setTimeout(() => delete this.root.dataset.egg, 3400);
    }
  }

  _frame(now) {
    if (this._disposed) return;
    const dtMs = Math.min(64, now - this.last);
    this.last = now;
    const dt = dtMs / 1000;
    this.time += dt;
    this.governor?.sample(dtMs);

    const tl = this.timeline.update(dt);
    const i = Math.min(tl.index, SCENES.length - 1);
    const scene = SCENES[i];
    const local = tl.local;

    /* ------------------------------------------------ environment + palette */
    // The environment is a direct function of the timeline. The cursor is
    // already smoothed, so damping this again only makes the page arrive at
    // the right colour after the scene that needed it has passed.
    const egg = this.eggUntil > this.time ? pulse((this.eggUntil - this.time) / 3.2) : 0;
    this.light = lerp(scene.light.from, scene.light.to, scene.light.ease(local));
    this.accent = clamp(
      lerp(scene.accent.from, scene.accent.to, scene.accent.ease(local)) + egg * 0.6
    );
    this._writeEnvironment();

    /* ------------------------------------------------------------- camera */
    this.camera.update(tl, dt, this.core?.width || innerWidth, this.core?.height || innerHeight);

    /* -------------------------------------------------------- scene state */
    this._writeSceneProgress(tl);
    this.bindings.update(tl);

    /* --------------------------------------------------------------- core */
    if (this.core) {
      const focusState = this._focusState(tl);
      this.event = clamp(
        tl.weightOf('systems', 0.35) + tl.weightOf('capabilities', 0.35) * 0.8 + egg
      );

      const pal = paletteAt(this.light);
      this.core.setPalette(pal.fg, pal.accent);
      // Through an editorial passage the structure is still there, just no
      // longer the thing being looked at.
      const presence = tl.stagePresence;
      const recede = 0.22 + 0.78 * presence;
      if (Math.abs(presence - (this._presenceWritten ?? -1)) > 0.01) {
        this._presenceWritten = presence;
        this.canvas.style.opacity = (0.05 + 0.95 * presence).toFixed(3);
      }
      // With reduced motion there is nothing to redraw unless the reader has
      // actually moved, so the loop idles instead of animating.
      const still =
        this.reduced &&
        Math.abs(tl.cursor - (this._lastCursor ?? -1)) < 0.0004 &&
        Math.abs(presence - (this._lastPresence ?? -1)) < 0.004;
      this._lastCursor = tl.cursor;
      this._lastPresence = presence;
      if (!still) this.core.render({
        from: scene.layout[0],
        to: scene.layout[1],
        t: local,
        camera: this.camera,
        time: this.time,
        accent: this.accent,
        event: this.event,
        focus: focusState.index,
        focusAmount: focusState.amount,
        panelAlpha: recede,
      });
      this._writeAnchors(scene, local, presence);
      this._drawConnectors();
    }

    if (this.debug) this._writeDebug(tl);
    this.raf = this.visible ? requestAnimationFrame(this._frame) : 0;
  }

  /** Which capability the system is currently expressing. */
  _focusState(tl) {
    const w = tl.weightOf('capabilities', 0.1);
    if (w <= 0.01) return { index: -1, amount: 0 };
    const p = tl.progressOf('capabilities');
    const count = 5;
    const scaled = clamp(p, 0.001, 0.999) * count;
    const index = Math.floor(scaled);
    const inner = scaled - index;
    // Full strength in the middle of each band, handing over at the edges.
    const amount = Math.min(1, Math.sin(inner * Math.PI) * 1.6) * w;
    const el = this.root;
    if (el.dataset.capability !== String(index)) el.dataset.capability = String(index);
    return { index, amount };
  }

  /** Test hook: drive the environment directly, bypassing the timeline. */
  setLight(value) {
    this.light = clamp(value);
    this._lightWritten = -1;
    this._writeEnvironment();
  }

  _writeEnvironment() {
    const q = Math.round(this.light * 200) / 200;
    if (q === this._lightWritten) return;
    this._lightWritten = q;
    const pal = paletteAt(q);
    const s = this.root.style;
    s.setProperty('--bg', rgbCss(pal.bg));
    s.setProperty('--fg', rgbCss(pal.fg));
    s.setProperty('--dim', rgbCss(pal.dim));
    s.setProperty('--accent', rgbCss(pal.accent));
    // Brand colour used as type has to survive the trip to paper.
    const k = clamp((q - 0.47) / 0.06);
    s.setProperty('--accent-text', rgbCss([
      lerp(0.843, 0.247, k),
      lerp(0.969, 0.353, k),
      lerp(0.357, 0.0, k),
    ]));
    s.setProperty('--light', String(q));
    this.themeMeta ||= document.querySelector('meta[name="theme-color"]');
    if (this.themeMeta) this.themeMeta.setAttribute('content', rgbCss(pal.bg));
  }

  _writeSceneProgress(tl) {
    for (const stage of this.stages) {
      const d = tl.cursor - stage.base;
      // Copies share one grid cell, so a scene that is not current has to be
      // pushed past the ends of its own visibility curve — not just left
      // unset, which is the state that means "no script running".
      const p = Math.round(clamp(d, -0.25, 1.25) * 500) / 500;
      if (p !== stage.last) {
        stage.el.style.setProperty('--p', String(p));
        // Copy that is fading out must not keep catching clicks meant for the
        // copy fading in — they share the same grid cell. The same applies to
        // the keyboard: tabbing must never land on an invisible CTA. The text
        // itself stays in the accessibility tree, so nothing is hidden from a
        // screen reader — only the focus order is corrected.
        const live = String((stage.first || p > 0.06) && p < 0.94);
        if (stage.el.dataset.live !== live) {
          stage.el.dataset.live = live;
          const on = live === 'true';
          stage.focusables ||= [...stage.el.querySelectorAll('a[href], button, [tabindex]')];
          for (const el of stage.focusables) {
            if (on) el.removeAttribute('tabindex');
            else el.setAttribute('tabindex', '-1');
          }
        }
        stage.last = p;
      }
    }
  }

  /** DOM elements that live at a point in the 3D scene. */
  _writeAnchors(scene, t, stage = 1) {
    const [from, to] = scene.layout;
    // A caption belongs to the scene that is actually on stage. During the
    // editorial passages between scenes the cursor rests on a boundary, so
    // local progress is 0 there and the captions step off.
    const onStage = smoothstep(t / 0.12);
    for (const el of this.anchorEls) {
      const map = ANCHORS[el.dataset.anchor];
      if (!map) continue;
      const a = map[from];
      const b = map[to];
      if (!a && !b) {
        if (el.dataset.on !== '0') {
          el.dataset.on = '0';
          el.style.opacity = '0';
        }
        continue;
      }
      const src = a || b;
      const dst = b || a;
      const k = settle(t);
      const x = lerp(src[0], dst[0], k);
      const y = lerp(src[1], dst[1], k);
      const z = lerp(src[2], dst[2], k);
      const p = this.core.project(this.camera, x, y, z, innerWidth, innerHeight);
      if (p.w <= 0) {
        el.style.opacity = '0';
        el.dataset.on = '0';
        continue;
      }
      // A caption that belongs to the outgoing layout leaves early, and one
      // that belongs to the incoming layout waits until there is something to
      // point at. Otherwise both are on screen through the whole handover.
      const presence =
        (a && b ? 1 : a ? 1 - drift(clamp(t / 0.42)) : drift(clamp((t - 0.28) / 0.5))) *
        onStage * smoothstep(clamp((stage - 0.45) / 0.35));
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      el.style.opacity = presence.toFixed(3);
      el.dataset.on = presence > 0.05 ? '1' : '0';
      el.__ax = p.x;
      el.__ay = p.y;
    }
  }

  /* --------------------------------------------------------- DOM connectors
   * A line that starts on a structure in the scene and finishes on a real
   * HTML element. Same grammar, two rendering technologies, one system.
   */
  _buildConnectors() {
    const svg = document.getElementById('tera-connectors');
    if (!svg) return [];
    return [...svg.querySelectorAll('[data-from]')].map((path) => ({
      path,
      fromId: path.dataset.from,
      toSel: path.dataset.to,
      dirty: true,
    }));
  }

  _drawConnectors() {
    if (!this.connectors.length) return;
    for (const c of this.connectors) {
      const source = document.querySelector(`[data-anchor="${c.fromId}"]`);
      const target = document.querySelector(c.toSel);
      if (!source || !target || source.dataset.on !== '1') {
        if (c.path.getAttribute('d')) c.path.removeAttribute('d');
        continue;
      }
      const r = target.getBoundingClientRect();
      const ax = source.__ax ?? 0;
      const ay = source.__ay ?? 0;
      const tx = ax < r.left ? r.left : r.right;
      const ty = r.top + r.height / 2;
      // Off screen, zero-size, or so far away that the line would just be a
      // stripe across the page: draw nothing.
      const reach = Math.hypot(tx - ax, ty - ay);
      const visible =
        r.width > 0 && r.bottom > 0 && r.top < innerHeight &&
        ax > -80 && ax < innerWidth + 80 && reach < innerWidth * 0.62;
      if (!visible) {
        if (c.path.getAttribute('d')) c.path.removeAttribute('d');
        continue;
      }
      c.path.setAttribute('d', hookedPath(ax, ay, tx, ty));
      c.path.style.opacity = String(
        Number(source.style.opacity || 0) * (1 - reach / (innerWidth * 0.62)) * 0.9
      );
    }
  }

  /* -------------------------------------------------------------- dev only */
  _mountDebug() {
    const el = document.createElement('div');
    el.id = 'tera-debug';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    this.debugEl = el;
  }

  _writeDebug(tl) {
    if (!this.debugEl || this.time - (this._debugAt || 0) < 0.25) return;
    this._debugAt = this.time;
    const c = this.camera.eye;
    const counts = this.core?.counts || { nodes: 0, segments: 0, panels: 0 };
    this.debugEl.textContent = [
      `fps ${this.governor?.fps ?? '--'}`,
      `tier ${this.tier.name} q${(this.core?.quality ?? 1).toFixed(2)}`,
      `dpr ${(this.dpr || 1).toFixed(2)}`,
      `scene ${tl.id} ${tl.local.toFixed(3)}`,
      `cursor ${tl.cursor.toFixed(3)} / ${ORDER.length}`,
      `light ${this.light.toFixed(3)} accent ${this.accent.toFixed(3)}`,
      `cam ${c[0].toFixed(1)} ${c[1].toFixed(1)} ${c[2].toFixed(1)}`,
      `obj n${counts.nodes} s${counts.segments} p${counts.panels}`,
    ].join('\n');
  }

  dispose() {
    this._disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    removeEventListener('pointermove', this._onPointer);
    removeEventListener('visibilitychange', this._onVisibility);
    removeEventListener('resize', this._onResize);
    removeEventListener('keydown', this._onKey);
    clearTimeout(this._resizeTimer);
    this.timeline.destroy();
    this.core?.dispose();
    this.debugEl?.remove();
  }
}

export function start() {
  const experience = new Experience();
  experience.mount();
  // Give the console something honest to say.
  if (experience.debug) {
    window.tera = experience;
    window.__setLight = (v) => experience.setLight(v);
  }
  return experience;
}
