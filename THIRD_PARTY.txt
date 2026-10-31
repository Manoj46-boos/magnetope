# Third-party notices

MAGNETOPE is an original work: every line of game code, every model, every
texture and every sound in the bundle is generated in code or synthesised at
runtime by this repository's own sources. Nothing is loaded from an asset pack,
a stock library or a third-party host. The only pieces this project did not
write itself are listed below, each with the license the copy in this
repository ships under.

## three.js

The WebGL renderer and scene graph, bundled from the npm package `three`.

- Copyright (c) 2010-2026 three.js authors
- License: MIT — full text at https://opensource.org/licenses/MIT
- The package ships its own copy in `node_modules/three/LICENSE`.

## Rapier

The physics engine, bundled from the npm package `@dimforge/rapier3d-compat`,
serving its WebAssembly as a streamed file rather than the package's inlined
base64 (see `vite.config.ts`).

- Copyright (c) Dimension
- License: Apache License, Version 2.0 — full text at
  https://www.apache.org/licenses/LICENSE-2.0
- The package ships its own copy in
  `node_modules/@dimforge/rapier3d-compat/LICENSE`.

## Fredoka

The only font the interface uses, self-hosted as `public/fonts/fredoka-latin.woff2`
with its licence beside it in `public/fonts/OFL.txt`.

- Copyright 2016 The Fredoka Project Authors
  (https://github.com/hafontia/Fredoka-One)
- License: SIL Open Font License, Version 1.1 — full text ships with the font
  and at http://scripts.sil.org/OFL

## The host's SDK

The Poki build loads the Poki SDK from Poki's own CDN on the host's instruction
(the `pokiSdkTag` plugin in `vite.config.ts`). That script belongs to Poki and
is governed by Poki's own terms; this project neither bundles nor modifies it.
Every other build is request-free.

## Everything else

All remaining source files — the game, its levels, its prop and character
models, its colours, its music and its sound effects — are the original work of
this repository's authors, produced procedurally in TypeScript and Web Audio.
The dependency scan that backs this notice is `npm run licenses`
(`tools/license-scan.ts`), and the build audit refuses to ship a bundle without
this file in it.
