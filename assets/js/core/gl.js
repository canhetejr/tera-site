/**
 * Tera — small WebGL2 helpers.
 * Deliberately not a framework: three programs, one quad, instanced draws.
 */

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false, // we anti-alias analytically in the fragment shaders
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  // Colours leave the fragment shaders premultiplied so the canvas composites
  // exactly over the page background, whatever the background currently is.
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return gl;
}

function compile(gl, type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`[tera-core] ${label} shader: ${log}`);
  }
  return shader;
}

export function createProgram(gl, vertexSource, fragmentSource, label = 'program') {
  const vs = compile(gl, gl.VERTEX_SHADER, vertexSource, `${label} vertex`);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label} fragment`);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`[tera-core] ${label} link: ${log}`);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

/** A unit quad in [-0.5, 0.5], shared by every instanced draw. */
export function createQuad(gl) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
    gl.STATIC_DRAW
  );
  return buffer;
}

export function createStream(gl, byteLength) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, byteLength, gl.DYNAMIC_DRAW);
  return buffer;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {{buffer: WebGLBuffer, attributes: {loc:number,size:number,offset:number}[],
 *          stride:number, divisor:number}[]} bindings
 */
export function createVAO(gl, bindings) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  for (const binding of bindings) {
    gl.bindBuffer(gl.ARRAY_BUFFER, binding.buffer);
    for (const attr of binding.attributes) {
      gl.enableVertexAttribArray(attr.loc);
      gl.vertexAttribPointer(attr.loc, attr.size, gl.FLOAT, false, binding.stride, attr.offset);
      gl.vertexAttribDivisor(attr.loc, binding.divisor);
    }
  }
  gl.bindVertexArray(null);
  return vao;
}
