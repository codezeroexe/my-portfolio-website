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

const VERT = `#version 300 es
// fullscreen triangle from gl_VertexID: no attributes, no buffers
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uRes;
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
  vec2 uv = gl_FragCoord.xy / uRes;

  // one noise unit spans about two thirds of the viewport height, and the field
  // slides with the document: the pattern is locked to the page rather than to
  // the screen, which is why the scroll term is a straight pixel translation.
  const float S = 1.5;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * S;
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

  col += (hash(gl_FragCoord.xy * 0.7) - 0.5) * (1.6 / 255.0);

  outColor = vec4(col, 1.0);
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
      // alpha so the CSS fallback shows through until the first frame lands,
      // which is what stops a black flash on load
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });

    // No webgl2: nothing is attached and the body's .xerox wash stands in.
    if (!gl) return;

    el.appendChild(canvas);

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uScroll = gl.getUniformLocation(prog, "uScroll");
    const uGain = gl.getUniformLocation(prog, "uGain");

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // dpr is clamped to 1, not 1.5. The ground is now behind a frosted pane, so
    // its resolution is thrown away twice over: downsampled by the blur, then
    // composited behind a 62% tint. Rendering it at 1.5x costs 2.25x the
    // fragments to produce detail nobody can see. Measured with the pane in
    // place at 1440x900, the blur radius barely moved the frame time — 34px 47ms
    // against 14px 44ms — which says the cost was never the radius but the
    // compositor having a live backdrop to re-blend every frame.
    const dpr = coarse ? 1 : 1;
    let renderScale = 1;

    let raf = 0;
    let disposed = false;
    const start = performance.now();

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr * renderScale));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr * renderScale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const draw = (t: number) => {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uScroll, window.scrollY);
      gl.uniform1f(uGain, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const time = () => (performance.now() - start) / 1000;

    // A single frame, drawn before the animation loop starts: the page never
    // sits on an empty canvas.
    draw(0);

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
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      };
    }

    // Frame budget: sample the first 90 frames and drop resolution once if the
    // mean is over budget. One step, not a loop — a shader that is too slow at
    // 0.6 is not going to be rescued by 0.36.
    let frames = 0;
    let acc = 0;
    let last = performance.now();
    let stepped = false;

    const loop = (now: number) => {
      if (disposed) return;
      const dt = now - last;
      last = now;
      draw(time());

      if (!stepped) {
        acc += dt;
        frames++;
        if (frames >= 90) {
          stepped = true;
          if (acc / frames > 22) renderScale = 0.6;
        }
      }
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (raf || disposed) return;
      last = performance.now();
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

    window.addEventListener("resize", resize);
    startLoop();

    return () => {
      disposed = true;
      stopLoop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  return <div ref={host} aria-hidden />;
}