# MAGNETOPE

A magnetic slingshot game for the open web. One button charges and flips your polarity: stick, charge, launch, snap, and fling yourself through a mountain of junk.
Built to the product requirements in `MAGNETOPE_PRD.pdf` for Poki.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 1,700 behavioural tests (some drive a real browser), a few minutes
npm run build        # typecheck, production bundle, size and hygiene audit
npm run build:poki   # same, with the official Poki SDK script tag injected
npm run solve        # planner bot: re-solve levels (name ids to limit) and refresh verified routes
npm run ghosts       # rebuild par ghosts from the stored routes
npm run probe -- <id> # dry-run solve while shaping a level; touches nothing
npm run ablate       # does each level still solve without its moving, hung or flickering props
npm run reach -- 1 0.5 # how far one flip and a snap carry at a gravity scale
npm run thumbnails   # store thumbnails from the running game (dev server must be up)
npm run capture -- --level=<id> ...  # deterministic in-engine frame capture, see tools/capture.ts
npm run heatmap -- export.jsonl      # weekly difficulty review from the Poki telemetry export
```

Controls: **Space / J / click** flips (hold to charge). **WASD / arrows** aim. **Esc / P** pauses, **R** restarts.
Touch: left half drags a stick, right half is the flip button. Mouse-only play follows the cursor.

## How it is built

```
src/
  sim/        Headless, deterministic game: Rapier world, magnet controller, falls, run rules, replays
  levels/     Level data, authoring helpers, bot-verified routes (routes/*.json)
  render/     Three.js scene: props, MAGNO rig, field lines, particles, camera, backdrop
  audio/      Web Audio engine, material voices, hum, adaptive music (all synthesised, zero bytes shipped)
  input/      Keyboard, mouse and touch merged into fixed-tick input frames
  platform/   SdkBus (the only module that touches the Poki SDK), save store, settings
  game/       App controller, slow-motion director, progression rules
  ui/         DOM surfaces: loading, HUD, pause, level-clear card, fall card
  config/     Tuning table, material families, prop physics identities
tools/        Planner bot, solver, capture and analytics CLIs (development only, never bundled)
tests/        Behavioural tests
```

Design rules that shape the code:

- **The simulation knows nothing about rendering, audio or the DOM.** It steps at exactly 60 Hz and is bit-identical for identical inputs, so the same code drives the player, the bots and the replays.
- **Everything tunable lives in `config/tuning.ts`** and traces to a table in the PRD.
- **One table owns prop physics** (`config/props.ts`); the renderer and the physics both read it.
- **Scripted hazards follow the run clock** (`sim/motion.ts`, `sim/wind.ts`): moving doors, flickering signs and gusts are pure functions of run time, so every attempt meets them the same way.
- **Storage never blocks play.** Incognito, quota errors and corrupted saves degrade to memory with a single notice.
- **The SDK cannot misfire.** `SdkBus` makes double events, events during ads and a pre-input start impossible by construction.

## What is verified, and how

| Area | Evidence |
| --- | --- |
| Magnet feel (attach ramp, charge, repel, snap, coyote and buffer windows, weak metal) | `tests/magno.test.ts` drives the real physics |
| Falls, grading, slow-motion trigger | `tests/fall.test.ts` |
| Determinism and snapshots (ghosts and bots depend on these) | `tests/simulation.test.ts` |
| Levels are completable, not skippable, and fair | `tests/levels.test.ts` replays bot routes on the live geometry |
| Poki SDK rules | `tests/platform.test.ts` including a 10,000 input trace |
| Input edges, mouse-only, multi-touch | `tests/input.test.ts` |
| Audio mix, mute, ducking, event mapping, biome ambience, gust lead | `tests/audio.test.ts` |
| Moving surfaces, flickering signs, swing hinges, trampolines, wind | `tests/motion.test.ts`, `hinge.test.ts`, `bounce.test.ts`, `wind.test.ts`, `hazard-clock.test.ts` |
| Spinning wheels and carousels, tipping see-saws, the ball-pit landing, low gravity | `tests/spin.test.ts`, `seesaw.test.ts`, `ball-pit.test.ts`, `low-gravity.test.ts` |
| The field-driven wheel: hub, spokes and cabins as one machine, loaded by MAGNO, kicked by a flip, coasting, snapshot-exact; its axle groan | `tests/wheel.test.ts`, `tests/audio.test.ts` |
| No leak across repeated level loads, ten minutes of play on the busiest level without growth, drift or a NaN | `tests/soak.test.ts` |
| Twists are required, not skippable: fixed ledges sit beyond one flip's reach | `tests/levels.test.ts` (twist gating) and `npm run ablate` |
| Prop art matches colliders, triangle budget across every shipping level | `tests/prop-kits.test.ts` |
| Rig squash and stretch, shake grammar, particle ceilings | `tests/render.test.ts` |
| Byte budget, zero external requests, no dev hooks | `tests/build.test.ts` builds the bundle and audits it |
| Bloom, vignette and biome grade in the real shader | `tests/post-stack.test.ts` renders known scenes in a browser and reads the pixels back; `tests/grade.test.ts` checks the lookup tables |
| A first session: three levels, clear card, Escape pause, reload, network cut | `tests/session.test.ts` plays them in a real browser through the real game loop |
| The shipped bundle under a strict content security policy | `tests/release.test.ts` serves a production build with a locked-down CSP |
| Telemetry parsing, fall clustering, difficulty verdicts, heatmaps | `tests/analytics.test.ts` |

If you change a level, run `npm run solve`; the route replay test fails until the route is refreshed.

## Rules for authoring a level

- **Twists must be required.** Where a moving, tilting, hung or blinking prop is the lesson, keep the fixed magnetic ledges around it further apart than `npm run reach` says one flip and a snap can carry (21 m at full gravity, 32 m at x0.62, 39 m at x0.5), plus a few metres of margin. `tests/levels.test.ts` enforces the spacing and `npm run ablate -- <id>` proves it with the planner.
- **Walls, brackets and satellites hold no magnet.** Use wood, fabric or plastic for anything that must not become a stepping stone.
- **A checkpoint sits above a ledge that crosses the centre line**, because a respawn drops MAGNO there from just above it.
- **Scripted motion keeps a period of 4 to 16 seconds**, never sweeps through fixed geometry, and runs on the run clock.
- **Lighter gravity needs lighter wind**: drift grows with the square of flight time. Upward air steering follows gravity so lighter air never turns steering into flying.
