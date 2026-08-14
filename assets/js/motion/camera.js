/**
 * Tera — camera rig.
 *
 * Reads the timeline, produces view/projection matrices. Pointer input only
 * ever adds a small offset on top of the scored position: the scroll is the
 * director, the pointer is a breath.
 */

import { mat4, perspective, lookAt, multiply, lerp, damp, clamp } from './math.js';
import { inOut } from './easings.js';
import { LAMBDA } from './durations.js';
import { SCENES } from './scenes.js';

export class Camera {
  constructor({ fov = 36, near = 0.5, far = 400, reduced = false } = {}) {
    this.fov = (fov * Math.PI) / 180;
    this.near = near;
    this.far = far;
    this.reduced = reduced;

    this.eye = new Float32Array([0, 0, 34]);
    this.look = new Float32Array([0, 0, 0]);
    this.up = new Float32Array([0, 1, 0]);

    this.view = mat4();
    this.proj = mat4();
    this.viewProj = mat4();

    this.pointer = { x: 0, y: 0 };
    this._pointer = { x: 0, y: 0 };

    /** Scales how far the camera actually travels. Lowered on small screens. */
    this.travel = 1;
    /** Extra pull-back so the same structures fit a narrow viewport. */
    this.distance = 1;
    this.parallax = 1;
  }

  setPointer(x, y) {
    this.pointer.x = clamp(x, -1, 1);
    this.pointer.y = clamp(y, -1, 1);
  }

  /**
   * @param {import('./timeline.js').Timeline} tl
   * @param {number} dt seconds
   * @param {number} width drawing buffer width (device px)
   * @param {number} height drawing buffer height (device px)
   */
  update(tl, dt, width, height) {
    const i = Math.min(tl.index, SCENES.length - 1);
    const scene = SCENES[i];
    // Most scenes want the standard both-ends curve. A scene may name its own
    // when the camera has to arrive early and then hold — the mark has to be
    // framed and still for most of its scene, not still arriving at the end.
    const ease = scene.camera.ease || inOut;
    const t = this.reduced ? Math.round(tl.local) : ease(tl.local);

    const from = scene.camera.from;
    const to = scene.camera.to;
    const lookFrom = scene.camera.look;
    const lookTo = scene.camera.lookTo;

    const ex = lerp(from[0], to[0], t) * this.travel;
    const ey = lerp(from[1], to[1], t) * this.travel;
    const ez = lerp(from[2], to[2], t) * this.distance;

    const lx = lerp(lookFrom[0], lookTo[0], t) * this.travel;
    const ly = lerp(lookFrom[1], lookTo[1], t) * this.travel;
    const lz = lerp(lookFrom[2], lookTo[2], t);

    const k = this.reduced ? 0 : this.parallax;
    this._pointer.x = damp(this._pointer.x, this.pointer.x * k, LAMBDA.pointer, dt);
    this._pointer.y = damp(this._pointer.y, this.pointer.y * k, LAMBDA.pointer, dt);

    // Parallax scales with distance so close-up scenes stay stable and the
    // wide shots keep a sense of volume. Deliberately small: a composition
    // that swings when the reader moves the mouse is not a composition, and
    // at the far end of the range the old amounts moved the whole scene by
    // more than two world units. This is a breath, not a camera move.
    const depth = clamp(ez / 40, 0.35, 1.15);
    this.eye[0] = ex + this._pointer.x * 0.62 * depth;
    this.eye[1] = ey - this._pointer.y * 0.4 * depth;
    this.eye[2] = ez;
    this.look[0] = lx + this._pointer.x * 0.13 * depth;
    this.look[1] = ly - this._pointer.y * 0.08 * depth;
    this.look[2] = lz;

    const aspect = width / Math.max(1, height);
    perspective(this.proj, this.fov, aspect, this.near, this.far);
    lookAt(this.view, this.eye, this.look, this.up);
    multiply(this.viewProj, this.proj, this.view);
    return this;
  }
}
