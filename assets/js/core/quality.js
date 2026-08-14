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
    grain: true,
  },
  medium: {
    name: 'medium',
    nodes: 720,
    segments: 560,
    panels: 44,
    dpr: 1.6,
    parallax: 0.75,
    travel: 0.9,
    distance: 1.02,
    ambient: 0.8,
    grain: true,
  },
  low: {
    name: 'low',
    nodes: 420,
    segments: 300,
    panels: 32,
    dpr: 1.4,
    parallax: 0,
    travel: 0.55,
    distance: 1.16,
    ambient: 0.55,
    grain: false,
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
    if (ratio > 0.55 && this.level > 0.45) {
      this.level = Math.max(0.45, this.level - 0.2);
      this.onChange(this.level);
    }
  }
}
