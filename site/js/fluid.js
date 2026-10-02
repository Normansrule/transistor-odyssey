// Stable-fluids hero (Stam 1999) in WebGL2, written for this project.
// Design inspiration: PavelDoGreat/WebGL-Fluid-Simulation. Colours follow the
// "yellow room" palette: amber lithography light, copper, and wafer teal.

const SIM_RES = 128, DYE_RES = 512, PRESSURE_ITERS = 20;
const COLORS = [[0.95, 0.72, 0.29], [0.85, 0.51, 0.36], [0.50, 0.83, 0.82], [0.71, 0.56, 0.84]];

export function startFluid(canvas) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) { staticFallback(canvas); return null; }
  gl.getExtension('OES_texture_float_linear');

  const vs = `#version 300 es
  in vec2 aPos; out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB; uniform vec2 texel;
  void main(){ vUv = aPos*0.5+0.5; vL=vUv-vec2(texel.x,0.); vR=vUv+vec2(texel.x,0.); vT=vUv+vec2(0.,texel.y); vB=vUv-vec2(0.,texel.y); gl_Position=vec4(aPos,0.,1.); }`;
  const head = `#version 300 es
  precision highp float; precision highp sampler2D;
  in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB; out vec4 o;`;
  const FS = {
    splat: head + `uniform sampler2D uTarget; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;
      void main(){ vec2 p=vUv-point; p.x*=aspect; vec3 s=exp(-dot(p,p)/radius)*color; o=vec4(texture(uTarget,vUv).xyz+s,1.); }`,
    advect: head + `uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texel; uniform float dt; uniform float dissipation;
      void main(){ vec2 c=vUv-dt*texture(uVelocity,vUv).xy*texel; o=texture(uSource,c)/(1.+dissipation*dt); }`,
    divergence: head + `uniform sampler2D uVelocity;
      void main(){ float L=texture(uVelocity,vL).x, R=texture(uVelocity,vR).x, T=texture(uVelocity,vT).y, B=texture(uVelocity,vB).y;
      vec2 C=texture(uVelocity,vUv).xy; if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; o=vec4(0.5*(R-L+T-B),0.,0.,1.); }`,
    curl: head + `uniform sampler2D uVelocity;
      void main(){ float L=texture(uVelocity,vL).y, R=texture(uVelocity,vR).y, T=texture(uVelocity,vT).x, B=texture(uVelocity,vB).x; o=vec4(0.5*(R-L-T+B),0.,0.,1.); }`,
    vorticity: head + `uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
      void main(){ float L=texture(uCurl,vL).x, R=texture(uCurl,vR).x, T=texture(uCurl,vT).x, B=texture(uCurl,vB).x, C=texture(uCurl,vUv).x;
      vec2 f=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+1e-4; f*=curl*C; f.y*=-1.;
      vec2 v=texture(uVelocity,vUv).xy+f*dt; o=vec4(clamp(v,-1000.,1000.),0.,1.); }`,
    pressure: head + `uniform sampler2D uPressure; uniform sampler2D uDivergence;
      void main(){ float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x, T=texture(uPressure,vT).x, B=texture(uPressure,vB).x;
      o=vec4((L+R+B+T-texture(uDivergence,vUv).x)*0.25,0.,0.,1.); }`,
    gradient: head + `uniform sampler2D uPressure; uniform sampler2D uVelocity;
      void main(){ float L=texture(uPressure,vL).x, R=texture(uPressure,vR).x, T=texture(uPressure,vT).x, B=texture(uPressure,vB).x;
      vec2 v=texture(uVelocity,vUv).xy-vec2(R-L,T-B); o=vec4(v,0.,1.); }`,
    clear: head + `uniform sampler2D uTexture; uniform float value; void main(){ o=value*texture(uTexture,vUv); }`,
    display: head + `uniform sampler2D uTexture;
      void main(){ vec3 c=texture(uTexture,vUv).rgb; c=1.0-exp(-c*1.6); float a=max(c.r,max(c.g,c.b)); o=vec4(c, clamp(a*0.9,0.,0.75)); }`,
  };

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vShader = compile(gl.VERTEX_SHADER, vs);
  const programs = {};
  for (const [k, src] of Object.entries(FS)) {
    const p = gl.createProgram();
    gl.attachShader(p, vShader); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    programs[k] = { p, u };
  }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  const ibuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);

  function fbo(w, h, internal, format) {
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex, fb, w, h, tx: 1 / w, ty: 1 / h, attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
  }
  function dbl(w, h, i, f) {
    let a = fbo(w, h, i, f), b = fbo(w, h, i, f);
    return { get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; }, w, h, tx: 1 / w, ty: 1 / h };
  }
  function res(r) {
    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const min = Math.round(r), max = Math.round(r * Math.max(aspect, 1 / aspect));
    return aspect > 1 ? [max, min] : [min, max];
  }
  let velocity, dye, divergence, curl, pressure;
  function init() {
    const [sw, sh] = res(SIM_RES), [dw, dh] = res(DYE_RES);
    velocity = dbl(sw, sh, gl.RG16F, gl.RG); dye = dbl(dw, dh, gl.RGBA16F, gl.RGBA);
    divergence = fbo(sw, sh, gl.R16F, gl.RED); curl = fbo(sw, sh, gl.R16F, gl.RED); pressure = dbl(sw, sh, gl.R16F, gl.RED);
  }
  function blit(target) {
    if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }
  function use(name) { const pr = programs[name]; gl.useProgram(pr.p); return pr.u; }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; init(); }
  }

  function splat(x, y, dx, dy, color, radius = 0.0025) {
    let u = use('splat');
    gl.uniform2f(u.texel, velocity.tx, velocity.ty);
    gl.uniform1i(u.uTarget, velocity.read.attach(0)); gl.uniform1f(u.aspect, canvas.width / canvas.height);
    gl.uniform2f(u.point, x, y); gl.uniform3f(u.color, dx, dy, 0); gl.uniform1f(u.radius, radius);
    blit(velocity.write); velocity.swap();
    gl.uniform1i(u.uTarget, dye.read.attach(0)); gl.uniform3f(u.color, ...color); blit(dye.write); dye.swap();
  }

  function step(dt) {
    gl.disable(gl.BLEND);
    let u = use('curl'); gl.uniform2f(u.texel, velocity.tx, velocity.ty); gl.uniform1i(u.uVelocity, velocity.read.attach(0)); blit(curl);
    u = use('vorticity'); gl.uniform2f(u.texel, velocity.tx, velocity.ty); gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uCurl, curl.attach(1)); gl.uniform1f(u.curl, 22); gl.uniform1f(u.dt, dt); blit(velocity.write); velocity.swap();
    u = use('divergence'); gl.uniform2f(u.texel, velocity.tx, velocity.ty); gl.uniform1i(u.uVelocity, velocity.read.attach(0)); blit(divergence);
    u = use('clear'); gl.uniform2f(u.texel, velocity.tx, velocity.ty); gl.uniform1i(u.uTexture, pressure.read.attach(0)); gl.uniform1f(u.value, 0.8); blit(pressure.write); pressure.swap();
    u = use('pressure'); gl.uniform2f(u.texel, velocity.tx, velocity.ty); gl.uniform1i(u.uDivergence, divergence.attach(0));
    for (let i = 0; i < PRESSURE_ITERS; i++) { gl.uniform1i(u.uPressure, pressure.read.attach(1)); blit(pressure.write); pressure.swap(); }
    u = use('gradient'); gl.uniform2f(u.texel, velocity.tx, velocity.ty); gl.uniform1i(u.uPressure, pressure.read.attach(0));
    gl.uniform1i(u.uVelocity, velocity.read.attach(1)); blit(velocity.write); velocity.swap();
    u = use('advect'); gl.uniform2f(u.texel, velocity.tx, velocity.ty);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0)); gl.uniform1i(u.uSource, velocity.read.attach(0));
    gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, 0.25); blit(velocity.write); velocity.swap();
    gl.uniform2f(u.texel, velocity.tx, velocity.ty);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0)); gl.uniform1i(u.uSource, dye.read.attach(1));
    gl.uniform1f(u.dissipation, 0.45); blit(dye.write); dye.swap();
  }
  function render() {
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const u = use('display'); gl.uniform2f(u.texel, 1 / canvas.width, 1 / canvas.height);
    gl.uniform1i(u.uTexture, dye.read.attach(0)); blit(null);
  }

  resize();
  const pick = (k = 0.35) => COLORS[(Math.random() * COLORS.length) | 0].map(c => c * k);
  // seed: a sweep of light across the wafer
  for (let i = 0; i < 7; i++) splat(0.1 + i * 0.13, 0.35 + 0.3 * Math.sin(i), 900 * (Math.random() - 0.3), 600 * (Math.random() - 0.5), pick(), 0.006);

  let last = performance.now(), visible = true, ambient = 0, pointer = null;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(canvas);
  const host = canvas.parentElement;
  const move = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (pointer) splat(x, y, (x - pointer.x) * 3200, (y - pointer.y) * 3200, pointer.c, 0.0016);
    pointer = { x, y, c: pointer?.c || pick(0.12) };
  };
  host.addEventListener('pointermove', move, { passive: true });
  host.addEventListener('pointerdown', (e) => { pointer = null; move(e); pointer.c = pick(0.12); });
  host.addEventListener('pointerleave', () => { pointer = null; });

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    if (visible) {
      resize();
      ambient += dt;
      if (ambient > 0.9) { ambient = 0; const a = Math.random() * Math.PI * 2; splat(0.15 + Math.random() * 0.7, 0.2 + Math.random() * 0.6, Math.cos(a) * 700, Math.sin(a) * 700, pick(), 0.006); }
      step(dt); render();
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  if (reduce) { for (let i = 0; i < 40; i++) step(1 / 60); render(); }
  else requestAnimationFrame(frame);
  return { splat };
}

function staticFallback(canvas) {
  canvas.style.background = 'radial-gradient(800px 400px at 25% 40%, rgba(242,184,75,.22), transparent 60%), radial-gradient(700px 380px at 75% 60%, rgba(127,211,208,.16), transparent 60%)';
}
