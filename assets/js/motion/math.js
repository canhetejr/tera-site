/**
 * Tera — shared math.
 * Used by both the DOM layer and the WebGL layer so the two worlds
 * always agree on where things are.
 */

export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Maps v from [a,b] into [0,1], clamped. */
export const range = (v, a, b) => clamp((v - a) / (b - a || 1));

export const smoothstep = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export const smootherstep = (t) => {
  const x = clamp(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/**
 * Frame-rate independent approach. `lambda` is "how fast", dt in seconds.
 * Prefer this over `a += (b - a) * 0.1` which changes speed with the refresh rate.
 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Deterministic PRNG so every layout is identical on every device and reload. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- matrices */
/* Column-major, WebGL convention. Allocation-free: always write into `out`. */

export const mat4 = () => new Float32Array(16);

export function identity(out) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

export function perspective(out, fovyRad, aspect, near, far) {
  const f = 1 / Math.tan(fovyRad / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[11] = -1;
  const nf = 1 / (near - far);
  out[10] = (far + near) * nf;
  out[14] = 2 * far * near * nf;
  return out;
}

const _x = new Float32Array(3);
const _y = new Float32Array(3);
const _z = new Float32Array(3);

export function lookAt(out, eye, center, up) {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  _z[0] = zx / len;
  _z[1] = zy / len;
  _z[2] = zz / len;

  // x = normalize(cross(up, z))
  let xx = up[1] * _z[2] - up[2] * _z[1];
  let xy = up[2] * _z[0] - up[0] * _z[2];
  let xz = up[0] * _z[1] - up[1] * _z[0];
  len = Math.hypot(xx, xy, xz) || 1;
  _x[0] = xx / len;
  _x[1] = xy / len;
  _x[2] = xz / len;

  // y = cross(z, x)
  _y[0] = _z[1] * _x[2] - _z[2] * _x[1];
  _y[1] = _z[2] * _x[0] - _z[0] * _x[2];
  _y[2] = _z[0] * _x[1] - _z[1] * _x[0];

  out[0] = _x[0];  out[1] = _y[0];  out[2] = _z[0];  out[3] = 0;
  out[4] = _x[1];  out[5] = _y[1];  out[6] = _z[1];  out[7] = 0;
  out[8] = _x[2];  out[9] = _y[2];  out[10] = _z[2]; out[11] = 0;
  out[12] = -(_x[0] * eye[0] + _x[1] * eye[1] + _x[2] * eye[2]);
  out[13] = -(_y[0] * eye[0] + _y[1] * eye[1] + _y[2] * eye[2]);
  out[14] = -(_z[0] * eye[0] + _z[1] * eye[1] + _z[2] * eye[2]);
  out[15] = 1;
  return out;
}

export function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

/**
 * Projects a world point with a view-projection matrix.
 * Returns CSS pixel coordinates plus `w` so callers can reject points
 * that sit behind the camera (w <= 0).
 */
export function project(out, m, x, y, z, width, height) {
  const cx = m[0] * x + m[4] * y + m[8]  * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9]  * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  out.w = cw;
  if (cw <= 0.0001) {
    out.x = out.y = -9999;
    return out;
  }
  out.x = (cx / cw * 0.5 + 0.5) * width;
  out.y = (0.5 - cy / cw * 0.5) * height;
  return out;
}
