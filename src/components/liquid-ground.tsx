"use client";

import { useEffect, useRef } from "react";

/**
 * The moving ground behind the page: a slow full-spectrum liquid.
 *
 * Raw WebGL2, one fullscreen triangle, one fragment shader, no dependency.
 *
 * ## What keeps the text readable
 *
 * Not this file. A `backdrop-filter` partition (`.partition` in globals.css)
 * blurs and tints the content column, and that is what 10px ash labels actually
 * sit on. The shader's only remaining obligation is to look like liquid, so it
 * spends nothing on legibility: two octaves, no column-specific blur, no
 * luminance vignette. Measured contrast for the small text is in the commit that
 * introduced the partition.
 *
 * ## Why two octaves
 *
 * Three while the column was being darkened in the shader, because the column
 * needed its own blur and nothing else was doing it. Now that a real glass
 * partition blurs the whole column, the shader no longer needs a per-column
 * blur at all. Two octaves is also what lets the colour blend rather than band:
 * the third octave carried enough high-frequency structure to keep the colour
 * stops reading as separate ribbons.
 *
 * ## Why dither
 *
 * A smooth dark ramp across a whole viewport bands visibly at 8 bits per
 * channel. A fraction of a code value of noise per pixel removes it, and costs
 * nothing. Without it the ground looks like a broken gradient, not like ink.
 */

// the pane's saturate(), which the output pass applies. --frost-sat in the
// stylesheet is the one place to change it; this is only the fallback.
const SATURATION_FALLBACK = 5;

const VERT = `#version 300 es
// fullscreen triangle from gl_VertexID: no attributes, no buffers
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// The field, drawn small. uRes is the viewport in page pixels; the target it
// draws into is a fraction of that, so everything below is in page pixels
// whatever the target size is.
const FRAG_FIELD = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform vec2  uTarget;
uniform float uTime;
uniform float uScroll;
uniform float uGain;

out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  // quintic, not cubic. The cubic smoothstep leaves a crease at every lattice
  // point, which a still frame hides and a moving one does not.
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 2; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.42;
  }
  return v * 1.16;
}

void main() {
  vec2 frag = gl_FragCoord.xy / uTarget * uRes;
  vec2 uv = frag / uRes;

  // one noise unit spans about two thirds of the viewport height, and the field
  // slides with the document: the pattern is locked to the page rather than to
  // the screen, which is why the scroll term is a straight pixel translation.
  const float S = 1.5;
  vec2 p = (frag - 0.5 * uRes) / uRes.y * S;
  p.y -= uScroll * S / uRes.y;

  // 0.3, not the original 0.035: at that rate the field drifted one noise
  // unit per ~30s, which reads as a still image. Clearly alive, still liquid
  // rather than boiling.
  float t = uTime * 0.3;

  // one domain warp rather than two. The second warp was what made this read
  // as smoke curling; at this scale a single soft warp is what reads as liquid.
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
  float f = fbm(p + 1.8 * q);

  // The spectrum, blended rather than banded.
  //
  // Each stop fades in over a window wider than the gap to the next one, so
  // neighbouring inks are both partly present at almost any point on the ramp
  // and the result is a continuous wash. Stepping between stops with barely any
  // overlap gives ribbons of colour, which is a poster of a spectrum.
  float u = clamp((f - 0.16) / 0.52, 0.0, 1.0);
  vec3 col = vec3(0.020, 0.012, 0.018);
  col = mix(col, vec3(0.520, 0.045, 0.055), smoothstep(-0.06, 0.19, u)); // blood
  col = mix(col, vec3(0.820, 0.190, 0.045), smoothstep(0.08, 0.33, u));  // ember
  col = mix(col, vec3(0.840, 0.610, 0.090), smoothstep(0.22, 0.47, u));  // yellow
  col = mix(col, vec3(0.090, 0.430, 0.170), smoothstep(0.36, 0.61, u));  // green
  col = mix(col, vec3(0.040, 0.330, 0.380), smoothstep(0.50, 0.75, u));  // teal
  col = mix(col, vec3(0.110, 0.090, 0.480), smoothstep(0.64, 0.89, u));  // blue
  col = mix(col, vec3(0.330, 0.070, 0.430), smoothstep(0.78, 1.03, u));  // violet
  col = mix(col, vec3(0.020, 0.012, 0.018), smoothstep(0.92, 1.16, u));  // to black
  col *= uGain;

  // a whisper of a dip under the content column, where the glass is thinnest at
  // the very top and bottom of the page
  col *= 1.0 - 0.12 * (1.0 - smoothstep(0.62, 0.99, abs(uv.x - 0.5) * 2.0));
  col *= 1.0 - 0.10 * smoothstep(0.55, 1.0, abs(uv.y - 0.5) * 2.0);

  outColor = vec4(col, 1.0);
}`;

// A separable gaussian over the small field, standing in for the blur(34px)
// the frosted pane used to apply to a full-size canvas every frame. Mirrored
// at the edges, as the compositor's backdrop blur is.
const FRAG_BLUR = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2  uDir;     // one texel along the axis being blurred
uniform float uSigma;   // in texels

out vec4 outColor;

void main() {
  ivec2 size = textureSize(uSrc, 0);
  ivec2 here = ivec2(gl_FragCoord.xy);
  ivec2 step = ivec2(uDir);
  int reach = int(ceil(uSigma * 3.0));
  vec4 sum = vec4(0.0);
  float norm = 0.0;
  for (int i = -reach; i <= reach; i++) {
    ivec2 at = here + step * i;
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    norm += w;
    // past the edge there is nothing to blur. The compositor's backdrop blur
    // fades out there instead of repeating the edge, so keep the colour
    // premultiplied and the coverage in alpha, and let the last pass lay it
    // over the page's own wash
    if (at.x < 0 || at.y < 0 || at.x >= size.x || at.y >= size.y) continue;
    sum += texelFetch(uSrc, at, 0) * w;
  }
  outColor = sum / norm;
}`;

// The last step: the blurred field up to the canvas, then what the pane's
// saturate(5) did to it, then a fraction of a code value of noise so the
// smooth dark ramp does not band at 8 bits.
const FRAG_OUT = `#version 300 es
precision highp float;

uniform sampler2D uSrc;
uniform vec2  uTarget;
uniform float uSat;

out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec4 t = texture(uSrc, gl_FragCoord.xy / uTarget);
  vec3 c = t.rgb / max(t.a, 1e-4);
  // the CSS saturate() matrix, in sRGB values as the filter works
  vec3 g = vec3(
    dot(c, vec3(0.213 + 0.787 * uSat, 0.715 - 0.715 * uSat, 0.072 - 0.072 * uSat)),
    dot(c, vec3(0.213 - 0.213 * uSat, 0.715 + 0.285 * uSat, 0.072 - 0.072 * uSat)),
    dot(c, vec3(0.213 - 0.213 * uSat, 0.715 - 0.715 * uSat, 0.072 + 0.928 * uSat)));
  g = clamp(g, 0.0, 1.0);
  // where the blur faded out at the edge of the viewport, the page's own wash
  // (the body's .xerox, about this grey) shows through, as it did behind the pane
  g = mix(vec3(0.22, 0.20, 0.20), g, t.a);
  g += (hash(gl_FragCoord.xy * 0.7) - 0.5) * (1.6 / 255.0);
  outColor = vec4(g, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function LiquidGround() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    // Built detached and only attached once it can actually draw. Appending
    // first would leave an empty canvas in the DOM on every machine without
    // webgl2, and React StrictMode double-invokes effects in development, so
    // the first pass's cleanup would hand the context back with
    // WEBGL_lose_context and the second pass would compile against a dead one.
    // A fresh canvas per mount gives each pass its own context.
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:-10";

    const gl = canvas.getContext("webgl2", {
      // opaque: every pixel is written with alpha 1, and the first frame is
      // drawn in the same task that attaches the canvas, so nothing can show
      // black. Opaque also lets the compositor skip blending it.
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });

    // No webgl2: nothing is attached and the body's .xerox wash stands in.
    if (!gl) return;

    el.appendChild(canvas);

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fsField = compile(gl, gl.FRAGMENT_SHADER, FRAG_FIELD);
    const fsBlur = compile(gl, gl.FRAGMENT_SHADER, FRAG_BLUR);
    const fsOut = compile(gl, gl.FRAGMENT_SHADER, FRAG_OUT);
    if (!vs || !fsField || !fsBlur || !fsOut) return;

    const link = (fs: WebGLShader) => {
      const prog = gl.createProgram();
      if (!prog) return null;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(prog));
        return null;
      }
      return prog;
    };
    const pField = link(fsField);
    const pBlur = link(fsBlur);
    const pOut = link(fsOut);
    if (!pField || !pBlur || !pOut) return;

    const u = (prog: WebGLProgram, name: string) => gl.getUniformLocation(prog, name);
    const uField = {
      res: u(pField, "uRes"),
      target: u(pField, "uTarget"),
      time: u(pField, "uTime"),
      scroll: u(pField, "uScroll"),
      gain: u(pField, "uGain"),
    };
    const uBlur = { src: u(pBlur, "uSrc"), dir: u(pBlur, "uDir"), sigma: u(pBlur, "uSigma") };
    const uOut = { src: u(pOut, "uSrc"), target: u(pOut, "uTarget"), sat: u(pOut, "uSat") };

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ## Where the frosted pane's blur went
    //
    // The pane over the content used to blur(34px) and saturate(5) this canvas,
    // and the compositor redid that on a full-viewport backdrop every frame:
    // measured, it was the largest single cost on the page. The pane's blur
    // only ever sees this canvas, so it is done here instead, on the field
    // drawn at a tenth of the size where it costs almost nothing:
    //
    //   field (1/10 size) -> gaussian, 34px worth, two passes -> up to the
    //   canvas with the same saturate(5) -> dither
    //
    // The blurred result is smooth, so the canvas itself is half size and the
    // browser scales it up. The pane keeps its tint and grain and loses only
    // the backdrop-filter (html[data-ground], globals.css); without webgl2
    // nothing here runs and the pane still blurs the CSS wash as before.
    const DOWN = 10; // page px per field texel
    const SIGMA_PX = 34; // the pane's blur radius, which CSS reads as a sigma
    const OUT_SCALE = 0.5;

    // 16-bit targets where the browser can render to them, so the blur does
    // not add banding of its own; 8-bit otherwise
    let half = !!gl.getExtension("EXT_color_buffer_half_float") || !!gl.getExtension("EXT_color_buffer_float");
    const makeTarget = () => {
      const tex = gl.createTexture()!;
      const fbo = gl.createFramebuffer()!;
      return { tex, fbo, w: 0, h: 0 };
    };
    const A = makeTarget();
    const B = makeTarget();
    const size = (t: ReturnType<typeof makeTarget>, w: number, h: number) => {
      if (t.w === w && t.h === h) return;
      t.w = w;
      t.h = h;
      for (let attempt = 0; attempt < 2; attempt++) {
        allocate(t, w, h);
        // a driver that cannot render to 16-bit gets 8-bit instead of a black page
        if (!half || gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) return;
        half = false;
      }
    };
    const allocate = (t: ReturnType<typeof makeTarget>, w: number, h: number) => {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    };

    let raf = 0;
    let disposed = false;
    const start = performance.now();
    const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--frost-sat"));
    const saturation = Number.isFinite(sat) && sat > 0 ? sat : SATURATION_FALLBACK;

    const draw = (t: number) => {
      const vw = Math.max(1, canvas.clientWidth);
      const vh = Math.max(1, canvas.clientHeight);
      const fw = Math.max(2, Math.ceil(vw / DOWN));
      const fh = Math.max(2, Math.ceil(vh / DOWN));
      const ow = Math.max(1, Math.round(vw * OUT_SCALE));
      const oh = Math.max(1, Math.round(vh * OUT_SCALE));
      if (canvas.width !== ow || canvas.height !== oh) {
        canvas.width = ow;
        canvas.height = oh;
      }
      size(A, fw, fh);
      size(B, fw, fh);

      // 1. the field into A
      gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
      gl.viewport(0, 0, fw, fh);
      gl.useProgram(pField);
      gl.uniform2f(uField.res, vw, vh);
      gl.uniform2f(uField.target, fw, fh);
      gl.uniform1f(uField.time, t);
      gl.uniform1f(uField.scroll, window.scrollY);
      gl.uniform1f(uField.gain, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 2. across A into B, 3. down B into A
      gl.useProgram(pBlur);
      gl.uniform1i(uBlur.src, 0);
      gl.uniform1f(uBlur.sigma, SIGMA_PX / DOWN);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.fbo);
      gl.uniform2f(uBlur.dir, 1, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, B.tex);
      gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
      gl.uniform2f(uBlur.dir, 0, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 4. A up to the canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, ow, oh);
      gl.useProgram(pOut);
      gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.uniform1i(uOut.src, 0);
      gl.uniform2f(uOut.target, ow, oh);
      gl.uniform1f(uOut.sat, saturation);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const time = () => (performance.now() - start) / 1000;

    // A single frame, drawn before the animation loop starts: the page never
    // sits on an empty canvas.
    draw(0);
    // the pane's own blur is now redundant (globals.css)
    document.documentElement.dataset.ground = "gl";
    const release = () => {
      delete document.documentElement.dataset.ground;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };

    if (calm) {
      // no autonomous motion. The scroll-linked shift is not animation, it is
      // the document moving, so redraw on scroll and leave it there.
      let queued = 0;
      const onScroll = () => {
        if (queued) return;
        queued = requestAnimationFrame(() => {
          queued = 0;
          draw(time());
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      return () => {
        disposed = true;
        if (queued) cancelAnimationFrame(queued);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        release();
      };
    }

    // The liquid drifts about a hundred pixels a second, so at rest 30 frames
    // a second shows the same picture as 60 and halves what the browser has
    // to recompose behind the page. While the page scrolls the field is locked
    // to it, so then every frame is drawn, or the ground would lag the text
    // it sits behind.
    let lastDraw = 0;
    let lastScroll = window.scrollY;

    const loop = (now: number) => {
      if (disposed) return;
      const y = window.scrollY;
      const moving = y !== lastScroll;
      lastScroll = y;
      if (moving || now - lastDraw >= 28) {
        lastDraw = now;
        draw(time());
      }
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (raf || disposed) return;
      raf = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // a background that burns frames while the tab is closed is the whole
    // reason the old shader had to go
    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    startLoop();

    return () => {
      disposed = true;
      stopLoop();
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, []);

  return <div ref={host} aria-hidden />;
}