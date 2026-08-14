/**
 * Tera — the path grammar.
 *
 * The Tera mark is three moves: a square bar, a stem that turns once with a
 * single radius, and a dot. That is the whole vocabulary, so it is also the
 * whole vocabulary of this site.
 *
 * RULES, applied at every scale — a label connector, a product frame, an
 * edge between two systems in the ecosystem:
 *   1. connections are orthogonal;
 *   2. a connection turns exactly once, with one fixed radius (the hook);
 *   3. the hook always resolves toward the bottom-right, as in the mark;
 *   4. a connection ends in a dot.
 *
 * Remove the logo from this page and this is what is left to recognise.
 */

/** The one radius. Everything else is square. */
export const HOOK = 0.62;

/** Segments used to approximate the quarter turn. Three reads as a radius. */
const ARC_STEPS = 3;

/**
 * Writes a hooked orthogonal route from A to B into `out` as a flat list of
 * x,y,z points. Returns the number of points written.
 *
 * @param {Float32Array} out at least 3 * (ARC_STEPS + 4) long
 */
export function hookedRoute(out, ax, ay, az, bx, by, bz, radius = HOOK) {
  const dx = bx - ax;
  const dy = by - ay;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  let n = 0;
  const push = (x, y) => {
    out[n * 3] = x;
    out[n * 3 + 1] = y;
    out[n * 3 + 2] = 0; // filled in below
    n++;
  };

  // Degenerate routes stay straight rather than inventing a corner.
  if (adx < 0.02 || ady < 0.02) {
    push(ax, ay);
    push(bx, by);
  } else {
    const r = Math.min(radius, adx * 0.5, ady * 0.5);
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);

    if (adx >= ady) {
      // Along the bar first, then turn down the stem.
      push(ax, ay);
      push(bx - sx * r, ay);
      for (let i = 1; i <= ARC_STEPS; i++) {
        const a = (i / (ARC_STEPS + 1)) * (Math.PI / 2);
        push(bx - sx * r * Math.cos(a), ay + sy * r * (1 - Math.cos(Math.PI / 2 - a)));
      }
      push(bx, ay + sy * r);
      push(bx, by);
    } else {
      // Down the stem first, then out along the bar.
      push(ax, ay);
      push(ax, by - sy * r);
      for (let i = 1; i <= ARC_STEPS; i++) {
        const a = (i / (ARC_STEPS + 1)) * (Math.PI / 2);
        push(ax + sx * r * (1 - Math.cos(Math.PI / 2 - a)), by - sy * r * Math.cos(a));
      }
      push(ax + sx * r, by);
      push(bx, by);
    }
  }

  // Depth rides along the route so a connection can travel between planes.
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    out[i * 3 + 2] = az + (bz - az) * t;
  }
  return n;
}

/**
 * Position along a route, 0..1 — used by events travelling through a system.
 * Walks the same polyline the renderer draws, so a pulse can never drift off
 * its own line.
 */
export function routePoint(points, count, t, out) {
  if (count < 2) {
    out.x = points[0];
    out.y = points[1];
    out.z = points[2];
    return out;
  }
  let total = 0;
  for (let i = 0; i < count - 1; i++) {
    total += Math.hypot(
      points[(i + 1) * 3] - points[i * 3],
      points[(i + 1) * 3 + 1] - points[i * 3 + 1],
      points[(i + 1) * 3 + 2] - points[i * 3 + 2]
    );
  }
  let want = total * Math.min(Math.max(t, 0), 1);
  for (let i = 0; i < count - 1; i++) {
    const ax = points[i * 3];
    const ay = points[i * 3 + 1];
    const az = points[i * 3 + 2];
    const len = Math.hypot(points[(i + 1) * 3] - ax, points[(i + 1) * 3 + 1] - ay, points[(i + 1) * 3 + 2] - az);
    if (want <= len || i === count - 2) {
      const k = len > 0 ? want / len : 0;
      out.x = ax + (points[(i + 1) * 3] - ax) * k;
      out.y = ay + (points[(i + 1) * 3 + 1] - ay) * k;
      out.z = az + (points[(i + 1) * 3 + 2] - az) * k;
      return out;
    }
    want -= len;
  }
  return out;
}

/**
 * The same grammar for the DOM: an SVG path string from A to B.
 * Used by connectors that start inside the WebGL scene and land on a real
 * HTML element.
 */
export function hookedPath(ax, ay, bx, by, radius = 18) {
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return `M${ax} ${ay}L${bx} ${by}`;
  const r = Math.min(radius, Math.abs(dx) * 0.5, Math.abs(dy) * 0.5);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return `M${ax} ${ay}H${bx - sx * r}A${r} ${r} 0 0 ${sx * sy > 0 ? 1 : 0} ${bx} ${ay + sy * r}V${by}`;
  }
  return `M${ax} ${ay}V${by - sy * r}A${r} ${r} 0 0 ${sx * sy > 0 ? 0 : 1} ${ax + sx * r} ${by}H${bx}`;
}
