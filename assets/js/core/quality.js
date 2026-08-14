/**
 * Tera — device tiers.
 *
 * Mobile is not "the desktop experience with things turned off". It is the
 * same story told with fewer elements, shorter camera travel and more of the
 * work handed to the DOM. Every tier keeps the moments that matter.
 */

export const TIERS = {
  high: {
    name: 'high',
    nodes: 1150,
    segments: 900,
    panels: 52,
    dpr: 2,
    parallax: 1,
    travel: 1,
    distance: 1,
    ambient: 1,
  },
  medium: {
    name: 'medium',
    nodes: 720,
    segments: 560,
    panels: 44,
    dpr: 1.6,
    parallax: 0.75,
    travel: 0.9,
    distance: 1.06,
    ambient: 0.8,
  },
  low: {
    name: 'low',
    nodes: 420,
    segments: 300,
    panels: 32,
    dpr: 1.4,
    parallax: 0,
    travel: 0.5,
    // A phone sees less than half the world width a desktop does at the same
    // distance. Without a real pull-back the wide scenes arrive as a crop of a
    // composition rather than as a composition, which is the difference
    // between a small screen being designed for and being left over.
    distance: 1.5,
    ambient: 0.55,
  },
};

export function detectTier() {
  if (typeof navigator === 'undefined') return TIERS.low;

  const coarse = matchMedia('(pointer: coarse)').matches;
  const narrow = Math.min(innerWidth, innerHeight) < 700;
  const mem = navigator.deviceMemory || (coarse ? 4 : 8);
  const cores = navigator.hardwareConcurrency || (coarse ? 4 : 8);
  const saveData = navigator.connection?.saveData === true;

  if (saveData) return TIERS.low;
  if (coarse || narrow) return mem >= 6 && cores >= 6 ? TIERS.medium : TIERS.low;
  if (mem <= 4 || cores <= 4) return TIERS.medium;
  if (innerWidth * innerHeight > 3_500_000 && cores < 8) return TIERS.medium;
  return TIERS.high;
}

/**
 * The lowest the governor may take the node budget.
 *
 * This is a composition constraint, not a performance one. Node indices are
 * banded — structure, then detail, then ambient — and culling from the top
 * removes ambient first. The floor is set above the ambient band so a slow
 * device loses atmosphere and never loses the shape: the mark is the same mark
 * on every machine, and the same mark on every reload. Anything that let the
 * frame budget reach into the structure would mean the composition depended on
 * the device's frame history, which is the one thing it must not do.
 */
export const QUALITY_FLOOR = 0.8;

/**
 * Watches frame cost and steps the renderer down if the device cannot hold
 * the target. Only ever downgrades — oscillating quality is worse than a
 * slightly conservative setting.
 */
export class Governor {
  constructor(onChange, { target = 1000 / 55, window = 90 } = {}) {
    this.onChange = onChange;
    this.target = target;
    this.window = window;
    this.samples = 0;
    this.slow = 0;
    this.level = 1;
    this.fps = 60;
    this._acc = 0;
    this._frames = 0;
  }

  sample(dtMs) {
    this._acc += dtMs;
    this._frames++;
    if (this._acc >= 500) {
      this.fps = Math.round((this._frames * 1000) / this._acc);
      this._acc = 0;
      this._frames = 0;
    }

    if (dtMs > this.target) this.slow++;
    this.samples++;
    if (this.samples < this.window) return;

    const ratio = this.slow / this.samples;
    this.samples = 0;
    this.slow = 0;
    if (ratio > 0.55 && this.level > QUALITY_FLOOR) {
      this.level = Math.max(QUALITY_FLOOR, this.level - 0.1);
      this.onChange(this.level);
    }
  }
}
