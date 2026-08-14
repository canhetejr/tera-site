/**
 * Tera — timing tokens (seconds unless stated).
 * Scenes reference these names; nothing hard-codes a duration.
 */

export const D = {
  /** Micro interactions: hover, focus, magnetic response. */
  micro: 0.18,
  /** A control reacting to input. */
  react: 0.32,
  /** An element entering or leaving a composition. */
  enter: 0.72,
  /** A surface changing what it is. */
  transform: 1.1,
  /** Environment (background, palette) drifting between states. */
  environment: 1.6,
};

/** Damping speeds for the rAF loop — higher is tighter. */
export const LAMBDA = {
  /** Camera follows the scroll timeline closely but never snaps. */
  camera: 7.5,
  /** Pointer parallax: loose, so it feels like inertia, not tracking. */
  pointer: 4.2,
  /** Palette / environment crossfade. */
  environment: 3.4,
  /** Scroll progress smoothing — removes wheel steppiness without lag. */
  scroll: 12,
};

/** How much later the last node in a morph arrives, relative to the first. */
export const STAGGER = {
  /** Fraction of a scene spent staggering node arrivals. */
  spread: 0.42,
};

/** Idle life: amplitude and speed of the drift that never stops. */
export const AMBIENT = {
  amplitude: 0.055,
  speed: 0.12,
};
