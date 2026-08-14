/**
 * Tera — the scroll timeline.
 *
 * The page is scrolled natively. Nothing is hijacked, nothing is snapped.
 * Each cinematic scene is a tall section containing a sticky, viewport-tall
 * stage; scrolling through the section plays the scene inside the stage.
 *
 * The whole experience reads one number from here: `cursor`, in [0, N].
 * Scene `i` owns [i, i+1]. Between two scenes (the editorial passages) the
 * cursor rests exactly on the boundary — that is where the silence lives.
 */

import { clamp, damp } from './math.js';
import { LAMBDA } from './durations.js';

export class Timeline {
  /**
   * @param {string[]} order scene ids, in document order
   * @param {{reduced?: boolean}} [options]
   */
  constructor(order, { reduced = false } = {}) {
    this.order = order;
    this.count = order.length;
    this.reduced = reduced;

    /** @type {{start:number,end:number,base:number,id:string,el:HTMLElement}[]} */
    this.segments = [];

    this.cursor = 0;
    this.target = 0;
    this.index = 0;
    this.id = order[0];
    this.local = 0;
    /** Raw document scroll, 0..1 — drives the progress rule, not the scenes. */
    this.documentProgress = 0;
    /** 1 while a pinned stage owns the viewport, 0 during the passages. */
    this.stagePresence = 1;

    this._primed = false;
    this._lastWidth = 0;
    this._lastHeight = 0;
    this._listeners = new Set();
    this._measure = this._measure.bind(this);
    this._onResize = this._onResize.bind(this);
  }

  /**
   * An act is one pinned stage that several consecutive scenes share, declared
   * as `data-act="boot:1.2,idea:1,build:1.3"`. Scenes inside an act morph into
   * each other with no scroll-out between them — that is what makes the run
   * feel like one continuous thing rather than a stack of sections. The gaps
   * *between* acts are the editorial passages, and the silence.
   */
  mount(root = document) {
    this.acts = [...root.querySelectorAll('[data-act]')].map((el) => {
      const parts = el.dataset.act.split(',').map((chunk) => {
        const [id, weight] = chunk.split(':');
        return { id: id.trim(), weight: Number(weight) || 1 };
      }).filter((p) => this.order.indexOf(p.id) >= 0);
      const total = parts.reduce((sum, p) => sum + p.weight, 0) || 1;
      return { el, parts, total, start: 0, end: 1 };
    });

    this.segments = [];
    for (const act of this.acts) {
      let acc = 0;
      for (const part of act.parts) {
        const from = acc / act.total;
        acc += part.weight;
        this.segments.push({
          act,
          el: act.el,
          id: part.id,
          base: this.order.indexOf(part.id),
          from,
          to: acc / act.total,
          start: 0,
          end: 1,
        });
      }
    }
    this.segments.sort((a, b) => a.base - b.base);

    this._measure();
    addEventListener('resize', this._onResize, { passive: true });
    addEventListener('orientationchange', this._onResize, { passive: true });
    if (document.fonts?.ready) document.fonts.ready.then(this._measure);
    return this;
  }

  destroy() {
    removeEventListener('resize', this._onResize);
    removeEventListener('orientationchange', this._onResize);
    this._listeners.clear();
  }

  /** Fires with (id, index) whenever the dominant scene changes. */
  onScene(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _onResize() {
    const w = innerWidth;
    const h = innerHeight;
    // On touch devices the browser chrome collapsing changes innerHeight by
    // ~60-120px without anything actually reflowing. Re-measuring there makes
    // the timeline jump under the reader's thumb, so we ignore it.
    const chromeOnly =
      matchMedia('(pointer: coarse)').matches &&
      w === this._lastWidth &&
      Math.abs(h - this._lastHeight) < 140;
    this._lastWidth = w;
    this._lastHeight = h;
    if (chromeOnly) return;
    this._measure();
  }

  _measure() {
    const doc = document.documentElement;
    const pageY = scrollY;
    for (const act of this.acts) {
      const stage = act.el.querySelector('[data-stage]');
      act.start = act.el.getBoundingClientRect().top + pageY;
      act.height = act.el.offsetHeight;
      // The stage is pinned for exactly this distance; past it the act scrolls
      // away and the next passage takes over.
      act.travel = Math.max(1, act.height - (stage?.offsetHeight || innerHeight));
    }
    for (const seg of this.segments) {
      seg.start = seg.act.start + seg.act.travel * seg.from;
      seg.end = seg.act.start + seg.act.travel * seg.to;
      if (seg.end - seg.start < 1) seg.end = seg.start + 1;
    }
    this._lastWidth = innerWidth;
    this._lastHeight = innerHeight;
    this._maxScroll = Math.max(1, doc.scrollHeight - innerHeight);
    this.read();
    if (!this._primed) {
      this.cursor = this.target;
      this._primed = true;
    }
  }

  /** Recomputes the target cursor from the current scroll position. */
  read() {
    const y = scrollY;
    this.documentProgress = clamp(y / (this._maxScroll || 1));

    // How much of the viewport a pinned stage currently owns. 1 while a scene
    // is playing, falling to 0 through the editorial passages — which is what
    // lets the Core step back and let the reading happen.
    const vh = innerHeight;
    let presence = 0;
    for (const act of this.acts) {
      const top = act.start - y;
      const overlap = Math.min(top + act.height, vh) - Math.max(top, 0);
      presence = Math.max(presence, clamp(overlap / vh));
    }
    this.stagePresence = presence;

    const segs = this.segments;
    if (!segs.length) {
      this.target = 0;
      return;
    }
    if (y <= segs[0].start) {
      this.target = segs[0].base;
      return;
    }
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (y <= s.end) {
        this.target = s.base + clamp((y - s.start) / (s.end - s.start));
        return;
      }
      const next = segs[i + 1];
      if (!next || y < next.start) {
        // Resting on the boundary: an editorial passage between two scenes.
        this.target = s.base + 1;
        if (next) return;
      }
    }
    this.target = Math.min(this.count, segs[segs.length - 1].base + 1);
  }

  /** @param {number} dt seconds */
  update(dt) {
    this.read();
    this.cursor = this.reduced
      ? this.target
      : damp(this.cursor, this.target, LAMBDA.scroll, dt);

    const clamped = clamp(this.cursor, 0, this.count - 0.0001);
    const idx = Math.floor(clamped);
    this.local = clamped - idx;
    if (idx !== this.index) {
      this.index = idx;
      this.id = this.order[idx];
      for (const fn of this._listeners) fn(this.id, idx);
    }
    return this;
  }

  /** Progress of a named scene, 0..1, regardless of where we are now. */
  progressOf(id) {
    const base = this.order.indexOf(id);
    if (base < 0) return 0;
    return clamp(this.cursor - base);
  }

  /** 1 while the named scene is on screen, falling off to either side. */
  weightOf(id, falloff = 0.5) {
    const base = this.order.indexOf(id);
    if (base < 0) return 0;
    const d = this.cursor - (base + 0.5);
    return clamp(1 - Math.abs(d) / (0.5 + falloff));
  }
}
