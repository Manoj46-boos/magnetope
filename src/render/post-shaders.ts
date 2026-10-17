/** GLSL for the post stack (PRD 8.5): bright pass, separable blur and the final grade. */

export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Soft-knee threshold on the brightest channel, so only real light sources feed the bloom. */
export const BRIGHT_FRAGMENT = /* glsl */ `
uniform sampler2D tSource;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
varying vec2 vUv;

vec3 bright(vec3 c) {
  c = mix(clamp(c, 0.0, 32.0), vec3(0.0), vec3(notEqual(c, c)));
  float peak = max(c.r, max(c.g, c.b));
  float soft = clamp(peak - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float gain = max(soft, peak - threshold) / max(peak, 1e-4);
  return c * gain;
}

void main() {
  vec3 sum = bright(texture2D(tSource, vUv + texel * vec2(-0.5, -0.5)).rgb)
           + bright(texture2D(tSource, vUv + texel * vec2( 0.5, -0.5)).rgb)
           + bright(texture2D(tSource, vUv + texel * vec2(-0.5,  0.5)).rgb)
           + bright(texture2D(tSource, vUv + texel * vec2( 0.5,  0.5)).rgb);
  gl_FragColor = vec4(sum * 0.25, 1.0);
}
`;

/** Five linear taps stand in for a nine-tap gaussian along one axis. */
export const BLUR_FRAGMENT = /* glsl */ `
uniform sampler2D tSource;
uniform vec2 direction;
varying vec2 vUv;

void main() {
  vec3 c = texture2D(tSource, vUv).rgb * 0.2270270270;
  c += texture2D(tSource, vUv + direction * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSource, vUv - direction * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tSource, vUv + direction * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tSource, vUv - direction * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * Scene + bloom -> tone map -> sRGB -> biome grade -> vignette -> dither.
 * The grade runs on display values, so the lookup table is authored in the
 * space the player sees.
 */
export const FINAL_FRAGMENT = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform sampler2D tBloomC;
uniform sampler2D tLut;
uniform float bloomStrength;
uniform float vignette;
uniform float aspect;
uniform float seed;
varying vec2 vUv;

vec3 gradeLut(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float blue = c.b * 15.0;
  float slice0 = floor(blue);
  float slice1 = min(slice0 + 1.0, 15.0);
  vec2 inSlice = vec2(c.r * 15.0 + 0.5, c.g * 15.0 + 0.5);
  vec3 a = texture2D(tLut, vec2((slice0 * 16.0 + inSlice.x) / 256.0, inSlice.y / 16.0)).rgb;
  vec3 b = texture2D(tLut, vec2((slice1 * 16.0 + inSlice.x) / 256.0, inSlice.y / 16.0)).rgb;
  return mix(a, b, blue - slice0);
}

void main() {
  vec3 color = texture2D(tScene, vUv).rgb;
#ifdef BLOOM
  vec3 glow = texture2D(tBloomA, vUv).rgb * 0.55 + texture2D(tBloomB, vUv).rgb * 0.45 + texture2D(tBloomC, vUv).rgb * 0.35;
  color += glow * bloomStrength;
#endif
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  vec3 graded = gradeLut(gl_FragColor.rgb);
  vec2 offset = (vUv - 0.5) * vec2(aspect, 1.0);
  float edge = smoothstep(0.35, 0.95, length(offset) / length(vec2(aspect, 1.0) * 0.5));
  graded *= 1.0 - vignette * edge;
  float noise = fract(sin(dot(gl_FragCoord.xy + seed, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(graded + (noise - 0.5) / 255.0, 1.0);
}
`;
