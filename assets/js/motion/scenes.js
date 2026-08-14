/**
 * Tera — the score.
 *
 * One linear timeline, nine movements. Everything else in the experience
 * (camera, palette, WebGL structure, DOM state) is a function of where we
 * are in this list. There is no second source of truth.
 *
 * `light` is the environment value: 0 = ink, 1 = paper. It never jumps;
 * each scene hands its end value to the next scene's start value.
 * `accent` is brand-colour energy — deliberately near zero almost everywhere
 * so that the few moments it appears actually mean something.
 */

import * as E from './easings.js';

/** @typedef {'boot'|'idea'|'build'|'product'|'lab'|'systems'|'capabilities'|'ecosystem'|'final'} SceneId */

export const SCENES = [
  {
    id: 'boot',
    layout: ['dust', 'dust'],
    camera: { from: [1.2, 0.8, 38], to: [0.6, 0.3, 31], look: [0, 0, 0], lookTo: [0, 0, 0] },
    light: { from: 0.0, to: 0.0, ease: E.drift },
    accent: { from: 0.0, to: 0.35, ease: E.emerge },
  },
  {
    id: 'idea',
    layout: ['dust', 'lattice'],
    camera: { from: [0.6, 0.3, 31], to: [-2.6, 1.8, 25], look: [0, 0, 0], lookTo: [0, 0.4, 0] },
    light: { from: 0.0, to: 0.1, ease: E.drift },
    accent: { from: 0.35, to: 0.08, ease: E.drift },
  },
  {
    id: 'build',
    layout: ['lattice', 'wire'],
    camera: { from: [-2.6, 1.8, 25], to: [0, 0, 20.4], look: [0, 0.4, 0], lookTo: [0, 0, 0] },
    light: { from: 0.1, to: 0.62, ease: E.drift },
    accent: { from: 0.08, to: 0.22, ease: E.settle },
  },
  {
    id: 'product',
    layout: ['wire', 'ui'],
    camera: { from: [0, 0, 20.4], to: [0, 0, 17.6], look: [0, 0, 0], lookTo: [0, 0, 0] },
    light: { from: 0.62, to: 1.0, ease: E.snap },
    accent: { from: 0.22, to: 0.14, ease: E.drift },
  },
  {
    id: 'lab',
    layout: ['ui', 'lab'],
    camera: { from: [0, 0, 17.6], to: [7.5, 3.2, 38], look: [0, 0, 0], lookTo: [1.5, 0, -6] },
    light: { from: 1.0, to: 0.3, ease: E.drift },
    accent: { from: 0.14, to: 0.1, ease: E.drift },
  },
  {
    id: 'systems',
    layout: ['lab', 'flow'],
    camera: { from: [7.5, 3.2, 38], to: [-5, -1.4, 31], look: [1.5, 0, -6], lookTo: [-0.5, 0, -3] },
    light: { from: 0.3, to: 0.05, ease: E.drift },
    accent: { from: 0.1, to: 0.42, ease: E.settle },
  },
  {
    id: 'capabilities',
    layout: ['flow', 'flow'],
    camera: { from: [-5, -1.4, 31], to: [1.5, 1.2, 27], look: [-0.5, 0, -3], lookTo: [0, 0, -2] },
    light: { from: 0.05, to: 0.05, ease: E.drift },
    accent: { from: 0.42, to: 0.16, ease: E.drift },
  },
  {
    id: 'ecosystem',
    layout: ['flow', 'eco'],
    camera: { from: [1.5, 1.2, 27], to: [0, 4.5, 96], look: [0, 0, -2], lookTo: [0, 0, -10] },
    light: { from: 0.05, to: 0.0, ease: E.drift },
    accent: { from: 0.16, to: 0.06, ease: E.drift },
  },
  {
    id: 'final',
    layout: ['eco', 'signature'],
    // Framed slightly high so the mark owns the upper field and the single
    // remaining sentence has clean air beneath it.
    camera: { from: [0, 4.5, 96], to: [0, 3.2, 30], look: [0, 0, -10], lookTo: [0, 3.2, 0] },
    light: { from: 0.0, to: 1.0, ease: E.snap },
    accent: { from: 0.06, to: 0.55, ease: E.settle },
  },
];

export const SCENE_INDEX = Object.fromEntries(SCENES.map((s, i) => [s.id, i]));

/** Palette endpoints. The whole page interpolates between these two worlds. */
export const PALETTE = {
  ink: {
    bg: [0.039, 0.039, 0.035],
    fg: [0.945, 0.937, 0.921],
    dim: [0.525, 0.517, 0.499],
    accent: [0.843, 0.969, 0.357],
  },
  paper: {
    bg: [0.961, 0.953, 0.937],
    fg: [0.063, 0.063, 0.063],
    dim: [0.398, 0.390, 0.370],
    accent: [0.612, 0.784, 0.055],
  },
};

/**
 * Mixes the two palettes into the values the renderer and the CSS both read.
 *
 * A dark-to-light journey has one hazard: cross-fade the background and the
 * type at the same rate and, halfway through, both are the same grey and the
 * page is unreadable. So the inversion is engineered rather than lerped:
 *
 *   · the background travels on a steep curve — it is never parked mid-grey;
 *   · the type crosses in an even narrower band, so the two are never grey
 *     together for more than an instant;
 *   · through that instant the type routes via the brand colour instead of
 *     via grey, which both holds contrast up and makes the inversion read as
 *     something the system did on purpose.
 *
 * Every place the page comes to rest sits far from the crossover, so nobody
 * ever reads a paragraph inside it.
 */
const ACID = [0.843, 0.969, 0.357];

const band = (v, a, b) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function paletteAt(light, out = {}) {
  const a = PALETTE.ink;
  const b = PALETTE.paper;
  const kBg = band(light, 0.44, 0.56);
  const kFg = band(light, 0.47, 0.53);
  // Peaks at 1 exactly at the crossing, gone a few frames either side.
  const flash = (1 - Math.abs(kFg * 2 - 1)) * band(0.09 - Math.abs(light - 0.5), 0, 0.03) * 0.88;

  const mix = (ka, kb, k) => [
    ka[0] + (kb[0] - ka[0]) * k,
    ka[1] + (kb[1] - ka[1]) * k,
    ka[2] + (kb[2] - ka[2]) * k,
  ];
  const viaAcid = (c) => mix(c, ACID, flash);

  out.bg = mix(a.bg, b.bg, kBg);
  out.fg = viaAcid(mix(a.fg, b.fg, kFg));
  out.dim = viaAcid(mix(a.dim, b.dim, kFg));
  out.accent = mix(a.accent, b.accent, kFg);
  return out;
}

export const rgbCss = (c) =>
  `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`;
