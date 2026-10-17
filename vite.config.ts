import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

const POKI_SDK_URL = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';

/** The Poki SDK tag is only emitted for the Poki build; dev and CI stay request-free. */
function pokiSdkTag(enabled: boolean): Plugin {
  return {
    name: 'magnetope:poki-sdk-tag',
    transformIndexHtml: () =>
      enabled ? [{ tag: 'script', attrs: { src: POKI_SDK_URL }, injectTo: 'head-prepend' as const }] : [],
  };
}

/**
 * Rapier's compat build carries its WebAssembly as a 4 MB base64 string: it compresses poorly, is
 * decoded in JavaScript and cannot be compiled while it downloads. The production build serves the
 * .wasm file the package ships beside it instead, which the engine's loader streams and compiles.
 */
function rapierWasmAsset(): Plugin {
  const inlined = /[A-Za-z_$][\w$]*\.toByteArray\("[A-Za-z0-9+/=]{100000,}"\)\.buffer/;
  return {
    name: 'magnetope:rapier-wasm-asset',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/rapier3d-compat[\/]dist[\/]rapier\.mjs$/.test(id)) return null;
      if (!inlined.test(code)) this.error('Rapier no longer inlines its WebAssembly as base64; revisit rapierWasmAsset in vite.config.ts.');
      return code.replace(inlined, 'new URL("./rapier_wasm3d_bg.wasm", import.meta.url)');
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [rapierWasmAsset(), pokiSdkTag(mode === 'poki')],
  define: { __DEV_TOOLS__: JSON.stringify(mode === 'development') },
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('rapier3d')) return 'physics';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    execArgv: ['--expose-gc'],
  },
}));
