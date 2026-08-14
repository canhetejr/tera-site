/**
 * Tera — scene bindings.
 *
 * The pieces of DOM that are *part of* a scene rather than laid out beside it:
 * the build counter, the flow trace, the status that flips from prototype to
 * ready. They read the same timeline as the camera, so nothing can fall out
 * of sync with the structure behind them.
 *
 * Every write is guarded — this runs 60 times a second and must not touch the
 * DOM unless something actually changed.
 */

import { clamp } from './math.js';

/** Sub-ranges inside a scene, in scene-local progress. */
const AT = {
  /** BUILD: four stages, each locking in turn. */
  buildStep: (i) => 0.14 + i * 0.185,
  /** PRODUCT: the moment it stops being a prototype. */
  ready: 0.66,
  /** SYSTEMS: an event crossing five stations. */
  flowStep: (i) => 0.16 + i * 0.145,
};

function toggle(el, attr, value) {
  const next = String(value);
  if (el.dataset[attr] === next) return;
  el.dataset[attr] = next;
}

export function createBindings() {
  const buildSteps = [...document.querySelectorAll('[data-build]')];
  const buildDigit = document.querySelector('[data-build-step]');
  const flowSteps = [...document.querySelectorAll('[data-flow]')];
  const status = document.querySelector('[data-status]');
  const statusLabel = document.querySelector('[data-status-label]');

  let lastDigit = -1;
  let lastReady = null;

  return {
    /** @param {import('./timeline.js').Timeline} tl */
    update(tl) {
      /* --------------------------------------------------------- build */
      if (buildSteps.length) {
        const p = tl.progressOf('build');
        let done = 0;
        for (let i = 0; i < buildSteps.length; i++) {
          const on = p >= AT.buildStep(i);
          if (on) done = i + 1;
          toggle(buildSteps[i], 'on', on);
        }
        const digit = Math.max(1, done);
        if (buildDigit && digit !== lastDigit) {
          buildDigit.textContent = String(digit);
          lastDigit = digit;
        }
      }

      /* ------------------------------------------------------- product */
      if (status) {
        // The build is only "ready" once the product scene has resolved it,
        // and it stays ready for the rest of the page.
        const ready = tl.cursor >= tl.order.indexOf('product') + AT.ready;
        if (ready !== lastReady) {
          lastReady = ready;
          status.dataset.ready = String(ready);
          if (statusLabel) statusLabel.textContent = ready ? 'Em operação' : 'Protótipo';
        }
      }

      /* ------------------------------------------------------- systems */
      if (flowSteps.length) {
        const p = tl.progressOf('systems');
        for (let i = 0; i < flowSteps.length; i++) {
          toggle(flowSteps[i], 'on', p >= AT.flowStep(i));
        }
      }
    },
  };
}

export { AT, clamp };
