/**
 * Tera — the Core's states.
 *
 * One population of nodes. Eight arrangements. The nodes never get replaced:
 * the dust that drifts in the first scene is the same dust that becomes a
 * table row, then a product, then a system, then the mark itself. That is the
 * whole argument of the page — an idea does not get swapped for a product,
 * it *becomes* one.
 *
 * Node index bands are stable across every layout so a morph reads as
 * material finding order rather than a crossfade:
 *   [0 .. STRUCT)          structure — frames, grids, vertices
 *   [STRUCT .. DETAIL)     detail — data, rows, series, labels
 *   [DETAIL .. n)          ambient — never fully resolves, keeps space alive
 */

import { seeded } from '../motion/math.js';

/** Shared interface geometry: [cx, cy, w, h]. Wire and UI reuse these ids so
 *  panels transform instead of being swapped out. */
export const UI = {
  frame: [0, 0, 17.0, 10.6],
  bar:   [0, 4.6, 17.0, 1.4],
  side:  [-6.4, -0.75, 4.0, 8.5],
  main:  [2.3, -0.75, 12.2, 8.5],
  cardA: [-1.625, 1.85, 3.55, 2.5],
  cardB: [2.3, 1.85, 3.55, 2.5],
  cardC: [6.225, 1.85, 3.55, 2.5],
  chart: [-0.65, -2.25, 5.5, 4.7],
  list:  [5.25, -2.25, 5.5, 4.7],
};

/** The four systems that exist in the Tera lab, in world space. */
export const LAB_SITES = [
  // Spread so the four systems never sit on top of each other, and so the
  // scene's copy keeps a clear corner to live in.
  { id: 'vertice', pos: [-9.0, 4.6, -3.5],   size: [5.0, 3.2] },
  { id: 'epub',    pos: [8.6, 5.4, -12.0],   size: [4.4, 2.8] },
  { id: 'context', pos: [6.2, -8.2, -21.0],  size: [4.6, 2.9] },
  { id: 'journey', pos: [12.0, -2.6, -27.0], size: [4.4, 2.8] },
];

const SHAPE = { dot: 0, square: 1, ring: 2 };

class Field {
  constructor(n) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.meta = new Float32Array(n * 3); // size, tone, shape
    this.i = 0;
  }

  put(x, y, z, size = 0.045, tone = 0, shape = SHAPE.dot) {
    if (this.i >= this.n) return -1;
    const i = this.i++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.meta[i * 3] = size;
    this.meta[i * 3 + 1] = tone;
    this.meta[i * 3 + 2] = shape;
    return i;
  }

  get left() {
    return this.n - this.i;
  }
}

/* ------------------------------------------------------------- emitters */

/** Points spread evenly around a rectangle's perimeter. */
function edge(f, count, cx, cy, z, w, h, o = {}) {
  const start = f.i;
  const per = 2 * (w + h);
  for (let k = 0; k < count; k++) {
    let d = (k / count) * per;
    let x, y;
    if (d < w) { x = cx - w / 2 + d; y = cy + h / 2; }
    else if ((d -= w) < h) { x = cx + w / 2; y = cy + h / 2 - d; }
    else if ((d -= h) < w) { x = cx + w / 2 - d; y = cy - h / 2; }
    else { d -= w; x = cx - w / 2; y = cy - h / 2 + d; }
    f.put(x, y, z, o.size ?? 0.04, o.tone ?? 0, o.shape ?? SHAPE.dot);
  }
  return { start, count: f.i - start };
}

/** Corner and mid-edge vertices only — a rectangle reduced to its joints. */
function joints(f, cx, cy, z, w, h, o = {}) {
  const start = f.i;
  const hx = w / 2;
  const hy = h / 2;
  const pts = [
    [-hx, hy], [0, hy], [hx, hy],
    [hx, 0], [hx, -hy], [0, -hy],
    [-hx, -hy], [-hx, 0],
  ];
  for (const [dx, dy] of pts) f.put(cx + dx, cy + dy, z, o.size ?? 0.062, o.tone ?? 0, o.shape ?? SHAPE.square);
  return { start, count: f.i - start };
}

function row(f, count, x0, x1, y, z, o = {}) {
  const start = f.i;
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? 0 : k / (count - 1);
    f.put(x0 + (x1 - x0) * t, y, z, o.size ?? 0.04, o.tone ?? 0, o.shape ?? SHAPE.dot);
  }
  return { start, count: f.i - start };
}

function grid(f, cols, rows, cx, cy, z, w, h, o = {}) {
  const start = f.i;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cx - w / 2 + (cols === 1 ? w / 2 : (c / (cols - 1)) * w);
      const y = cy + h / 2 - (rows === 1 ? h / 2 : (r / (rows - 1)) * h);
      f.put(x, y, z, o.size ?? 0.038, o.tone ?? 0, o.shape ?? SHAPE.dot);
    }
  }
  return { start, count: f.i - start };
}

function disc(f, count, cx, cy, z, r, rng, o = {}) {
  const start = f.i;
  for (let k = 0; k < count; k++) {
    // Golden-angle spiral: even coverage, no clumping, deterministic.
    const a = k * 2.399963;
    const rr = r * Math.sqrt((k + 0.5) / count);
    f.put(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z, o.size ?? 0.04, o.tone ?? 0, o.shape ?? SHAPE.dot);
  }
  return { start, count: f.i - start };
}

function scatter(f, count, rng, box, o = {}) {
  const start = f.i;
  for (let k = 0; k < count; k++) {
    f.put(
      box[0] + (rng() - 0.5) * box[3],
      box[1] + (rng() - 0.5) * box[4],
      box[2] + (rng() - 0.5) * box[5],
      (o.size ?? 0.03) * (0.6 + rng() * 0.9),
      rng() < (o.accent ?? 0.02) ? 1 : 0,
      rng() < 0.14 ? SHAPE.square : SHAPE.dot
    );
  }
  return { start, count: f.i - start };
}

/** Fills whatever is left with the layout's ambient field. */
function ambient(f, rng, box) {
  scatter(f, f.left, rng, box, { size: 0.026 });
}

const panel = (id, cx, cy, z, w, h, o = {}) => ({
  id, x: cx, y: cy, z, w, h,
  alpha: o.alpha ?? 0.5,
  fill: o.fill ?? 0,
  tone: o.tone ?? 0,
  hook: o.hook ?? 1,
});

const link = (a, b, o = {}) => ({ a, b, style: o.style ?? 0, energy: o.energy ?? 0, live: o.live ?? 0 });

/* -------------------------------------------------------------- layouts */

/**
 * @param {number} n node budget
 * @param {{narrow?: boolean}} [options] narrow = a tall viewport that sees only
 *   about a third of the world width a desktop does. Not "the desktop scene,
 *   smaller": the mark and the rule are rebuilt at sizes composed for it.
 */
export function buildLayouts(n, { narrow = false } = {}) {
  MARK_H = narrow ? 10 : 6.2;
  SETTLED_SPAN = narrow ? 5.4 : 12;
  SETTLED_N = narrow ? 13 : 25;
  measureMark();
  measureArea();
  _markCache.clear();

  const STRUCT = Math.round(n * 0.52);
  const DETAIL = Math.round(n * 0.30);

  return {
    dust: dust(n),
    lattice: lattice(n, STRUCT, DETAIL),
    wire: wire(n, STRUCT, DETAIL),
    ui: ui(n, STRUCT, DETAIL),
    lab: lab(n, STRUCT, DETAIL),
    flow: flow(n, STRUCT, DETAIL),
    eco: eco(n, STRUCT, DETAIL),
    signature: signature(n),
    settled: settled(n),
  };
}

/**
 * BOOT — possibility. Almost nothing, moving almost imperceptibly.
 * A handful of deliberate objects near the centre; everything else is pushed
 * far out and far back so the frame reads as empty rather than as a starfield.
 */
function dust(n) {
  const rng = seeded(0x7e1a);
  const f = new Field(n);

  // Six objects that are actually there. These are the ones that will find
  // each other first.
  const seeds = [
    [-6.2, 2.4, 1.5, 0.075, 1], [-1.1, 2.9, 0.4, 0.055, 0],
    [4.8, 0.6, -1.2, 0.062, 1], [7.9, -2.4, 0.8, 0.05, 0],
    [-4.4, -3.1, -2.0, 0.058, 1], [1.6, -4.2, 1.1, 0.048, 0],
  ];
  for (const [x, y, z, size, shape] of seeds) f.put(x, y, z, size, 0, shape);

  scatter(f, Math.round(n * 0.16), rng, [0, 0, -14, 88, 50, 58], { size: 0.036, accent: 0.02 });
  ambient(f, rng, [0, 0, -26, 150, 84, 96]);

  // One line finds one point, and something answers.
  const links = [
    link(0, 2, { energy: 1 }),
    link(2, 4, { energy: 0.45 }),
    link(1, 3, { energy: 0.16 }),
  ];
  return { ...f, links, panels: [] };
}

/** IDEA — coordinates. Order appears before form does. */
function lattice(n, STRUCT, DETAIL) {
  const rng = seeded(0x1d3a);
  const f = new Field(n);

  const cols = 15;
  const rows = 9;
  grid(f, cols, rows, 0, 0, 0, 20.4, 11.2, { size: 0.042 });
  grid(f, 9, 5, -1.5, 0.4, -8.5, 16, 8, { size: 0.03 });
  while (f.i < STRUCT) f.put(0, 0, 0, 0);

  // Detail is more coordinates, not noise: three further planes of the same
  // lattice, so the scene reads as a space being measured.
  grid(f, 11, 4, 1.2, -0.6, 5.5, 13, 5.4, { size: 0.026 });
  grid(f, 8, 4, -3.0, 1.2, -15.0, 12, 6.4, { size: 0.024 });
  grid(f, 7, 3, 3.4, -1.8, 11.0, 9, 4.2, { size: 0.022 });
  while (f.i < DETAIL + STRUCT) {
    const k = f.i - STRUCT;
    const c = k % 13;
    const r = Math.floor(k / 13) % 7;
    f.put(-10.2 + c * 1.7, 5.6 - r * 1.86, -3.4, 0.022, k % 89 === 0 ? 1 : 0);
  }
  ambient(f, rng, [0, 0, -8, 62, 34, 40]);

  // First hooked routes: the grammar announces itself.
  const links = [];
  const at = (c, r) => r * cols + c;
  const pairs = [
    [at(2, 6), at(7, 2)], [at(9, 7), at(12, 3)], [at(4, 1), at(11, 5)],
    [at(1, 3), at(5, 7)], [at(13, 6), at(8, 1)], [at(6, 4), at(10, 8)],
  ];
  for (const [a, b] of pairs) links.push(link(a, b, { energy: 0.25 }));
  return { ...f, links, panels: [] };
}

/** BUILD — the same coordinates, now describing areas. */
function wire(n, STRUCT, DETAIL) {
  const rng = seeded(0x2b7c);
  const f = new Field(n);

  const J = {};
  J.frame = joints(f, ...[UI.frame[0], UI.frame[1]], 0, UI.frame[2], UI.frame[3], { size: 0.07 });
  J.bar = joints(f, UI.bar[0], UI.bar[1], 0.04, UI.bar[2], UI.bar[3], { size: 0.055 });
  J.side = joints(f, UI.side[0], UI.side[1], 0.08, UI.side[2], UI.side[3], { size: 0.055 });
  J.main = joints(f, UI.main[0], UI.main[1], 0.08, UI.main[2], UI.main[3], { size: 0.055 });
  edge(f, 46, UI.main[0], UI.main[1], 0.08, UI.main[2], UI.main[3], { size: 0.032 });
  edge(f, 24, UI.side[0], UI.side[1], 0.08, UI.side[2], UI.side[3], { size: 0.032 });
  grid(f, 13, 7, 0, -0.4, -0.9, 15.6, 9, { size: 0.024 });
  while (f.i < STRUCT) f.put(0, -0.4, -0.9, 0);

  // Detail is present but has not decided what it is yet.
  grid(f, 10, 6, 2.3, -0.9, 0.12, 10.4, 7, { size: 0.03 });
  const restDetail = STRUCT + DETAIL - f.i;
  for (let k = 0; k < restDetail; k++) {
    f.put(-6.4 + (rng() - 0.5) * 3.2, -0.75 + (rng() - 0.5) * 7.6, 0.12, 0.028);
  }
  ambient(f, rng, [0, 0, -9, 46, 26, 30]);

  const links = [];
  const c = J.side.start;
  const m = J.main.start;
  links.push(link(c + 3, m + 7, { energy: 0.5 }));
  links.push(link(c + 4, m + 6, { energy: 0.2 }));
  links.push(link(J.bar.start + 5, m + 1, { energy: 0.35 }));
  links.push(link(J.frame.start, J.bar.start, { energy: 0.1 }));

  const panels = [
    panel('frame', UI.frame[0], UI.frame[1], 0, UI.frame[2], UI.frame[3], { alpha: 0.55 }),
    panel('bar', UI.bar[0], UI.bar[1], 0.04, UI.bar[2], UI.bar[3], { alpha: 0.4 }),
    panel('side', UI.side[0], UI.side[1], 0.08, UI.side[2], UI.side[3], { alpha: 0.4 }),
    panel('main', UI.main[0], UI.main[1], 0.08, UI.main[2], UI.main[3], { alpha: 0.4 }),
  ];
  return { ...f, links, panels };
}

/** PRODUCT — the areas fill with something worth looking at. */
function ui(n, STRUCT, DETAIL) {
  const rng = seeded(0x3f10);
  const f = new Field(n);

  const J = {};
  J.frame = joints(f, UI.frame[0], UI.frame[1], 0, UI.frame[2], UI.frame[3], { size: 0.055 });
  J.bar = joints(f, UI.bar[0], UI.bar[1], 0.04, UI.bar[2], UI.bar[3], { size: 0.042 });
  J.side = joints(f, UI.side[0], UI.side[1], 0.08, UI.side[2], UI.side[3], { size: 0.042 });
  J.main = joints(f, UI.main[0], UI.main[1], 0.08, UI.main[2], UI.main[3], { size: 0.042 });

  // Sidebar: six destinations, one of them selected.
  const nav = f.i;
  for (let k = 0; k < 6; k++) {
    f.put(-7.7, 3.0 - k * 0.92, 0.14, k === 1 ? 0.085 : 0.05, k === 1 ? 1 : 0, k === 1 ? SHAPE.dot : SHAPE.ring);
  }
  for (let k = 0; k < 6; k++) row(f, 5, -7.2, -5.1, 3.0 - k * 0.92, 0.14, { size: 0.028 });

  // Top bar: context on the left, account on the right.
  row(f, 3, -8.0, -7.1, 4.6, 0.1, { size: 0.05, shape: SHAPE.square });
  row(f, 4, 6.6, 8.0, 4.6, 0.1, { size: 0.052, shape: SHAPE.ring });

  edge(f, 30, UI.main[0], UI.main[1], 0.08, UI.main[2], UI.main[3], { size: 0.026 });
  while (f.i < STRUCT) f.put(0, -0.4, -1.4, 0);

  // Three metrics.
  const metrics = f.i;
  for (const card of [UI.cardA, UI.cardB, UI.cardC]) {
    row(f, 4, card[0] - card[2] / 2 + 0.35, card[0] - 0.2, card[1] + 0.72, 0.16, { size: 0.03 });
    row(f, 7, card[0] - card[2] / 2 + 0.35, card[0] + card[2] / 2 - 0.35, card[1] - 0.55, 0.16, { size: 0.045 });
  }

  // A series that goes up, because it is measuring something real.
  const series = f.i;
  const SERIES_N = 15;
  for (let k = 0; k < SERIES_N; k++) {
    const t = k / (SERIES_N - 1);
    const y = UI.chart[1] - 1.5 + t * 2.4 + Math.sin(t * 7.5) * 0.34 + Math.sin(t * 3.1) * 0.2;
    f.put(UI.chart[0] - UI.chart[2] / 2 + 0.4 + t * (UI.chart[2] - 0.8), y, 0.18, k === SERIES_N - 1 ? 0.085 : 0.042, k === SERIES_N - 1 ? 1 : 0);
  }

  // A list of things happening.
  const rows = f.i;
  for (let k = 0; k < 5; k++) {
    const y = UI.list[1] + 1.55 - k * 0.78;
    f.put(UI.list[0] - UI.list[2] / 2 + 0.42, y, 0.18, 0.05, 0, k === 0 ? SHAPE.dot : SHAPE.ring);
    row(f, 6, UI.list[0] - UI.list[2] / 2 + 0.95, UI.list[0] + UI.list[2] / 2 - 1.1, y, 0.18, { size: 0.028 });
    f.put(UI.list[0] + UI.list[2] / 2 - 0.5, y, 0.18, 0.045, k === 0 ? 1 : 0, SHAPE.square);
  }
  while (f.i < STRUCT + DETAIL) f.put(2.3, -0.75 + (rng() - 0.5) * 6, 0.2, 0.024);
  ambient(f, rng, [0, 0, -11, 44, 25, 26]);

  const links = [];
  for (let k = 0; k < SERIES_N - 1; k++) links.push(link(series + k, series + k + 1, { style: 1, energy: 0.3 }));
  links.push(link(nav + 1, J.main.start + 7, { energy: 0.6, live: 1 }));
  links.push(link(J.bar.start + 5, metrics + 8, { energy: 0.35, live: 1 }));
  links.push(link(rows, series + SERIES_N - 1, { energy: 0.5, live: 1 }));

  const panels = [
    panel('frame', UI.frame[0], UI.frame[1], 0, UI.frame[2], UI.frame[3], { alpha: 0.85, fill: 0.1 }),
    panel('bar', UI.bar[0], UI.bar[1], 0.04, UI.bar[2], UI.bar[3], { alpha: 0.6, fill: 0.05 }),
    panel('side', UI.side[0], UI.side[1], 0.08, UI.side[2], UI.side[3], { alpha: 0.55, fill: 0.05 }),
    panel('main', UI.main[0], UI.main[1], 0.08, UI.main[2], UI.main[3], { alpha: 0.5 }),
    panel('cardA', UI.cardA[0], UI.cardA[1], 0.14, UI.cardA[2], UI.cardA[3], { alpha: 0.7, fill: 0.08 }),
    panel('cardB', UI.cardB[0], UI.cardB[1], 0.14, UI.cardB[2], UI.cardB[3], { alpha: 0.7, fill: 0.08 }),
    panel('cardC', UI.cardC[0], UI.cardC[1], 0.14, UI.cardC[2], UI.cardC[3], { alpha: 0.7, fill: 0.08, tone: 0.6 }),
    panel('chart', UI.chart[0], UI.chart[1], 0.14, UI.chart[2], UI.chart[3], { alpha: 0.6, fill: 0.05 }),
    panel('list', UI.list[0], UI.list[1], 0.14, UI.list[2], UI.list[3], { alpha: 0.6, fill: 0.05 }),
  ];
  return { ...f, links, panels, anchors: { series, rows, metrics, nav } };
}

/** LAB — the product turns out to be one of several. */
function lab(n, STRUCT, DETAIL) {
  const rng = seeded(0x4c22);
  const f = new Field(n);

  const sites = [];
  const per = Math.floor(STRUCT / LAB_SITES.length);
  for (const site of LAB_SITES) {
    const [x, y, z] = site.pos;
    const [w, h] = site.size;
    const start = f.i;
    joints(f, x, y, z, w, h, { size: 0.05 });
    edge(f, Math.round(per * 0.28), x, y, z, w, h, { size: 0.03 });
    grid(f, 6, 4, x, y - 0.15, z + 0.1, w - 1.0, h - 0.9, { size: 0.032 });
    while (f.i - start < per) f.put(x + (rng() - 0.5) * w, y + (rng() - 0.5) * h, z + (rng() - 0.5) * 1.2, 0.024);
    sites.push({ id: site.id, start, count: f.i - start });
  }
  while (f.i < STRUCT) f.put(0, 0, 2, 0);

  // The Tera core itself, small and central: the thing that made the others.
  const core = f.i;
  joints(f, 0, -0.4, 1.5, 2.6, 1.8, { size: 0.06 });
  grid(f, 5, 3, 0, -0.4, 1.5, 1.8, 1.1, { size: 0.034 });
  while (f.i < STRUCT + DETAIL) {
    const a = rng() * Math.PI * 2;
    const r = 6 + rng() * 22;
    f.put(Math.cos(a) * r, Math.sin(a) * r * 0.6, -8 + (rng() - 0.5) * 26, 0.026);
  }
  ambient(f, rng, [0, 0, -14, 60, 34, 40]);

  const links = [];
  for (const s of sites) links.push(link(core, s.start, { energy: 0.4 }));
  links.push(link(sites[0].start + 2, sites[1].start + 6, { energy: 0.18 }));
  links.push(link(sites[2].start + 1, sites[3].start + 5, { energy: 0.18 }));

  const panels = LAB_SITES.map((s, i) =>
    panel(`lab-${s.id}`, s.pos[0], s.pos[1], s.pos[2], s.size[0], s.size[1], {
      alpha: 0.62, fill: 0.06, tone: i === 0 ? 0.5 : 0,
    })
  );
  panels.push(panel('core', 0, -0.4, 1.5, 2.6, 1.8, { alpha: 0.75, fill: 0.1, tone: 0.35 }));
  // The product we just left used to recede as a ghost frame here. Removed:
  // at 0.16 alpha it read as a rectangle someone forgot to delete rather than
  // as depth, and the four lab sites already carry the idea.

  return { ...f, links, panels, sites, core };
}

/** SYSTEMS — the systems start talking to each other. */
function flow(n, STRUCT, DETAIL) {
  const rng = seeded(0x5e91);
  const f = new Field(n);

  // A spine, and the stations hanging off it. Every route obeys the grammar.
  const spineY = 0;
  const spine = row(f, 24, -15, 15, spineY, -4, { size: 0.032 });

  const stations = [];
  const STATION_X = [-11.5, -6, -0.5, 5, 10.5];
  const STATION_Y = [3.6, -3.4, 3.6, -3.4, 3.6];
  for (let k = 0; k < STATION_X.length; k++) {
    const start = f.i;
    joints(f, STATION_X[k], STATION_Y[k], -4 + (k % 2 ? 1.2 : -1.2), 3.4, 2.2, { size: 0.05 });
    grid(f, 5, 3, STATION_X[k], STATION_Y[k], -4 + (k % 2 ? 1.2 : -1.2), 2.2, 1.2, { size: 0.03 });
    stations.push({ start, count: f.i - start, x: STATION_X[k], y: STATION_Y[k] });
  }
  for (const site of LAB_SITES) {
    const start = f.i;
    joints(f, site.pos[0] * 1.5, site.pos[1] * 1.3, site.pos[2] - 6, site.size[0] * 0.7, site.size[1] * 0.7, { size: 0.038 });
    stations.push({ start, count: f.i - start, x: site.pos[0] * 1.5, y: site.pos[1] * 1.3 });
  }
  while (f.i < STRUCT) f.put(0, 0, -4, 0);

  // Payload: the data that actually moves.
  const payload = f.i;
  for (let k = 0; k < 40; k++) {
    f.put(-15 + rng() * 30, spineY + (rng() - 0.5) * 0.5, -4 + (rng() - 0.5) * 0.4, 0.03, rng() < 0.2 ? 1 : 0);
  }
  while (f.i < STRUCT + DETAIL) {
    f.put((rng() - 0.5) * 34, (rng() - 0.5) * 18, -6 + (rng() - 0.5) * 22, 0.026);
  }
  ambient(f, rng, [0, 0, -12, 58, 32, 38]);

  const links = [];
  for (let k = 0; k < 5; k++) {
    links.push(link(spine.start + 2 + k * 5, stations[k].start + (k % 2 ? 1 : 5), { energy: 0.7, live: 1 }));
  }
  for (let k = 0; k < 4; k++) {
    links.push(link(stations[k].start + 3, stations[k + 1].start + 7, { energy: 0.3 }));
  }
  for (let k = 0; k < 4; k++) {
    links.push(link(stations[k + 1].start, stations[5 + k].start, { energy: 0.45, live: 1 }));
  }
  links.push(link(spine.start, spine.start + 23, { style: 1, energy: 0.22 }));

  const panels = STATION_X.map((x, k) =>
    panel(`node-${k}`, x, STATION_Y[k], -4 + (k % 2 ? 1.2 : -1.2), 3.4, 2.2, { alpha: 0.5, fill: 0.05, tone: k === 2 ? 0.4 : 0 })
  );
  for (const site of LAB_SITES) {
    panels.push(panel(`lab-${site.id}`, site.pos[0] * 1.5, site.pos[1] * 1.3, site.pos[2] - 6, site.size[0] * 0.7, site.size[1] * 0.7, { alpha: 0.34 }));
  }

  return { ...f, links, panels, stations, payload, spine: spine.start };
}

/** ECOSYSTEM — pull back far enough and it is a whole territory. */
function eco(n, STRUCT, DETAIL) {
  const rng = seeded(0x6a55);
  const f = new Field(n);

  const clusters = [];
  const COUNT = 22;
  for (let c = 0; c < COUNT; c++) {
    const a = c * 2.399963;
    const r = 8 + Math.sqrt(c / COUNT) * 52;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.52;
    const z = -14 - ((c * 37) % 100) / 100 * 46;
    const w = 2.0 + ((c * 17) % 10) / 10 * 3.4;
    const h = w * 0.62;
    const start = f.i;
    joints(f, x, y, z, w, h, { size: 0.05 });
    grid(f, 4, 3, x, y, z, w - 0.6, h - 0.5, { size: 0.032 });
    clusters.push({ start, x, y, z, w, h, count: f.i - start });
    if (f.i >= STRUCT) break;
  }
  while (f.i < STRUCT) {
    const a = rng() * Math.PI * 2;
    const r = 10 + rng() * 62;
    f.put(Math.cos(a) * r, Math.sin(a) * r * 0.5, -20 - rng() * 50, 0.03);
  }

  for (let k = 0; k < DETAIL; k++) {
    const a = rng() * Math.PI * 2;
    const r = 4 + rng() * 74;
    f.put(Math.cos(a) * r, Math.sin(a) * r * 0.5, -18 - rng() * 58, 0.028, rng() < 0.03 ? 1 : 0);
  }
  ambient(f, rng, [0, 0, -40, 190, 96, 110]);

  const links = [];
  for (let c = 1; c < clusters.length; c++) {
    links.push(link(clusters[c].start, clusters[Math.floor(c / 2)].start, { energy: 0.22 }));
  }
  // Fewer surfaces, each actually visible. Twenty near-transparent rectangles
  // read as dirt on the screen; twelve that are properly drawn read as a
  // territory — and this scene is a wide shot, so it can afford the contrast.
  const panels = clusters.slice(0, 12).map((c, i) =>
    panel(`eco-${i}`, c.x, c.y, c.z, c.w, c.h, { alpha: 0.52, fill: 0.05, tone: i === 0 ? 0.45 : 0 })
  );
  return { ...f, links, panels, clusters };
}

/* ------------------------------------------------------------ the mark
 * The Tera mark, built out of the same nodes that have been carrying the whole
 * page. Geometry lifted directly from assets/images/tera_simbolo_oficial_preta.svg
 * so the shape on screen is the shape in the brand files, not a redraw.
 *
 * It is a framed object, not a particle system. Two numbers define it and
 * every derived position comes from them, so the composition is identical on
 * a 2560px display and on a phone — only the density changes.
 */

/**
 * World height of the mark, and the reach of the rule it resolves into.
 *
 * A tall narrow viewport sees roughly a third of the world width a desktop
 * does, so the same numbers would give a mark occupying a quarter of a phone
 * screen and a rule whose dots are almost all off both edges. These are the
 * two values that recompose the scene rather than scaling it: on a phone the
 * mark is *larger* in world units so it reads at about 70% of the width, and
 * the rule is short enough that its dots stay in frame.
 */
let MARK_H = 6.2;
let SETTLED_SPAN = 12;
/** Centre of the mark in world Y. Everything below it is the headline's. */
const MARK_Y = 5.0;
/** Dots in the rule the mark resolves into. */
let SETTLED_N = 25;

let MARK;
function measureMark() {
  const K = MARK_H / 342;
  const sx = (x) => (x - 170) * K;
  const sy = (y) => -(y - 171) * K + MARK_Y;
  MARK = {
    K,
    sx,
    sy,
    halfW: 170 * K,
    halfH: 171 * K,
    bar: { x0: sx(0), x1: sx(262), y0: sy(68), y1: sy(0) },
    stem: { x0: sx(90), x1: sx(174), y0: sy(270), y1: sy(68) },
    foot: { x0: sx(90), x1: sx(225), y0: sy(336), y1: sy(270) },
    dot: { cx: sx(294), cy: sy(296), r: 46 * K },
    /** The Y the bar sits on. The mark disperses onto exactly this line. */
    barY: (sy(0) + sy(68)) / 2,
    hook: 0.45 * (MARK_H / 8.6),
  };
  return MARK;
}
measureMark();

/** Scans the mark's outline at a given step and returns every cell inside it. */
function scanMark(step) {
  const m = MARK;
  const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  const inFoot = (x, y) => {
    if (!inRect(m.foot, x, y)) return false;
    // The one radius, exactly where the mark puts it.
    const rx = m.foot.x1 - m.hook;
    const ry = m.foot.y0 + m.hook;
    if (x > rx && y < ry) return Math.hypot(x - rx, y - ry) <= m.hook;
    return true;
  };
  const slots = [];
  for (let y = MARK_Y - m.halfH; y <= MARK_Y + m.halfH; y += step) {
    for (let x = -m.halfW; x <= m.halfW + step; x += step) {
      if (inRect(m.bar, x, y) || inRect(m.stem, x, y) || inFoot(x, y)) slots.push([x, y, 0]);
      else if (Math.hypot(x - m.dot.cx, y - m.dot.cy) <= m.dot.r) slots.push([x, y, 0.18]);
    }
  }
  return slots;
}

/** The mark's area in world units. Re-measured whenever the mark is resized. */
let MARK_AREA = 0;
function measureArea() {
  const s = MARK_H / 100;
  MARK_AREA = scanMark(s).length * s * s;
}
measureArea();

/**
 * The mark at a given dot count.
 *
 * The step is solved from the budget rather than the budget being sampled out
 * of a fixed raster — subsampling a raster leaves a dither pattern through the
 * stem and the shape reads as half-loaded. Solving for the step gives an even
 * field at any density, so the mark is the same mark at 420 dots and at 1150.
 */
const _markCache = new Map();
function markSlots(target) {
  let slots = _markCache.get(target);
  if (slots) return slots;
  slots = scanMark(Math.sqrt(MARK_AREA / target));
  _markCache.set(target, slots);
  return slots;
}

/** How much of the node budget the mark itself occupies. Everything above this
 *  index is parked at size 0 — the mark is the composition, not a layer on top
 *  of one. Kept under the quality governor's floor so the shape never loses
 *  dots on a slower device, and under the ambient band so no mark dot ever
 *  picks up the ambient drift. */
const MARK_SHARE = 0.7;
const markCount = (n) => Math.round(n * MARK_SHARE);

/** ASSEMBLED — the mark, whole, centred, framed. Nothing else on screen. */
function signature(n) {
  const f = new Field(n);
  const slots = markSlots(markCount(n));
  for (const s of slots) {
    if (f.left <= 0) break;
    f.put(s[0], s[1], s[2], 0.052, s[2] > 0 ? 0.3 : 0, SHAPE.dot);
  }
  // No halo, no ambient. Silence is the point of this scene.
  while (f.i < f.n) f.put(0, MARK_Y, 0, 0);
  return { ...f, links: [], panels: [] };
}

/**
 * SETTLED — the mark finds the grid and stops being a mark.
 *
 * Every dot that made the bar of the T lands on one horizontal line of grid
 * nodes at exactly the bar's own height; every other dot resolves to nothing,
 * in place. What is left is a rule across the top of the frame and a great
 * deal of air, which is the whole point: the headline underneath has no
 * competition left.
 */
function settled(n) {
  const f = new Field(n);
  const take = Math.min(n, markSlots(markCount(n)).length);
  const stride = Math.max(1, Math.floor(take / SETTLED_N));
  for (let k = 0; k < take; k++) {
    const j = k / stride;
    if (Number.isInteger(j) && j < SETTLED_N) {
      const t = SETTLED_N === 1 ? 0.5 : j / (SETTLED_N - 1);
      // The dot of the mark survives as the dot that closes the line.
      const last = j === SETTLED_N - 1;
      f.put(-SETTLED_SPAN + t * SETTLED_SPAN * 2, MARK.barY, 0, last ? 0.075 : 0.045,
        last ? 1 : 0, SHAPE.dot);
    } else {
      // Resolved. Shrinks where it stands rather than flying anywhere.
      f.put(0, MARK_Y, 0, 0);
    }
  }
  while (f.i < f.n) f.put(0, MARK_Y, 0, 0);
  return { ...f, links: [], panels: [] };
}
