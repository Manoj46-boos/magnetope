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

## 3. Thumbnails (PRD 17.3)

| Asset | File | Status |
| --- | --- | --- |
| Hero card, 628 x 628 | `thumbnails/static/thumbnail-hero-628.png` | Done. MAGNO caught mid-launch on a live beam, arms and eye already on the junk stack above him; dusk sky, six degree roll |
| Blooper card, 628 x 628 | `thumbnails/static/thumbnail-fall-628.png` | Done. The flip that never connected: windmilling fall, panic eye, amber repel glow, the calm stack for scale |
| Ambience card, 628 x 628 | `thumbnails/static/thumbnail-tower-628.png` | Done. The whole Tin Roof shaft, summit beacon lit, clouds and ridges, MAGNO small on his beam up the left wall |
| Sharp copies, 1256 x 1256 | `thumbnails/static/thumbnail-*-1256.png` | Done, the same three compositions for stores that want the extra pixels |
| Animated ident | `thumbnails/animated/` as WebM, WebP and GIF | Done. The Cooper timeline: flip-in inside half a second, the catch with its flash by 2.0 s, settle and one blink, loop-clean at 3.0 s. WebM is 245 KB against the 300 KB budget |

Every number behind the cards lives in one module, `src/render/thumbnail-scene.ts`: the framing, the staged pose, the dress props, the sky grade and the ident timeline. The engine renders the card with the same rig, field lines and post pass as gameplay, so the store frame is a designed shot, not a screenshot luck produced, and it cannot drift from the game. Regenerate the family with `npm run dev` in one terminal and `npm run thumbnails` in another. The run ends by auditing every card and the ident budgets (`python tools/check-thumbnail.py --report thumbnails`) and exits non-zero when any rule fails.

### The five-point pre-flight (R-TH-09)

No web-fit request is sent until all five points read green in `thumbnails/report.json`. The first four are machine audits, re-runnable any time; the fifth is people.

1. **Text-free.** `audits.ocrEmpty` is true: tesseract finds no glyphs at confidence 65 or more (R-TH-02).
2. **Legible at 128 px.** `audits.legibility128` is true: the subject holds 1.6:1 tonal separation in a phone-row crop (R-TH-01).
3. **Contrast holds.** `audits.contrast` is 3:1 or better around the subject, and still 2:1 on a screen dimmed to 30% (R-TH-05).
4. **No Poki-background collision.** `audits.hueCollision` is false: no sampled pixel within ΔE 10 of the playground's `#83FFE7`.
5. **The panel says yes.** `panel.score` is at least 0.9 from the forced-choice test (R-TH-07): ten naive viewers, 200 ms exposure, "which would you click?". Record the winner in `panel.forcedChoiceWinner`, then fill `uploaded` with what actually shipped.

Current state: the four machine points pass for all three cards and the ident (`detail` in `report.json` lists no failures). `panel.score` is still null — the forced-choice test needs ten people in a room, and no build step can conjure them. Until it runs and scores at least 0.9, the pre-flight is not passed and nothing uploads.

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
| SDK event correctness | Done | `tests/platform.test.ts` replays 10,000 scripted inputs and asserts the SDK rules; `tests/doc-spine.test.ts` holds every telemetry payload to the platform's own measure() alphabet and its two-number budget, because the live SDK drops what breaks either |
| Clean production build | Done | dev hooks compile out; audited in `tests/build.test.ts` |
| Save system and notice | Done | `tests/session.test.ts` reloads the page and finds the stars; `tests/platform.test.ts` covers the fallbacks |
| Size and load speed | Done. 1.48 MB gzipped against a 4 MB target and 5 MB limit. Cold load measured in Chrome with a throttled CPU and network: about 1.3 s on desktop, 4 to 5 s on a mid-range phone over 4G, about 12 s on a low-end phone over slow 4G (software rendering, so drawing is pessimistic). Real devices not yet tried | `npm run build`, `npm run loadtime`, `tests/load-time.test.ts` |
| Static and animated thumbnails | Done. Three scored variants at 628 and 1256, audited by `tools/check-thumbnail.py`; the panel leg of the upload ritual is section 3's open point | section 3, `thumbnails/report.json` |
| Keyboard pause | Done | `tests/session.test.ts` presses Escape in the real game and checks the clock stops |
| Skippable cutscenes, visual tutorials | Done | `tests/ending.test.ts`, `tests/ending-screen.test.ts`, ghost-hand tutorial in `src/game/coach.ts` |

Dependencies: Three.js (MIT), Rapier (Apache 2.0) and the Fredoka font (SIL Open Font License 1.1, self-hosted from `public/fonts/` with its licence file). Nothing is loaded from a third-party host.

## 6. AI process ledger

`docs/AI_LEDGER.md` lists every session in which AI output entered the project, with what a human changed or decided. The human column is complete: every row records the decision that shaped the work — the developer's direction, acceptance or amendment — and, where a verdict still needs the developer's own hands (a playtest, a real device, a human panel), the row names that verdict and the gate it is owed to rather than hiding behind a blank. The director's signature block at the ledger's foot is the last slot: signing confirms the record is true and takes the owed verdicts as the developer's to run. Only the developer can sign it, and the owed legs are the same ones section 7 lists.

## 7. What is still open

These cannot be finished by building more code; each needs a person, a device or a Poki account.

1. **Play it.** All 70 levels and the ending have been verified by bots and tests, never by a human. Mark unfair or dull levels; `docs/ROADMAP.md` lists the known weak ones.
2. **Five external playtesters** with screen recordings, focusing on the first 90 seconds and the first fall (PRD 14.3).
3. **Device matrix** (PRD table 14.2): at least one phone, one tablet and a low-end laptop.
4. **Poki SDK names.** `measure(category, what, action)` matches Poki's public Game Events guide (checked in session 7). Re-check once a developer account exists, in case the SDK has moved on. The channel's own law (its alphabet and its two-numeric-values budget) was verified against the live SDK script itself in session 28 and is enforced by the suite.
5. **Native review** of the six non-English locales.
6. **Agreement terms.** The PRD recommends the exclusive five-year revenue share; read the actual contract before signing.
7. **Poki Inspector cross-check (R-AN-10).** With a developer account: open the game's page in the Poki Inspector, confirm the `measure` events arrive with the payloads the table in `docs/EVENTS.md` publishes, check the language behaviour in-platform, and file the screenshot as the milestone QA evidence slot.

## 8. Accessibility and languages statement

MAGNETOPE is built to be played by more people, and every accommodation below is a shipped setting held by a behavioural test, not a claim. The accessibility group lives on the controls screen, in the pause menu's reach, under its own name.

**What the game offers**

- **Reduced motion.** Camera kicks and shakes keep at most a fifth of their amplitude; the big-fall slow motion runs at half its depth instead of switching off, so the reaction aid a tall fall buys survives (a frozen frame — hit-stop — stays refused outright); every interface transition collapses to near-instant. The simulation's own clock never learns the profile: the forgiveness windows, the assist and the levels are the same game. `tests/a11y.test.ts` measures the camera ratio, the slow-motion floor and the source-level separation.
- **Interface scale.** 100, 125 and 150 percent from the settings screen. The shell lays out in a divided space and scales back to the full screen, so every panel keeps meaning the same share of the viewport; the touch stick stays 1:1 with the finger at any scale because it is a direct-manipulation surface, not chrome. The layout matrix (`tests/a11y-browser.test.ts`) walks the surfaces in German — the longest shipped language — at every step, and holds the same laws the seven-language battery holds: nothing leaves the screen, nothing clips, no control shrinks below the 32-pixel floor. On screens too small to hold zoomed content whole, a panel scrolls inside its own capped box — the same trade every enlarged-interface system makes.
- **One-thumb play.** The button layout puts flip and steering in one thumb's reach, no interaction asks for a double tap, and the snap assist plus the coyote and buffer windows are the tremor aid. The same planner that authored the campaign clears its third level under a strict one-thumb constraint — never steering on any tick the button is touched — and the emitted route is replayed and held to that law tick by tick. An erratic one-action-at-a-time player is fuzzed across the on-ramp's first three levels for the same invariants the two-thumb fuzz suite holds.
- **Two senses per cue.** Every gameplay-critical cue — polarity, charge full, gusts, weak metal, the big fall, the catch, the launch, the summit — reaches the eye and the ear. The cue table (`src/game/cue-table.ts`) names its witnesses as real code, and the suite fails if a row loses a sense or a single-channel exception appears without a written reason.
- **Flash safety.** The catch ident beats at most three times in any rolling second, counted in real time, and reduced motion halves whatever lift remains. The guard lives where both the veil and the bloom can pass through it (`src/render/flash-guard.ts`).
- **Colour and contrast.** Polarity is told apart by loop shape and flow direction, not hue alone — proven on the geometry, under simulated dichromacy, for every field-line cosmetic. Body text clears 4.5:1 and HUD graphics 3:1 against the brightest band any biome can put behind the interface (the audit composites translucent pills and chips exactly as the browser paints them); the timer's pill, the summit star's chip and the marker's ring were deepened in this pass to hold those floors, and the in-browser audit re-measures the shipped DOM.
- **Menus a machine can read.** Every control is a semantic element with a name, states are true booleans, decorative art is marked, focus is visible, and Tab is trapped inside the open modal — audited on the living DOM of every screen. Decision budgets are held (the pause stack stays inside five rows, settings are one input from pause) and no menu sits on a timer.
- **Wordless play.** During a run the HUD carries numbers and marks only; the par rides beside the clock as a bare reference time. Words live in menus, cards and the coach, all translated.

**Languages.** Seven locales ship (English, German, Spanish, French, Italian, Brazilian Portuguese, Turkish) with every key present in every table, verified. Layouts hold at five screen sizes in all seven. A pseudo locale — every English string bracketed, stretched past 1.4x and wearing the shipped diacritics — rides the language menu in development builds so a fit regression is caught before translation money is spent; the font sweep draws every character of every language, the pseudo fixture included, through the self-hosted Fredoka file and holds it to zero missing glyphs.

**What is still open on this front.** The one-thumb question the planner cannot answer: the tutorial's first two levels do not yield a one-thumb clear to the search planner (its reachable set tops out at 7.0 of 14.6 metres on the first level, 17.2 of 20.8 on the second), because their hops lean on the release-instant aim a single thumb cannot give. Whether a human with continuous control clears them one-handed is the device-matrix playtest's question to answer (section 7, item 3); if the answer is no, the fix is either a launch-aim assist or two early layouts that welcome normal-only launches. Native review of the six non-English locales (section 7, item 5) also covers this statement's tone in each language.

## 9. The content safety audit (R-CM-03)

Poki asks for nothing "even slightly shocking", and the table below is the audit that answers it, row by row, with the evidence that holds each answer. Any red row is a release blocker; the review is run at every milestone and again the day the dossier ships. The machine legs of every row are held by the suites named in it, and the human read — playing the game and agreeing with each row — is the signature below.

| Row | Audit question | MAGNETOPE's position | Held by |
| --- | --- | --- | --- |
| Violence | Any harm to living things? | None — a small robot, slapstick falls, zero combat; nothing in the game can be hurt | `tests/compliance.test.ts` (the AUDS and closed-world laws); the feel bible's event table |
| Shock | Jump scares, gore, horror beats, darkness? | None — the fall card is deadpan comedy, never punishment; no dark themes, no horror vocabulary anywhere | The locale ban and the text-surface scan in `tests/compliance.test.ts` + `tests/retention.test.ts` |
| Gambling | Wagering, mystery boxes, pay-to-spin? | None — prices are labelled, items are shown before purchase, Scrap is earned by play only (R-EC-10); no randomness is sold | `tests/economy-sim.test.ts`, the locker and shelf suites; the economy spine doc |
| Language | Text/voice content per locale? | Menus only, all seven languages translated, zero profanity adjacency, LQA pass owed to native review | The locale key coverage in the a11y suite; section 7, item 5 for the native read |
| Themes | Religion, politics, tragedy, romance? | "A small robot climbs home" — the most defensible story on the platform; no theme touches any of them | The ending suite; the story exists nowhere else |
| Data | Anything collected? | Nothing personal; SDK-only events in the channel's own grammar; the save stays in local storage and degrades gracefully when storage is blocked | `tests/release.test.ts` (the CSP-locked request census), `tests/analytics.test.ts` (the child-safe vocabulary), `tests/resilience-browser.test.ts` |
| Ads coexistence | Would an advertiser's brand be unsafe adjacent? | No — a clean, bright, toy-scale world; no shock, no gore, no edge content anywhere in the bundle | This table's other rows, all green |
| Sound | Loud/sudden audio risks? | Loudness-disciplined (R-AU-08); no stinger stacking, the side-chain ducks the music under every cue | `tests/loudness.test.ts`, `tests/mix-levels.test.ts`, the stinger gate in `tests/audio.test.ts` |
| Fall "tone" | Is failure punitive? | No — falls are the comedy (Foddy's law); the grade card awards style, retry is one tap, and no guilt vocabulary exists in any language (R-RT-08) | `tests/compliance.test.ts` (the guilt laws), `tests/retention.test.ts`, the fall suites |
| Exit safety | Can a player be trapped? | No — everything interruptible, pausable and skippable (R-GD-06); no timed menus, no unskippable film | `tests/ending-screen.test.ts`, the back-button and session suites |

Reviewed and signed: ____________________

Date: ____________________

The signature slots are the developer's, dated the day the audit is re-run before submission. A red row anywhere above stops the release; there are none today.

## 10. Craft signatures — the review pack (R-CM-05)

Five moments no template produces. Each is photographed off the shipped game by `scripts/qa-signature-capture.mjs` into `download/w15-captures/` (the folder is local evidence; the script re-shoots it in one command), and each cites the requirement that tested it:

| Moment | Requirement | The frame | The panel's read |
| --- | --- | --- | --- |
| The scripted first launch | R-SM-01 | `01-colour-script.png` neighbours `02-first-launch.png` — the full-charge release, its stack and the slow-mo landing, played by real input on the production build | "The art style itself is the identity" — a curated, authored look, not a default palette |
| The junk orchestra | R-AU-04 | `03-junk-orchestra.png` — a full-power flight over the Scrapyard's orchestra pit | The honest limit: the still alone reads as a physics-platformer frame; the orchestra's signature is the sound — the ten-track blind-listen pack (`download/audio-listen/`) and its ≥ 4/5 panel are the evidence that names it |
| The biome colour script | R-AR-05 | `01-colour-script.png` — the arrived Scrapyard: its dusk palette, grade, fog and hero silhouette, before anything moves | "Highly specific authored identity" — the appliance architecture and the palette named as deliberate, not stock |
| The fall-grade comedy | R-GF-07 | `04-fall-grade-comedy.png` — the fall card mid-grade: deadpan numbers, a letter grade, retry one tap away | "Specific authored identity" — the vocabulary (metres, bounces, junk moved) reads as a designed comedy, not a game-over screen |
| The wordless ending | R-SM-05 | `05-wordless-ending.png` — the credits card: the wordmark, a thank-you, the climb's three facts, nothing else | The game's own name and lockup, unmistakable from the frame alone |

**The review minute.** The pack was reviewed as a set: four of the five frames name the game from the frame alone to a cold reader, and the fifth — the orchestra — names it through the ears, which is what an orchestra is for; its blind-listen protocol and tracks are ready for the human panel (section 7's playtest item). Three frames come from the production Poki build played by real pointer input; the fall is staged on the dev server exactly the way the ad-block suite stages it (a fresh visit cannot fall on the tutorial — the on-ramp catches every drop by design, R-ON-03), and the ending is reached through the development handle because it sits seventy levels deep. Zero page errors on every leg.

The M4 review minute is completed by a person: played, watched, listened to, and signed.

Reviewed and signed: ____________________

Date: ____________________

## 11. The monetization statement (R-MZ chapter)

How the game asks for a player's attention, in one paragraph a reviewer can check against the code. Every ad decision is made by one policy layer, `src/platform/ad-placement.ts`, on the game's own clock — the screens state intent, the layer decides what reaches the host SDK. The pause-to-play break is always called (the host's own contract); every other break waits its turn — ninety seconds past the last break of any kind for a next-level break, twice that after a retry, nothing in the session's first minute. Rewarded prompts share one two-minute window and the ask spends it, decline or not; the locker's watch button is walked to, never prompted, and its views stay uncapped. The doubler must be earned (no run under twenty-five seconds, one per day) and its pay is capped and ledgered at two hundred Scrap a day; every reward lands automatically. Ads never gate progress: Scrap buys cosmetics only, the campaign is star-gated only, and a blocked or failing ad stack costs the player nothing — the hostile-SDK visit in `tests/adblock-browser.test.ts` boots, plays, declines every offer and buys its look with Scrap the ads never touched, ending with zero page errors. The full placement map, floors and caps live in the generated `docs/ECONOMY.md`, held byte-for-byte by the drift battery.
