/**
 * Tera — easing vocabulary.
 * One place for every curve in the experience. No magic numbers in scenes.
 */

/** Material settling into place: fast commitment, long resolve. */
export const settle = (t) => 1 - Math.pow(1 - t, 4);

/** Something arriving from nothing — slow to start, decisive at the end. */
export const emerge = (t) => t * t * t;

/** Standard both-ends curve for camera work. */
export const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Softer both-ends curve for environment and colour drifts. */
export const drift = (t) => t * t * (3 - 2 * t);

/** A single mechanical snap — used when an element locks to the grid. */
export const snap = (t) => 1 - Math.pow(1 - t, 6);

/** Rises and returns: for pulses travelling through the system. */
export const pulse = (t) => Math.sin(Math.PI * Math.min(Math.max(t, 0), 1));

/** Overshoots once, minimally. Physical, never bouncy. */
export const press = (t) => {
  const c = 1.28;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** CSS equivalents, so DOM transitions share the vocabulary. */
export const css = {
  settle: 'cubic-bezier(0.16, 1, 0.3, 1)',
  emerge: 'cubic-bezier(0.32, 0, 0.67, 0)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  drift: 'cubic-bezier(0.4, 0, 0.2, 1)',
  press: 'cubic-bezier(0.34, 1.28, 0.64, 1)',
};
