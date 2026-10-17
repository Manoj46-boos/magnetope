# Poki submission dossier

Everything the Poki team asks to see, in one place, with the evidence for each claim. Nothing here is aspirational: a row says **done**, **partly** or **not done**, and what proves it.

## 1. The game in one paragraph

MAGNETOPE is a one-button magnetic slingshot game. MAGNO, a round-bottomed robot with a horseshoe-magnet head, sticks to steel, charges his magnet and flips his polarity to fling himself off it, then snaps to the next surface in mid-air. Seventy short levels (30 to 90 seconds each) cross five biomes, from a scrapyard of fridges and girders to the thin air above the clouds, and a wordless ending closes the story. Falls are part of the show: every fall is graded, slows down for the big ones, and can be saved as a share card.

## 2. Store listing copy

**Title:** MAGNETOPE

**Tagline (one line):** Charge. Flip. Fling yourself through the junk.

**Short description (under 160 characters):**
A one-button magnetic slingshot. Charge, flip and snap MAGNO across fridges, girders and swings. The falls are half the fun.

**Description:**
MAGNO is a small robot with a very big magnet. Hold the button to charge, let go to launch, then snap onto the next ledge before gravity wins. Chain flip, snap and flip again and the whole junkyard becomes a slingshot.

Seventy levels take you through five worlds: a rusting Scrapyard, a Suburbia of trampolines and washing lines, a neon Metropolis with gusting wind, a Playground of Giants with see-saws and ferris wheels, and the Stratosphere, where gravity gives up. Every level has three stars to chase and a ghost to beat. Fall from a great height and the game slows down, grades your landing and lets you keep the clip.

No sign-in, no waiting, no downloads after the first load.

**How to play:**
- Press and hold to charge a flip. Release to launch away from the surface you are stuck to.
- In the air, press and hold to arm a snap, then let go to be pulled onto the highlighted steel.
- Steer with the stick or the arrow keys. Weak metal gives way; wood and plastic do not stick at all.

**Controls:** Space, J or click to flip. WASD or arrows to aim. Esc or P to pause. R to restart. Every key can be changed in Pause, Controls, Keyboard keys. Touch: drag the left half to steer, tap the right half to flip (layout, sensitivity and mouse-only aiming are in Pause, Controls). Share a ghost code with a friend from Pause, Ghost exchange.

**Languages:** English, German, Spanish, French, Italian, Portuguese, Turkish.

**Suggested tags:** physics, magnet, skill, one button, ragdoll, rage game, 3D, casual, speedrun.

## 3. Thumbnails (PRD 6.6)

| Asset | File | Status |
| --- | --- | --- |
| Static, 628 x 628 | `thumbnails/static/thumbnail-628.png` | Done, captured in-engine, no text, no UI, no rim tint |
| Static, 1256 x 1256 | `thumbnails/static/thumbnail-1256.png` | Done, same composition for sharp stores |
| Animated loop, 3 s at 60 fps | `thumbnails/animated/` as WebM, WebP and GIF | Done, a flip, spark and catch with a cross-faded loop point |

Regenerate with `npm run thumbnails` while `npm run dev` is running. `python tools/check-thumbnail.py <png>` checks the rules Poki publishes: square, at least 628 px, opaque corners, no letterbox bars, and under 1% of pixels near the playground background `#83FFE7`.

The composition follows the brief: MAGNO mid-flip in the lower left, repel rings and sparks behind him, a tower of fridge, washer and locker filling the upper right, the Scrapyard sky, a seven degree tilt. It has not been A/B tested; that is a soft-release task.

## 4. Clone defence (PRD table 3.2)

| Poki dimension | Our position | Evidence in the project |
| --- | --- | --- |
| Art style | Flat-shaded low-poly diorama, one warm-to-cool story across five biomes, toy-scale props. Every model is generated in code (`src/render/kit-*.ts`), so no asset pack is involved | `src/render/prop-mesh.ts`, `palette.ts`; triangle budgets enforced in `tests/prop-kits.test.ts`; grades per biome in `src/render/grade.ts` |
| Core mechanics | Polarity flip: stick, repel with charge, airborne snap, momentum kept on attach. Not a grapple and not a teleport | `src/sim/magno.ts`; behaviour pinned in `tests/magno.test.ts` |
| Progression and economy | 70 short levels, three stars, par ghosts, one currency (Scrap), a 24-item locker | `src/game/progress.ts`, `locker.ts`; `tests/progression.test.ts`, `locker.test.ts` |
| UI, icons, audio | Custom HUD and icons; every sound and the score are synthesised at runtime, so no stock loops | `src/audio/*`, `src/ui/icons.ts`; zero audio bytes in the build |
| Characters | MAGNO is an original silhouette: capsule, horseshoe head, one eye | `src/render/magno-rig.ts` |
| Name and thumbnail | A coined word; the thumbnail shows the game's own character and world | section 3 above |

## 5. Poki requirements (PRD table 14.1)

| Requirement | Status | Proof |
| --- | --- | --- |
| Desktop, mobile and tablet, full-screen | **Partly.** Layout and touch UI are built and unit-tested; no physical device has run it | `src/render/stage.ts`, `src/platform/device.ts` (tablets forced to touch, touchscreen laptops and Chromebooks start on keyboard), `tests/device.test.ts`, `tests/input.test.ts`, `tests/screens.test.ts`, `tests/layout-browser.test.ts`. Device matrix still to do |
| Incognito and blocked storage | Done | `tests/platform.test.ts` (quota and denied paths); `tests/session.test.ts` runs in a fresh browser context |
| No external requests | Done for the game itself | `tests/session.test.ts` asserts every request stays on the page origin; `tests/build.test.ts` audits the bundle. A CSP-restricted run is not done |
| No splash screens or outbound links | Done | build audit in `scripts/check-budget.mjs` |
| SDK event correctness | Done | `tests/platform.test.ts` replays 10,000 scripted inputs and asserts the SDK rules |
| Clean production build | Done | dev hooks compile out; audited in `tests/build.test.ts` |
| Save system and notice | Done | `tests/session.test.ts` reloads the page and finds the stars; `tests/platform.test.ts` covers the fallbacks |
| Size and load speed | Done. 1.48 MB gzipped against a 4 MB target and 5 MB limit. Cold load measured in Chrome with a throttled CPU and network: about 1.3 s on desktop, 4 to 5 s on a mid-range phone over 4G, about 12 s on a low-end phone over slow 4G (software rendering, so drawing is pessimistic). Real devices not yet tried | `npm run build`, `npm run loadtime`, `tests/load-time.test.ts` |
| Static and animated thumbnails | Done | section 3 |
| Keyboard pause | Done | `tests/session.test.ts` presses Escape in the real game and checks the clock stops |
| Skippable cutscenes, visual tutorials | Done | `tests/ending.test.ts`, `tests/ending-screen.test.ts`, ghost-hand tutorial in `src/game/coach.ts` |

Dependencies: Three.js (MIT), Rapier (Apache 2.0) and the Fredoka font (SIL Open Font License 1.1, self-hosted from `public/fonts/` with its licence file). Nothing is loaded from a third-party host.

## 6. AI process ledger

`docs/AI_LEDGER.md` lists every session in which AI output entered the project, with what a human changed. Its human column is still partly empty and must be completed by the developer before submission: Poki asks to see the human decisions, and only the developer can write them.

## 7. What is still open

These cannot be finished by building more code; each needs a person, a device or a Poki account.

1. **Play it.** All 70 levels and the ending have been verified by bots and tests, never by a human. Mark unfair or dull levels; `docs/ROADMAP.md` lists the known weak ones.
2. **Five external playtesters** with screen recordings, focusing on the first 90 seconds and the first fall (PRD 14.3).
3. **Device matrix** (PRD table 14.2): at least one phone, one tablet and a low-end laptop.
4. **Poki SDK names.** `measure(category, what, action)` matches Poki's public Game Events guide (checked in session 7). Re-check once a developer account exists, in case the SDK has moved on.
5. **Native review** of the six non-English locales.
6. **Agreement terms.** The PRD recommends the exclusive five-year revenue share; read the actual contract before signing.
