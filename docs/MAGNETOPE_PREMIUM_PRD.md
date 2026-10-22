# MAGNETOPE — THE PREMIUM TRANSFORMATION PRD
## The Zero-Rejection Encyclopedia: from "another AI game" to "Poki cannot say no"

**Document type:** Master Product Requirements Document (encyclopedia form)
**Version:** 1.0 · **Date:** 2026-10-22 · **Status:** Binding build spec
**Codename:** PROJECT MAGNETOPE PREMIUM ("MMP")

**Audience, in order of authority:**
1. The **AI system** (Claude / GPT / Gemini / agentic coder) that will execute the rebuild — this document is written to be consumed machine-first: every requirement has an ID, an acceptance test, and a "build directive" phrased as an executable instruction.
2. **The solo developer** (Manoj) — creative director of record and the only human in the loop.
3. **The Poki Developer Support / QA team** — the judges this document is engineered to satisfy.

**Companion documents (the full set, one purpose):**

| Document | Role |
|---|---|
| `download/MAGNETOPE_Poki_Review.pdf` | The brutal audit: 8.1/10, 55–70% acceptance odds, 7 risks. The *why* of this PRD. |
| `docs/MAGNETOPE_VISUAL_RENEWAL_PRD.md` | The art encyclopedia (~60 visual masters). The *look* half of Part III, Chapters 18–19. |
| `prd.txt` + `MAGNETOPE_PRD.pdf` | The original build PRD. Still 90% binding for simulation/levels/audio architecture. |
| `docs/SUBMISSION.md` | The submission dossier and its 8 open human tasks. |
| `docs/AI_LEDGER.md` | The human-authorship ledger — now a *strategic asset* (see Ch. 29). |
| **This document** | The master upgrade path: every domain, every requirement, every gate. |

---

## The single sentence this document exists to make true

> **A first-time Poki QA reviewer opens MAGNETOPE, and within fifteen seconds of a mid-range Android phone over 4G, sees a lovable robot get flung across a scrapyard in a burst of magnetic sparks, smiles, and forgets they were judging it.**

Everything in this PRD is a load-bearing beam for that sentence. If a chapter does not serve it, the chapter is wrong.

---

## Evidence discipline — read this before trusting any number

Every factual claim in this document carries one of five evidence tags. An AI builder must obey tagged claims differently:

| Tag | Meaning | Obedience level |
|---|---|---|
| **[P-D]** | Read directly from Poki's developer documentation (developers.poki.com), October 2026. | LAW. Violating = rejection risk. |
| **[QA]** | Verified live in the prior QA session (production `build:poki`, real Chromium, Poki SDK logging, Pixel 7 emulation). | FACT about the current build. |
| **[S]** | Verified fact read from this repository (code, tests, `prd.txt`, tools). | FACT about the current build. |
| **[R]** | Research synthesis: published doctrine of a named expert (book, GDC talk, article — cited in Appendix B). | STRONG guidance; adapt, never contradict the principle. |
| **[T]** | Target: a number this PRD sets that is not externally imposed. Engineer to it; it may be retuned with evidence (a playtest, a heatmap) but never silently. | ENGINEERING TARGET. |

This discipline exists because the fastest way to a rejection is a confident-sounding invented number. AI builders hallucinate; tags cage them.

---

## The AI-builder protocol — 12 rules for consuming this PRD

1. **Hard gates first.** Part II, Chapter 7 is pass/fail. A build that violates one hard gate is a broken build no matter how beautiful.
2. **Never invent numbers.** Every tunable value lives in `src/config/tuning.ts` and traces to a table here. If a value is missing here, flag it — do not improvise.
3. **One workstream at a time.** Part IV defines W1–W16 in dependency order. Do not interleave; the acceptance tests assume the preceding workstream passed.
4. **The simulation is sacred.** `src/sim/` runs at a fixed 60 Hz and is bit-identical for identical inputs [S]. This is why bots, ghosts, and replays work. No rendering, audio, or DOM logic may enter the sim — ever.
5. **Evidence over vibes.** When this PRD and your intuition disagree, this PRD wins. When this PRD and a live playtest disagree, the playtest wins — and you update `tuning.ts` plus this PRD's revision log.
6. **Respect the 1.48 MB floor, not ceiling.** Current total gzipped payload is 1.48 MB [QA]. The premium build must not exceed **3.5 MB gzipped** [T] — headroom is for juice, not for waste.
7. **Zero page errors is a gate, not a streak.** The prior QA produced 0 page errors across every session [QA]; the rebuild must preserve that at every milestone, not just the end.
8. **Every requirement has an ID.** When committing code, reference the requirement ID in the commit message (`R-GF-04: widen coyote window to 120ms`). If a change touches no ID, it is out of scope.
9. **Tests are the acceptance language.** The repo ships ~1,700 behavioural tests [S]. Every new requirement extends the suite in the same style (`tests/<domain>.test.ts`). Untested requirements are unmet requirements.
10. **The 100-seat panel is advisory, the requirements are binding.** Chapters 11–30 open with expert doctrine for context; the `R-XX` items under them are the actual contract.
11. **When two requirements conflict, the earlier chapter wins** (e.g., a monetization requirement may not violate an onboarding requirement). Ch. 35 resolves conflicts explicitly in the Final Gate checklist.
12. **The game must remain rebuildable from this document plus the repo.** If you delete something the player can see, there must be a requirement in here that asked for it — otherwise you have broken the chain of authorship this document exists to prove (Ch. 29).

---

## The 100-Seat Expert Panel — how this research was done

This PRD's requirements were derived by running a *synthesized review board* of one hundred seats, ten per domain-commission, each seat anchored to a real, named authority whose published work is cited in Appendix B. To be precise about what that means:

- **These are not private consultations.** No expert was hired or contacted. Each "seat" is the PRD's distillation of that person's *public* doctrine — books, GDC talks, essays, interviews, toolkits — applied to Magnetope's concrete situation.
- **Every seat demands something specific.** Appendix A lists all 100 seats: name, commission, the doctrine they are famous for, and the single sharpest demand they make of this game. If a demand cannot be traced to public doctrine, it was cut.
- **Poki's own documents outrank the panel.** Where a commission's taste conflicts with a [P-D] requirement, Poki wins — this document is engineering acceptance, not art for its own sake.

| Commission | Seats | Chapters | Domain |
|---|---|---|---|
| **A. Game Direction** | 10 | 11 | Vision, fun, core loop philosophy |
| **B. Game Feel & Juice** | 10 | 13 | Input, response, polish, animation |
| **C. Level & Difficulty Design** | 10 | 14 | Level grammar, teaching, difficulty curve |
| **D. Onboarding & Session Design** | 10 | 15, 25 | First 90 seconds, habit loops, session 0 |
| **E. Packaging & Click-Through** | 10 | 17 | Thumbnail science, store presence |
| **F. Art & Character Appeal** | 10 | 18, 19 | Killing the "AI game look" |
| **G. Audio & Music** | 10 | 20 | Adaptive score, SFX taxonomy, mix |
| **H. UX & Touch Ergonomics** | 10 | 21, 22 | Menus, HUD, thumb zones, cross-device |
| **I. Performance Engineering** | 10 | 23 | Load, frame budget, memory, physics |
| **J. Economy, Analytics & Compliance** | 10 | 24, 26, 27, 28, 29 | Monetization, telemetry, l10n, a11y, law |

---

## Requirement numbering scheme

`R-<DOMAIN>-<NN>` — domains: GD (direction), CL (core loop), GF (game feel), LD (level design), ON (onboarding), SM (signature moment), TH (thumbnail/packaging), AR (art), CH (character), AU (audio), UX (UI/UX), MO (mobile), PE (performance), MZ (monetization), EC (economy/progression), RT (retention/session), AN (analytics), LO (localization), AC (accessibility), CM (compliance), QA (quality/release), FG (final gate).

**Total binding requirements in this PRD: 234** (machine-verified by ID count; per-domain ledger in Appendix D). Each carries: statement → rationale (evidence-tagged) → acceptance test → (for most) the repo file it lands in. The Final Gate (Ch. 35) audits all 234 as a 100-point submission scorecard.

---

## Document map

| Part | Chapters | Purpose |
|---|---|---|
| **I — The Mandate** | 1–4 | What "premium" means, what the brutal audit proved, the Zero-Rejection Doctrine. |
| **II — Poki Decoded** | 5–10 | The platform's actual decision system: funnel, hard gates, benchmarks, monetization rules, rejection taxonomy. Every claim tagged [P-D]. |
| **III — The Expert Panels** | 11–30 | The twenty rebuilding domains, each with doctrine, requirements, acceptance tests, anti-patterns, and an AI build directive. |
| **IV — The Build Spec** | 31–36 | Workstreams W1–W16, architecture placement, schemas, milestones M0–M5, the Final Gate, the risk register. |
| **V — Appendices** | A–D | The 100-seat directory, research bibliography, glossary, conflict-resolution table. |

**Recommended reading orders:** AI builder → rules above → Part II → your assigned workstream in Part IV → the chapters it cites. The developer → Part I → Ch. 35 → Part IV. A Poki reviewer → Ch. 4, then anything; the document is built to survive hostile reading.

# PART I — THE MANDATE

---

## Chapter 1 — Executive Summary: The Gap Between 55% and 100%

**The starting position, from the prior brutal review [QA]:**

| Finding | Value |
|---|---|
| Overall submission rating | **8.1 / 10** |
| Honest acceptance odds as built | **55–70%** |
| Technical hard-requirement gate | **PASS, all rows, live-verified** |
| Biggest threat | The thumbnail (~3/10 CTR appeal) |
| Second threat | Skill-hungry core loop vs casual majority-mobile audience |
| Third threat | Quiet first 15 seconds |
| Confirmed bug | `build:poki` runs the hygiene audit without `--poki` (gate permanently red) |

**The uncomfortable math.** Poki rejects most submissions [P-D]. An 8.1 with three named weaknesses is a strong game with three ways to die. "55–70% odds" means: a one-in-three chance that this developer's only shot at income in months simply ends, politely, by email. That is not premium. That is a coin flip leaning your way.

**The thesis of this PRD.** Rejection is not a vibe — it is a *system output*. Poki's entire funnel (Ch. 6) converts a submission into a small set of measurable numbers, then a human panel weighs those numbers against eight published criteria [P-D]. Therefore "zero chance of rejection" is not achieved by being inspiring; it is achieved by **eliminating every measurable path to "no" while manufacturing multiple independent paths to "yes."** This document decomposes that into 234 requirements across 21 domains, each with an acceptance test, derived from (a) Poki's published rules read line-by-line, (b) a live QA of the current build, and (c) the distilled doctrine of 100 named experts across 10 commissions.

**The strategy in one paragraph.** Magnetope already passes every hard technical gate — that battle is won [QA]. The remaining war is fought on four fronts, in this order of leverage: **(1) the package** — thumbnail, name, first frame: the 200ms decision that decides whether the funnel's numbers even get measured; **(2) the first 180 seconds** — scripted spectacle, guaranteed early wins, and a difficulty on-ramp tuned for a bored 11-year-old on a bus; **(3) the sustained middle** — the 5-minute playtime benchmark and the "one more level" loop engineered through level pacing, ghosts, cosmetics and celebration; **(4) the proof of authorship** — the single most dangerous fact about this project is that Poki explicitly declines games that "feel heavily tool-assisted or rapidly assembled" [P-D]. We answer it with craft signatures, a human-ledger, and design decisions that no template produces. Each front has a Part III chapter, a workstream, and a Final Gate scorecard line.

**What "done" means.** Milestone M5 (Ch. 34) is reached when every one of the 100 Final-Gate points (Ch. 35) passes with evidence, when the local predicted scorecard projects ≥ 95/100, and when the developer can no longer name a single specific thing a Poki reviewer could point at and call cheap. Ambition is not "get accepted"; ambition is **make rejection structurally impossible**: exceed every benchmark floor by enough margin that variance, not weakness, decides the numbers — and remove every non-benchmark reason (originality, craft, safety, fit) that a human panel could invoke.

---

## Chapter 2 — The Brutal Audit Recap: What Is Already Premium, and What Still Says "Cheap AI Game"

Honesty first, always: this chapter is the baseline the rebuild is measured against. Nothing in Part III can be evaluated without knowing precisely where the game stands today.

### 2.1 What is already at or beyond professional studio level — protect it, do not rebuild it

| Asset | Evidence |
|---|---|
| **SDK discipline** | `SdkBus` state machine makes double events, pre-input starts, and events-during-ads impossible by construction; verified live end-to-end with a real house-ad midroll [QA]. Poki's #1 submission killer, solved structurally [S]. |
| **Payload discipline** | 1.48 MB gzipped total for a full 3D physics game; WASM streamed not base64-embedded [QA]. Against Poki's lean-size criterion this is elite. |
| **Cold load** | Measured 4–5 s to playable on a throttled mid-range phone profile, ~1.3 s desktop [S: `npm run loadtime`]. |
| **Determinism** | Fixed 60 Hz sim, bit-identical replays; powers bots, ghosts, routes, soak tests [S]. |
| **Test engineering** | ~1,700 behavioural tests incl. 10,000-input SDK trace, 2,100-input fuzz on the real game, 10-minute soak without heap growth [S; prior slice run 63/63 in 4s]. |
| **Level verification** | 70 levels, 5 biomes, every level bot-solved with stored routes (`npm run solve`), twist-gating enforced by reach tests and ablation [S]. |
| **Cross-device plumbing** | Coarse-pointer detection, forced touch on tablets, hardware back button, portrait+landscape full-bleed, remappable keys, colour-vision-safe palettes [S: `tests/device`, `colour-vision`]. |
| **Forgiveness engineering** | Coyote window, input buffer, auto-align snap assist, weak-metal decay, comedy falls with grading — the feel toolkit already exists [S: `tests/magno`, `fall`]. |
| **Storage resilience** | try/catch everywhere, in-memory degradation, corrupted-save recovery [S]. |
| **Audio hygiene** | Zero audio bytes shipped; runtime synthesis; offline-measured −14 LUFS master with true-peak ceiling [S: `tests/loudness`]. |

**Directive:** the rebuild *adds* on top of this spine. Any workstream that deletes or destabilizes one of these ten assets has failed its acceptance test, no matter what else it achieves.

### 2.2 The "cheap AI game" tells — what a hostile reviewer still sees

This is the list the 100-seat panel was convened to kill. Each tell maps to the chapter(s) that eliminate it:

| # | The tell (as a reviewer perceives it) | Root cause | Killed in |
|---|---|---|---|
| 1 | Store card reads as a debug screenshot: tiny character, muted palette, touch-UI visible in frame | Thumbnail composed for accuracy, not CTR | Ch. 17 |
| 2 | Opening is "clean but quiet" — a fade-in and a gesture instead of motion and spectacle | Opener explains instead of thrilling | Ch. 15, 16 |
| 3 | Character is a geometric placeholder next to platform mascots | MAGNO has silhouette but low *appeal*: no secondary motion charisma yet | Ch. 19, `VISUAL_RENEWAL_PRD` |
| 4 | Some environments read flat; low-poly without a committed material story | Flat-shade look without grade discipline | Ch. 18 |
| 5 | Launch moment lacks top-tier punch in stills (motion unverified) | Particle/shake budgets tuned conservative | Ch. 13, 16 |
| 6 | Synth score risks reading "programmer music" | Zero-bytes synthesis is engineering flex before aesthetic | Ch. 20 |
| 7 | "Another hook-swing game?" pattern-match in 5 seconds | Polarity differentiation not legible fast enough | Ch. 11, 14, 17 |
| 8 | Precision-skill floor vs casual majority-mobile audience | Difficulty curve starts at 6% but the *skill ramp* demands accuracy early | Ch. 14 |
| 9 | `build:poki` gate permanently red (false-positive audit failure) | One missing `--poki` flag | Ch. 30, W1 |
| 10 | No human fingerprint anywhere in the product story | AI-first process not surfaced as authorship | Ch. 29 |
| 11 | First screenshot of the game (pre-input) looks control-less | Staged HUD reveal hides touch UI at boot | Ch. 21 |
| 12 | 7 locales shipped but platform-language flow-through unverified on a real Poki page | `getLanguage()` wiring assumed, not verified | Ch. 27 |

### 2.3 The seven risks from the review, restated as engineering gates

1. **Thumbnail CTR** (severe) → gate: `R-TH-01…R-TH-10` + a locally-scored 200ms readability test must pass at ≥ 9/10 before any web-fit test is requested.
2. **Skill floor vs casual audience** → gate: `R-LD-14…R-LD-22`; fall-rate telemetry must show first-5-level median ≤ 10% with assist defaults.
3. **First fifteen seconds** → gate: `R-SM-01…R-SM-08`; scripted opener ships in W2 and is verified frame-by-frame in a capture.
4. **Low-end device reality** → gate: `R-PE-01…R-PE-14`; tier-low must hold 30+ fps on the profile of a 2021 budget Android (Mali-G52 class) [T].
5. **Genre adjacency** → gate: `R-GD-07` (the "not-a-hook-game" legibility test on 5 new players).
6. **Synth audio aesthetics** → gate: `R-AU-01…R-AU-12`; blind-listen panel score ≥ 4/5 "sounds professional".
7. **Broken audit flag** → gate: `R-QA-01`; fixed in the first commit of W1.

---

## Chapter 3 — "Premium," Decoded Into Numbers a Machine Can Build To

"Premium" is not a mood. For a Poki submission it is this table. Every row is either Poki's published bar [P-D] or this PRD's margin on top of it [T]. The middle column is what actually decides acceptance; the right column is what MAGNETOPE must ship so that even the top of the funnel's variance cannot sink it.

| Poki criterion | The bar (their words, our numbers) | MMP target (the margin) |
|---|---|---|
| **Conversion to play (C2P)** | 65%+ = healthy [P-D]; average game ≈ 70% [P-D] | **≥ 75% overall; ≥ 70% on mobile** [T] |
| **Average playtime** | 5+ min [P-D]; average game ≈ 6 min [P-D] | **≥ 7 min** [T] — one full biome of margin |
| **Plays over 3 minutes** | 25%+ of plays [P-D] | **≥ 40%** [T] |
| **Web fit CTR** | Scored 0–5 vs category average (3 = category avg; action/skill example ≈ 1.5% CTR) [P-D] | **Category-average-beating composition, pre-tested locally; target score 4** [T] |
| **Hard technical gates** | Devices, scaling, incognito, no external requests, no branding, ad-block tolerant, SDK event rules, load/size [P-D] | **All pass, live-verified, in CI on every milestone** [T] |
| **Originality** | "Clones don't get promoted"; "unique within categories" [P-D] | Polarity mechanic legible in ≤ 10 s of play; 5/5 playtesters describe it as "magnet game," never "hook game" [T] |
| **Craft & authorship** | "Clear sense of human creativity, polish, and authorship"; explicitly declines "heavily tool-assisted or rapidly assembled" [P-D] | Ch. 29 authorship system: named human decisions on record, craft signatures shipped, AI ledger complete [T] |
| **Content safety** | "Avoid anything even slightly shocking; err on the safe side" [P-D] | Zero red-flag content; comedy falls are slapstick-safe (Ch. 29.3) [T] |
| **Portfolio fit** | "Good game overlapping too much with what's already on Poki" can still be declined [P-D] | Category gap documented: magnet- polarity climber absent from catalog [T] |

**The three numbers that are the whole game.** CTR, C2P, playtime are the web-fit funnel's weighted-equal trio [P-D]. Read their dependency chain: CTR is decided by one image (Ch. 17); C2P is decided by load speed and the first input moment (Ch. 23, 15); playtime is decided by the loop and its pacing (Ch. 11, 14, 25). Three images of the game — the card, the boot, the loop. A premium submission engineers all three in that order of leverage, because a weakness upstream taxes every measurement downstream.

---

## Chapter 4 — The Zero-Rejection Doctrine

### 4.1 The rejection taxonomy, and the requirement that kills each entry

Poki publishes exactly why games die [P-D, reading-results page]. This is that list, each row paired with where this PRD buries it:

| Rejection cause (their taxonomy) | Counter-requirement (our taxonomy) |
|---|---|
| Weak **click-through rate** → "your thumbnail" | Ch. 17: R-TH-01…10; composition scored before upload; no web-fit request until local 200ms panel ≥ 9/10 |
| Weak **average playtime** → "engagement; find where interest fades" | Ch. 14/25: pacing, celebration, cosmetics, ghost hooks; `npm run heatmap` workflow instruments every level |
| Weak **conversion to play** → "speed: file size, loading, onboarding" | Ch. 23: 3.5 MB ceiling, streamed boot, first-input ≤ 3 s desktop / ≤ 6 s mid-phone; Ch. 15: no-menu opener |
| **Originality & craft fall short** — "heavily tool-assisted or rapidly assembled" | Ch. 29 authorship system + Ch. 16/17 craft signatures no template produces |
| **Content conflicts** — "anything even slightly shocking" | Ch. 29.3 safety pass: wordless story, slapstick physics, zero violence/personality edge |
| **Portfolio covered** — overlaps existing categories | Ch. 11: the polarity USP legibility requirement; suggested categories chosen to occupy a gap (Ch. 30.6) |
| Hard-gate failure (devices / scaling / incognito / external requests / branding / adblock / SDK events) | Ch. 7 all rows already verified [QA]; re-verified in CI at every milestone (R-QA-02) |

### 4.2 The doctrine, in five laws

1. **The 200ms law.** Every decision a stranger makes about this game — click it or not, keep playing or not — is made before conscious thought, from the card, the boot frame, and the first motion. Engineer those three artifacts like they are the game, because commercially they are. (Ch. 17, 15, 16.)
2. **The margin law.** Never aim at a benchmark; aim one tier past it. Floors are where the bottom half of the library lives — the average Poki game already runs ~70% C2P / ~6 min [P-D]; a "passing" 66% and 5:10 is a below-average game that promotion forgets.
3. **The variance law.** The 500-player and 10,000-player tests are samples; samples have noise. The only defense is margin plus multiple independent engagement hooks (progression, ghosts, cosmetics, mastery) so no single audience taste swings the outcome.
4. **The evidence law.** Every claim in the submission dossier must be verifiable by a Poki QA tester in under a minute (a build, a log, a video). This PRD's evidence tags and the repo's test suite exist to make the dossier un-falsifiable.
5. **The authorship law.** Because this project is AI-accelerated, authorship is not a nicety — it is the *load-bearing answer* to the one published rejection reason aimed straight at us. Human decisions must be named, visible, and shipped inside the product itself (Ch. 29).

### 4.3 What this doctrine forbids (the anti-strategy)

- **No dark patterns.** No fake buttons, no forced-ad-before-restart traps, no engagement-by-annoyance. Poki's audience includes children, their reviewers know every trick, and the fastest way to a content rejection is cleverness in the wrong place.
- **No benchmark-gaming.** We do not inflate playtime with friction (long unskippable transitions, artificial waits); we inflate it with fun (the 3-minute loop that earns its fourth minute).
- **No over-polishing past the submission window.** The funnel is free, repeatable, and informative [P-D]; perfectionism before data is a worse strategy than submission plus iteration. The Final Gate (Ch. 35) defines *minimum* premium — not maximum polish.

### 4.4 The promise, stated with honesty

"Zero chance of rejection" cannot be *guaranteed* by anyone — the funnel includes 500 real strangers and a human panel, and their votes are the point. What this PRD guarantees instead is stronger and honest: **every rejection reason Poki publishes is answered with a tested countermeasure, every benchmark is targeted with margin, and no known unknown remains un-instrumented.** If the game still fails, it will fail on a reason outside their published system — which, by definition of a curated funnel, is a verdict about the market, not about the craft. That is the best deal any submission can strike, and this document exists to sign it.

# PART II — POKI DECODED

*Every claim in this part is tagged [P-D] (read from Poki's own developer documentation, October 2026) unless stated otherwise. This is the system that will judge the game; we read it the way their QA team writes it.*

---

## Chapter 5 — The Platform and Its Economics (Why Curation Is the Whole Game)

### 5.1 The scale, and what it means for a solo developer

Poki is the leading web-gaming platform: **100+ million monthly players**, **1B+ gameplays per month**, the **#1 web gaming platform in 100+ countries**, powered by a community of **500+ game developers**. High-performing games reach **5+ million monthly players each**. The platform is aggressively curated — every game is hand-picked and daily releases are limited so each accepted game gets a genuine shot at the audience.

For MAGNETOPE this scale cuts both ways. It means the ceiling is real: a hit here is not "a few thousand plays," it is millions of monthly players and the revenue that follows. It also means the floor is real: the queue of submissions is long, the reviewers are professional, and the funnel that filters it is designed to be *cold* — real strangers, real metrics, no sentiment.

### 5.2 The revenue model

- **Direct traffic — 100% to the developer.** Players who arrive via bookmark, search, your links, your socials, your community generate revenue fully credited to you.
- **Poki traffic — 50/50 split.** Players arriving from Poki.com pages and Poki's marketing split ad revenue; Poki's half funds the user acquisition that brought them.
- **Payouts:** wire transfer or PayPal, in your preferred currency, on the schedule defined in your agreement.
- **Engagement is the engine.** More playtime → more natural breaks → more impressions. SDK correctness is literally the money pipe (Ch. 7.7).
- **Realistic first-game earnings [R]:** Poki developer-rel staff publicly frame a first web game at roughly **$500–$3,000/month** depending on genre, update cadence, and tenure on the platform — with promoted hits substantially above that. Plan cash-flow on the low end, not the high end.

### 5.3 Why this PRD treats the funnel as the product's true final level

Poki does not accept games for being well engineered — it accepts games *strangers keep playing*. The entire organization (playtest videos, 500-player tests, 10,000-player category tests) exists to measure that single question with real humans before making a promise to the catalog. Therefore: a premium MAGNETOPE build is one engineered **for the measurement system**, not for the developer's own eye. Everything in Part III optimizes the numbers of Chapter 8 under the constraints of Chapter 7.

### 5.4 Platform capabilities this design may use (and no others)

| Capability | What it is | MMP use |
|---|---|---|
| **Poki SDK** | Ads, events, language, environment | The only monetization + telemetry channel. All events via `SdkBus` [S]. |
| **AUDS (Arbitrary User Data Store)** | Server-side per-player data storage | Ghost-exchange codes for friends/regional ghosts [S, `src/ui/ghost-exchange.ts`]; never for gameplay-critical state (must work offline). |
| **Netlib (networking library)** | Multiplayer networking | **Out of scope for v1** — single-player premium first; a co-op ghost-race mode is a roadmap item only. |
| **User accounts** | Poki-player identity | Optional future leaderboard names. Not required at submission. |
| **Poki Inspector** | Dev tool overlay incl. language selector | Mandatory QA device for localization verification (Ch. 27). |
| **Player device report** | Post-test device/performance telemetry | The authoritative low-end-device oracle; replaces our assumptions with their data after first player-fit test (Ch. 23.4). |

---

## Chapter 6 — The Funnel, Stage by Stage, With the Tactic for Each

Poki's funnel is not a black box; it is a published, repeatable, **free** pipeline [P-D]. Treat it as the world's best test rig — because that is exactly what it is. Iterate inside it; the developers who treat it as a loop are the ones who get accepted.

### 6.1 The five stages

| # | Stage | What happens | The gate | Duration | Repeatable? |
|---|---|---|---|---|---|
| 1 | **Add game** | Upload build or prototype; content moderation check (family-safe, policy) | Content policy | Days | Yes |
| 2 | **Playtesting** | 10 recorded gameplay videos from real Poki players | None — you watch for confusion (player-fit unlocks after watching 10 recordings) | First results often **within minutes**; hours typical | Unlimited |
| 3 | **Player fit test** | **500 real players** play; playtime measured (C2P not measured yet); requires a thumbnail | Healthy: **3+ min average playtime, 25%+ of plays over 3 minutes** | ~5 hours; up to 2 tests/day | Yes |
| 4 | **Web fit test** | Game appears on **real category pages** like a released game, ~10,000 players | Three metrics, **weighted equally**, scored 0–5 vs category benchmarks (Ch. 8) | ~3–5 days (sometimes longer; cannot be stopped mid-run) | Yes |
| 5 | **Final review** | The Poki team plays the game and reviews results | Quality, originality & craft, uniqueness within categories, fit | 1–2 weeks | One decision |
| → | **Release** | Agreement → QA → **Soft Release** on category pages → Global Release | Soft-release performance (conversion, engagement) | ~2–3 months total | — |

### 6.2 Stage tactics (what "premium" does at each gate)

**Stage 1 — Upload.** Upload *early and often*, at any stage of development. Content moderation is mechanical: run the Ch. 29.3 safety pass before first upload so there is never a moderation flag on the project's history. Keep `build:poki` green (R-QA-01) so every upload is a clean, audited artifact.

**Stage 2 — Playtests (use aggressively, they are free).** Ten recordings of strangers meeting your game cold — the cheapest, fastest truth in the industry. MMP protocol: run a playtest after W2 (opener), after W6 (levels 1–10 reworked), and before every player-fit test. Watch every video at 1× with a confusion log; require agreement between two watch passes. The two failure modes to code for, in Poki's own vocabulary: **"stuck"** = a difficulty problem (→ Ch. 14 retune); **"drifting away"** = a reward/new-challenge deficit (→ Ch. 25 hooks). Fix the single top confusion per round, and re-run. Do not upload a player-fit test with a known unresolved confusion from a playtest — that is paying for data you already own.

**Stage 3 — Player fit (500 strangers).** Playtime only. This test measures the 3-minute loop and the first three levels' ability to hold a bored, casual, majority-mobile audience. MMP enters this stage only when: the opener ships (W2), levels 1–10 pass the ≤10% median fall-rate gate (R-LD-14), and a local playtest shows zero "what do I do" moments. Target: not the healthy floor (3 min / 25%) but **5+ min median, 40%+ over 3 min** [T], because the web-fit benchmark above it assumes 5+, and the average game on the platform already runs ~6.

**Stage 4 — Web fit (10,000 impressions).** The dress rehearsal; three metrics, equally weighted, scored 0–5 against the category average where **3 = category average** [P-D]. Example category averages Poki cites: action/adventure ≈ **1.5% CTR, 4 minutes on page, 70% C2P**. MMP enters only after: thumbnail passes the local 200ms panel at ≥ 9/10 (R-TH-09), C2P-critical load numbers are verified on mid-tier mobile profiles (R-PE-06), and the suggested-category strategy of Ch. 30.6 is finalized (we may suggest up to 4 categories). During the test, if a bug is found: upload the new version and email developersupport@poki.com to swap the tested build — the test cannot be stopped, but it *can* be updated.

**Stage 5 — Final review.** Humans play the game and weigh: quality guidelines (originality and craft), uniqueness within the suggested categories, test results, and the content itself. This is where the "cheap AI game" perception dies or kills (Ch. 29): the authorship system must be *perceptible in the build itself* — craft signatures, the hand-authored feel moments, a distinctive tone. Also the stage where **portfolio overlap** is judged: our category suggestions must place MAGNETOPE where the magnet-polarity identity is the differentiator, not where it reads as "another stickman-flinger."

**Release pipeline.** Green-light → agreement/legal → their QA → soft release (2–3 weeks, live category pages, real conversion/engagement data) → global release. Soft release is a live audition with an update cadence expectation: monitor daily, fix fast. Post-release, thumbnails may only change with substantial content updates and Developer Support sign-off [P-D] — so the thumbnail that ships into the funnel must be right *before* web fit, not after.

### 6.3 The iteration discipline (Poki's own words: "not a verdict — data")

> "Not passing a stage isn't a verdict on your game. It's data." — Poki, *Interpreting your test results* [P-D]

The funnel's failure diagnoses are published: weak CTR → thumbnail; weak playtime → engagement (find where interest fades); weak C2P → speed (file size, loading, onboarding). MMP pre-invests in all three diagnosed systems *before* they can be red, which converts any future weak result from a surprise into a targeted iteration. And Poki's last word on failure is the strategy for this whole project: *keep the risks low, don't over-invest, bring us the next idea — plenty of Poki success stories didn't pass on the first try.* [P-D]

---

## Chapter 7 — Hard Requirements, Encyclopedic: The QA Checklist Decoded Line by Line

This is the pass/fail layer: "the bar for a smooth, player-friendly experience across all the devices and connections our audience uses" [P-D]. Poki's QA team checks every submission against this list. The current build passes every row [QA]; the rebuild must keep it that way **in CI at every milestone** (R-QA-02), because regression here is fatal.

### 7.1 Devices and control schemes

- **Desktop, mobile, tablet support.** On mobile, cover the full screen in portrait or landscape (or both). **Force touch-control schemes on tablets.**
- MMP state: verified at 1031×580 desktop, Pixel 7 portrait, 640×360 landscape with real touch events [QA]; tablet forcing in `src/platform/device.ts` [S]; 10 device profiles in tests [S].
- R-MO-01…R-MO-06 keep this true as UI evolves. The one open human item from `docs/SUBMISSION.md`: no *physical* device has run it yet — a pre-submission physical matrix (phone + tablet + low-end laptop) is mandatory (R-QA-08).

### 7.2 Aspect ratio and scaling

- **Scale proportionally to cover 640×360, 836×470, 1031×580.** Full-bleed canvas; Poki's frame is the page.
- MMP state: full-bleed verified at the canonical sizes; layout audit test covers 5 sizes × 7 languages [S]. R-UX-01 preserves full-bleed as the HUD gains elements: **no letterboxing, no bars, ever** — including during slow-mo, cutaways, and the ending.

### 7.3 Incognito and storage resilience

- **Incognito restricts localStorage → wrap every operation in try/catch; the game must stay playable.**
- MMP state: storage layer degrades to in-memory with a single notice; quota/denied/corrupt paths tested [S; QA]. This is a permanent invariant (R-QA-03): any new persistence feature (ghost codes, settings, cosmetic unlock) ships with an incognito test in the same PR.

### 7.4 No external requests

- **Poki blocks all external requests by default.** Bundle fonts, assets, libraries, everything. The only external tag permitted in a Poki build is the Poki SDK itself [P-D + QA].
- MMP state: `scripts/check-budget.mjs` audits the bundle for external URLs and dev hooks [S]. **The known bug:** `build:poki` invokes the audit *without* `--poki`, so the SDK tag false-positives and the gate is permanently red [QA]. **R-QA-01 fixes it in the first commit of W1** — one word, and it restores meaning to the entire gate.
- R-CM-01: zero runtime external requests, verified by CSP-locked test (`tests/release.test.ts` pattern) on every milestone build.

### 7.5 No branding, no third-party ads, no ad-block hostility

- **Remove splash screens and outgoing links** (studio logo is welcome on the loading screen only). **Poki's SDK handles ads — no other ad systems.** **The game must stay playable with an ad blocker active** (messaging about blockers is handled by Poki).
- MMP state: no third-party splash/anchors; SDK adapter try/catches init and every call so a blocked SDK never halts play [QA]. R-MZ-01…03 make the ad-free path a *designed experience*: menus readable, rewards gracefully unavailable, no dead buttons. Ad-block tolerance is tested, not assumed (R-QA-04).

### 7.6 SDK event rules — the money pipe

The exact rules, with the SdkBus guarantee [S] that satisfies each:

| Poki rule | SdkBus guarantee |
|---|---|
| No event twice in succession (`gameplayStart` after `gameplayStart`, etc.) | State machine transitions are total functions; double events unreachable by construction |
| `gameplayStart()` on the player's **first input**, not on load | The bus suppresses start until the first real input frame |
| `gameplayStop()` on any interruption (pause, menu, level end, cutscene) | Interruption sources all route through one bus entry point |
| No events during midrolls/rewarded videos | A locked flag during breaks; queue, don't fire |
| `commercialBreak()` **only** when exiting pause **into gameplay** (their example: closing Pause into gameplay ✅; leaving gameplay into level-select ❌) | The bus only issues a break on the pause→play transition specifically |
- Verified live: init → gameLoadingFinished → gameplayStart on first input → gameplayStop on pause → commercialBreak on resume (a real house-ad midroll served) → gameplayStart; zero doubles, zero page errors [QA]. Also enforced by a 10,000-input scripted trace test and a 2,100-input real-game fuzz judge [S].
- **One refinement from the SDK docs themselves:** Poki recommends calling `commercialBreak()` *before every gameplayStart* whenever the player has shown intent to continue playing [P-D]. This is a placement philosophy, not a rule — Ch. 24 tunes it into a pacing system rather than a habit.

### 7.7 Load, size, and stability

- **Fast load, stable frame rate, lean file size, across devices and engines.** [P-D]
- MMP state: 1.48 MB gzipped; WASM streamed; cold load ~1.3 s desktop, 4–5 s throttled mid-range phone [S, QA]; physics p99 < 3.5 ms on busiest levels; animation p99 0.14–0.31 ms against a 1.5 ms gate; restart 19–37 ms [S].
- Chapter 23 turns these facts into budgets with CI teeth. The premium ceiling: **3.5 MB gzipped total** [T] — enormous headroom used deliberately for the three things players can feel (Ch. 16, 20), never for asset waste.

### 7.8 The requirement this chapter creates

**R-QA-02 (The Milestone Gate):** at every milestone M1–M5, a CI job performs all of Chapter 7's checks against the real `build:poki` artifact: canonical-size layout audit, incognito session, CSP-locked serve, SDK trace judge, ad-block simulation, budget audit (with the `--poki` flag), cold-load profile, and the zero-page-error assertion. A milestone that fails any row does not ship to the next workstream. This single requirement is what makes "passes all hard gates" a property of the *process*, not a lucky afternoon in October.

## Chapter 8 — The Benchmarks That Actually Decide, and How They Are Scored

### 8.1 The three web-fit metrics, weighted equally, scored 0–5

The web fit test places the game on real category pages for **~10,000 real players** and measures [P-D]:

| Metric | What it reads | What it is really testing |
|---|---|---|
| **Click-through rate (CTR)** | Players who saw the thumbnail and clicked | One image, 200 ms of a stranger's attention |
| **Average time on page** | How long they stay once they arrive | The loop's ability to hold a stranger |
| **Conversion to play (C2P)** | Visitors who reached the first `gameplayStart()` event | Load speed + onboarding — everything before the first input |

Each is scored **0–5 against the benchmark average of the categories the game was tested in; a 3 means at-or-above the category average** [P-D]. Poki's own worked example: if action/adventure games average **1.5% CTR, 4 minutes on page, 70% C2P**, matching those scores a 3 on each. A 3 is a passing grade and an unremarkable game; premium means engineering toward **4s**, because the average hides genre variance and the panel reads scores, not raw numbers.

**Context for realistic C2P targets:** Poki notes that Unity builds typically land around **60–65% C2P even when well optimized** due to build weight — MAGNETOPE's 1.48 MB custom stack is the structural advantage here; no Unity tax [P-D + QA]. Also: **C2P feeds directly into traffic recommendations** — it is the metric that decides future promotion, not just acceptance [P-D].

### 8.2 Reading C2P like their analysts do (and pre-fixing the gaps)

> "Say your game converts 55% of players overall, but only 47% on mobile: that gap points to mobile loading and onboarding as the likely culprit… This could also reflect device performance." — Poki, *Interpreting your test results* [P-D]

The analytical habit: **split every metric by device class** (desktop vs mobile at minimum). MMP instrumentation (Ch. 26) logs device tier with every event from day one, so any desktop/mobile gap is diagnosable to a cause within one session of data. The pre-emptive fixes: load budgets defined per device tier (R-PE-06), touch onboarding parity with mouse (R-ON-05), and tier-low auto-graphics before the first frame draws (R-PE-08).

### 8.3 The playtime benchmarks, and the "floor vs library" reality

- Base targets [P-D]: **65%+ C2P, 5+ minutes average playtime** (10+ for management/sim), player-fit healthy result = **3+ min average, 25%+ of plays over 3 minutes**.
- Reality [P-D]: the *average* game on Poki already achieves **~70% C2P and ~6+ minutes**. "These numbers are treated as a floor, not a finish line."
- MMP targets (Ch. 3): **75/70 (overall/mobile) C2P, 7 min average, 40% over 3 minutes** — each with one visible-system-of-margin (thumbnail, loop pacing, load budget) rather than raw hope.
- The web-fit "time on page" that matches a 7-minute average playtime is bought by exactly three systems: the 3-minute repeatable loop [P-D: "quick, satisfying, repeatable loops of around 3 minutes perform best"], the celebration/hook stack (Ch. 25), and ~60–75 minutes of first-run content [S] — which Poki's engagement doc calls the right scope ("about an hour of content is usually the right scope"; "make the first minutes brilliant before making the tenth hour deep") [P-D].

### 8.4 The meta-benchmark nobody writes down

Every metric above is a *sample of strangers*. The 100-seat panel's unanimous warning, in Swink's vocabulary: feel is the input, metrics are the echo [R]. You cannot retune a funnel number directly; you can only build the thing that produces it. That is why Part III exists: chapters that engineer CTR (17), C2P (15, 23), and playtime (11, 14, 25) as *design systems*, so when the funnel finally measures MAGNETOPE, it is measuring something that was built to be measured.

---

## Chapter 9 — Monetization: Poki's Rules, the Revenue Model, and MAGNETOPE's Ad Etiquette

### 9.1 The revenue model (the money truth)

Direct traffic pays **100% to the developer**; Poki-sourced traffic splits **50/50**; payouts via wire/PayPal on agreement terms [P-D]. The model is engagement-driven: **more playtime → more natural breaks → more impressions** [P-D]. Monetization design and engagement design are the same discipline on this platform — a game with healthy pacing earns; a game with friction does not.

### 9.2 Poki's published monetization doctrine, applied row by row

| Poki rule/tip [P-D] | MAGNETOPE implementation | Requirement |
|---|---|---|
| Think about monetization early so ads feel natural, not forced | Ad moments designed into the level flow (clear cards, biome gates) from the start, not bolted on | R-MZ-01 |
| **One understandable currency; no secondary currencies** (web players dislike them) | Scrap stays the sole currency; stars are progression, never spendable; cosmetics cost Scrap or nothing [S] | R-MZ-02 |
| Rewarded taxonomy: *helping hand* (revives, skips, hints, boosts) / *in-game economy* / *customization* | Three placements: cosmetic unlock path [S: 8 reward-path items], Scrap doubler on the clear card, coach-supercharge hint for stuck players | R-MZ-04 |
| **The natural, non-rewarded option sits in the primary position** | Free path always first: Restart is free and instant [S]; coach hints free; rewarded options secondary-positioned | R-MZ-05 |
| Don't be pushy — too many prompts lower engagement | Max 1 rewarded prompt per ~2 min; max 3 distinct placements per session; prompts never appear during motion | R-MZ-06 |
| Use the industry-standard video icon on rewarded buttons | Shipped icon set (`src/ui/icons.ts`) gains the standard play-in-video glyph | R-MZ-07 |
| **Celebrate rewards** (animation, sound, confirmation) | Reward grant reuses the celebration system (confetti sparks + chime) with a distinct reward flourish | R-MZ-08 |
| Apply rewards automatically where possible | Doubler auto-applies on next clear; unlock auto-equips into locker with toast | R-MZ-09 |
| Unlimited rewarded views allowed, but cap what protects balance/progression | Daily Scrap-from-ads cap (e.g., 200 Scrap/day) so the economy stays meaningful | R-MZ-10 |
| Dynamic rewarded opportunities at specific moments | Doubler appears only on the clear card when run time > 25 s (earned, not given) | R-MZ-11 |
| Temporary / themed content (weekly, seasonal unlocks) | 4 seasonal cosmetics + one weekly rotating spotlight item in the locker [S: seasonal slots] | R-MZ-12 |

### 9.3 Commercial breaks as pacing, not punishment

Poki's SDK guidance is explicit: call `commercialBreak()` **before every `gameplayStart()` where the player has shown intent to continue**, and *only* on the pause→gameplay transition [P-D]. "Intent" is the operative word — the player's action says *continue*, the break rides that consent. MAGNETOPE's placement map (tuned to keep the 3-minute loop intact):

| Moment | Player intent signal | Break? |
|---|---|---|
| First input of a session (session 0, first ever run) | — | **Never** [S: matches original FTUE arc; first break no earlier than second 60] |
| Exiting pause into gameplay | Pressing Resume | **Always** [P-D hard rule] |
| Level clear card → Next level | Pressing Next | Yes, if ≥ 90 s since the last break [T] |
| Level clear card → Retry | Pressing Retry | Yes if ≥ 180 s since last break, else skip [T] — retry-momentum is sacred (Ch. 13) |
| Entering level select / locker / settings | — | **Never** (menu is not gameplay intent; also matches the hard rule's exit direction) |
| Ending cutscene | — | Never (emotion is the payoff; never sell over it) |

**R-MZ-03 (break floor):** no two commercial breaks within 90 s of each other in any session, enforced in the SdkBus placement layer (not by the caller), tested with the existing 10,000-input trace harness [S].

### 9.4 Rewarded eCPM reality (why placements matter so much)

Industry benchmark for rewarded video is the highest-value standard format — roughly **$10–$50 eCPM in mobile contexts [R]**, and the pattern holds on web portals: a *willing* viewer is worth multiples of an interrupted one. This is the economic mirror of Poki's "don't be pushy" rule — every aggressive prompt trades a $10–$50 impression for a 0¢ one and burns engagement to get it. The locker's reward-path cosmetics (the Stickman-Hook playbook: 14 of its 23 skins were ad-unlockable, with weekly rotations [R]) are the premium implementation: rewarded demand woven into a collection goal the player *wants*, not a toll.

### 9.5 What monetization may never do on this project

- **Never gate progression.** All 70 levels, all stars, the ending: reachable with zero ads and zero Scrap spending [S: progression never gates on cosmetics — keep it that way] (R-MZ-02).
- **Never interrupt motion.** No break, prompt, or toon during charging, flight, snap, or slow-mo (R-MZ-06). A physics climber lives on momentum; monetization rides pauses in momentum.
- **Never touch children's data.** No analytics beyond Poki's own SDK; no external calls of any kind (Ch. 29.4) (R-CM-01).
- **Never look like an ad farm.** The zero-ad experience must feel complete: if every rewarded button vanished tomorrow, the game is still a 7-minute premium experience (R-MZ-13). This is the monetization definition of premium — and, per Ch. 7.5, it is also the ad-blocker compliance requirement, twice over.

---

## Chapter 10 — The Rejection Taxonomy, Expanded: Every Published "No," Answered

Chapter 4.1 compressed this into a map. This chapter is the full treatment — because a premium submission must survive a reviewer *whose job is finding reasons to say no*.

### 10.1 The three metric rejections (and their published cures)

**"Below the bar on a web fit metric" is not one failure — it is three distinct diseases [P-D]:**

1. **Weak CTR → the thumbnail.** Their cure is one sentence: *revisit thumbnail best practices, consider a fresh take.* Ours is a system (Ch. 17): composition rules scored locally, three variants generated, the winner verified at card size before upload. The reason this PRD spends an entire chapter on one image is this row of their table.
2. **Weak average playtime → engagement.** Their cure: *playtesting and player fit to find where interest fades, then rework the loop or content.* Ours is the pre-work (Ch. 14, 25) plus the instrumentation to watch it happen (Ch. 26): per-level fall/quit telemetry exists in the repo (`tools/heatmap`, `tools/playtest` [S]); the premium build makes reading it a weekly ritual during soft release.
3. **Weak C2P → speed.** Their cure, verbatim: *"Shrink your file size, shorten loading, and make onboarding snappy. Getting players into gameplay fast is everything here."* [P-D] Ours: the 3.5 MB ceiling, streamed boot, no-menu opener, first input ≤ 3 s desktop / ≤ 6 s mid-range mobile (Ch. 15, 23) — and the device-split C2P reading habit of Ch. 8.2.

### 10.2 Originality and craft — the rejection reason aimed at *this exact project*

The full published wording [P-D]:

> "We look for original games with a clear sense of **human creativity, polish, and authorship**. Using AI and other tools to accelerate development is fine; **games that feel heavily tool-assisted or rapidly assembled are not.** Downloaded templates and repackaged APKs don't qualify as original work."

Read it twice, because it is the most important paragraph in this entire PRD for MAGNETOPE's specific situation. The good news is precise: **AI acceleration is explicitly fine.** The fatal tell is *feeling* — "heavily tool-assisted or rapidly assembled" is a perceptual crime, and perception is designable. The defense has four layers (full system in Ch. 29):

1. **Structural originality** — the polarity mechanic (stick → charge → flip → snap with momentum preserved) is not a template, not a clone, not a port [S: `tests/magno`]; the clone-defence table in `docs/SUBMISSION.md` documents it across art, mechanics, progression, UI, audio, character, name.
2. **Procedural, authored assets** — every model is generated in code (`src/render/kit-*.ts`), no asset packs [S] — the *opposite* of "downloaded templates."
3. **Craft signatures** — the moments no assembly line produces (Ch. 16): the scripted first launch, the fall-grade system, the wordless ending, the ghost exchange between friends.
4. **The authorship ledger** — `docs/AI_LEDGER.md` naming what the human decided [S], completed and honest (Ch. 29.2): the record of a creative director, not an excuse for one.

### 10.3 Content safety — "anything even slightly shocking"

Poki's bar is blunt: the platform "has to feel safe and comfortable for a wide audience and for the advertisers every game depends on"; they "avoid anything **even slightly shocking**" and "deliberately err on the safe side" [P-D]. The reviewer's thumb lands on the scale toward caution — so the submission must make caution unnecessary.

MAGNETOPE's safety audit (Ch. 29.3 validates it as a checklist): a robot protagonist with a magnet head; zero violence (falls are slapstick — bounce, daze, blink, get up); zero text in gameplay (7 locales = menus only); zero religion/politics/horror; no gambling mechanics in the economy (Scrap is earned by play, never wagered); no personal data beyond Poki's own SDK; the wordless story is "a small robot climbs home" — the most defensible plot on Earth. The one positioning watch-item: the "rage game" tag [S: suggested tags list] is a genre label on Poki (Level Devil is a top hit [P-D]), not a content concern — but the *tone* must stay funny-first (the fall grading and share cards are comedy systems [S]), never punishing. Comedy is the safety system. Ship the joke, not the punishment.

### 10.4 Portfolio overlap — "the good game that still dies"

The quietest rejection [P-D]: *"Sometimes a good game overlaps too much with what's already on Poki in its categories."* MAGNETOPE's adjacency risk is documented and real: the swing-fling lineage (Stickman Hook and friends) is thick on the platform, and a reviewer pattern-matches in seconds [QA: my own review did exactly this]. Countermeasures, all mandatory:

- **Legibility requirement (R-GD-07):** within 10 seconds of first input, the *polarity flip* must be unmissable — field-line rings, snap arcs, the cyan pulse — so "magnet game" is the read, not "hook game."
- **Thumbnail identity (R-TH-04):** the card shows field lines and a snap mid-arc — imagery the hook-genre cannot produce.
- **Category strategy (Ch. 30.6):** suggest the four categories where the mechanic, not the adjective, differentiates (physics, puzzle, skill, one-button; not "swing/stickman" spaces).
- **Vocabulary of difference:** store copy leads with "flip polarity" [S: tagline "Charge. Flip. Fling…"], never with fling/sling words alone.

### 10.5 If it still doesn't pass — the published contingency, adopted as strategy

Poki's last published word on failure [P-D]: *not passing is data, iteration is the way, tests are free and repeatable — and "plenty of Poki success stories didn't pass on the first try." Keep risks low, don't over-invest, bring the next idea.* This PRD adopts that posture operationally (Ch. 36): the funnels are free instruments — run them hard, fix what they surface, and never let one game's verdict become one developer's verdict. The portfolio insight from the platform's own success stories [R: Blumgi's 100M-players-in-2-years journey was built on shipping many small games that cross-promote] is scheduled reality, not comfort: MAGNETOPE ships premium *and* the next game starts the week it's submitted.

# PART III — THE EXPERT PANELS
## Twenty-one domains, one hundred seats, 234 binding requirements

*Format of every chapter in this part: (1) The commission — each seat's published doctrine, in their own established vocabulary, compressed to what changes MAGNETOPE. (2) The diagnosis — what that doctrine says about the current build. (3) Requirements — `R-XX-NN`, binding, each with an acceptance test. (4) Anti-patterns — what the panel explicitly forbids. (5) Build directive — the machine instruction.*

---

## Chapter 11 — Game Direction & Vision (Commission A)

### 11.1 The seats and their doctrine

**Seat 1 — Shigeru Miyamoto** (Nintendo; documented across a half-century of interviews and Nintendo's published design philosophy). Doctrine: *find the fun* — prototype the verb until the verb alone delights, then build the world around it; and the game should teach the controls in the first screen without a word. Demand: **the flip itself must be fun with zero progression attached** — strip the game to one button in a gray room; if launching MAGNO doesn't delight, nothing downstream matters [R].

**Seat 2 — Sid Meier** (Civilization; documented lectures and memoir *Sid Meier's Memoir!*). Doctrine: a game is a *series of interesting decisions*; the player should always be choosing, and the good choice should never be obvious. Demand: **a charge that is always maxed is not a decision** — the mid-power exit (charge-cutting during the 60 ms ramp [S]) and the when-to-release timing must be live decisions on every single flight.

**Seat 3 — Jesse Schell** (CMU; *The Art of Game Design: A Book of Lenses*). Doctrine: apply the **Lens of the Player** — the game is an experience in someone else's head, not a machine on your disk; walk the player's path, not the designer's. Demand: **every screen of MAGNETOPE is justifiable by what the *player* is trying to do at that second** — HUD element by HUD element, menu by menu, in the Ch. 21 audit.

**Seat 4 — Raph Koster** (*Theory of Fun for Game Design*). Doctrine: *fun is the feedback the brain gives for learning a pattern in a safe environment*; games are patterns to learn, and boredom is a pattern exhausted. Demand: **seventy levels must be seventy teach-then-test stories** — each level introduces or recombines one pattern (the twist prop [S]), never repeats a solved one without escalation, and the ending must be the final exam of everything learned.

**Seat 5 — Nicole Lazzaro** (4 Keys 2 Fun research, XEODesign). Doctrine: four distinct fun-emotions drive play — **Hard Fun** (mastery against obstacle), **Easy Fun** (curiosity, exploration), **Serious Fun** (meaning, collection, completion), **People Fun** (sharing, competition, connection). Demand: **all four keys are present within the first session**, not just Hard Fun: stars for the mastery player, biome spectacle for the explorer, the fall-grade collection and Scrap locker for the completionist, ghost exchange for the social player [S: ghost-exchange exists — surface it in session 0].

**Seat 6 — Jenova Chen** (thatgamecompany; *Flow* — built on Csikszentmihalyi's flow theory — plus *Flower* and *Journey*). Doctrine: the emotional arc of a session is a designed object; difficulty should ride the **flow channel** — challenge slightly ahead of growing skill, never spiking into anxiety nor sagging into boredom. Demand: **the 6%→68% fall-rate curve [S] becomes a per-biome flow audit** — every 5-level window is checked against the skill the player has *actually* been taught, and the Stratosphere gravity change must re-teach, not re-punish (Ch. 14).

**Seat 7 — Robin Hunicke** (with LeBlanc & Zubek: the **MDA framework** — Mechanics → Dynamics → Aesthetics). Doctrine: designers ship mechanics, players feel aesthetics; the dynamics in between must be *tuned*, and the aesthetics named. Demand: **name the target aesthetic of every moment** (Ch. 16's spectacle table): the launch is *triumph*, the fall is *slapstick comedy*, the snap is *relief-then-momentum*, the ending is *bittersweet homecoming* — and a named aesthetic that fails its moment is a bug in the dynamics layer.

**Seat 8 — Nolan Bushnell** (Atari founder; documented maxim from the coin-op era). Doctrine: **"Easy to learn, difficult to master"** — the arcade's entire economics in five words; the same words Poki's audience lives by. Demand: **session 0 must reach "easy" in 10 seconds and the first hint of "difficult" only after minute 3** — the skill ceiling is for the players who stay, and it must never tax the players who won't.

**Seat 9 — Jesper Juul** (*A Casual Revolution*). Doctrine: casual players are not lesser players — they are players with **different fit-to-life constraints**; games that win respect the interrupted moment, require no homework, and are playable in the gaps of a day. Demand: **MAGNETOPE must be fully lovable in 90 seconds and fully pause-able in every one of those seconds** — no unskippable moment longer than the ending credits, no session-shaming, no tutorial wall.

**Seat 10 — Tracy Fullerton** (USC; *Game Design Workshop*, the **playcentric process**). Doctrine: iterate on *player experience*, not on the plan — prototype, playtest, refine, in a loop, from day one. Demand: **the funnel becomes the studio process** (Ch. 6.2): free playtests are institutionalized as scheduled milestones, with confusion logs and fix-loop closure — the Poki test rig *is* the workshop.

### 11.2 The diagnosis

The verbs are right: STICK, CHARGE-FLIP, SNAP is a three-verb control surface with real depth (momentum, weak metal, air steering) [S]. The arc systems exist: stars, ghosts, Scrap, biomes, a wordless ending [S]. What the commission flags is *positioning*: the game's personality — magnet polarity as comedy-physics — is present but under-announced, in the opener, in the card, in the first ten seconds (Ch. 10.4's "another hook game?" risk). Direction fixes that at the identity level; the chapters downstream fix it at the artifact level.

### 11.3 Requirements — R-GD-01 … R-GD-08

- **R-GD-01 — The Verb Test.** Stripped-verb play (one button, gray room, no progression) must still be reported "fun" by ≥ 3/5 internal testers in a 2-minute free-play probe [T]. *Test:* a `--verb-probe` dev harness exists (`tools/probe` pattern [S]) and the probe session log ships with the milestone.
- **R-GD-02 — Three-verb purity.** No fourth control verb may appear before level 11; new interactions after that are *twists* (props), not controls [S: twist system]. *Test:* `tests/tutorial.test.ts` asserts control-surface size per level index.
- **R-GD-03 — Decision density.** Every 10-second window of flight in any level contains ≥ 2 meaningful decisions (power choice, release timing, snap target, steering) [T]. *Test:* solver trace on the 7 busiest levels (`tools/solve` [S]) asserts ≥ 2 decision points per window.
- **R-GD-04 — Four keys in session 0.** Hard Fun (first star), Easy Fun (biome reveal beat), Serious Fun (first fall-grade card + first Scrap), People Fun (ghost-exchange prompt seen) — all four witnessed within the first session in a fresh-profile session test [T]. *Test:* `tests/session.test.ts` extends to assert all four.
- **R-GD-05 — Flow-window audit.** Fall-rate curve stays within the band [6% … 68%] [S], monotone within each 5-level window except at biome transitions, where a one-level "re-teach dip" of ≤ 20% relative drop precedes the new mechanic's difficulty [T]. *Test:* `npm run heatmap` synthetic verdicts + `tests/levels.test.ts` curve assertions.
- **R-GD-06 — Interruptibility.** Every moment of play is pausable; every pause resumes in < 1 s; no unskippable sequence except the ≤ 30 s ending (skippable after first viewing) [S: ending skippable — keep]. *Test:* randomized pause fuzz (input-fuzz harness pattern [S]) resumes cleanly 100%.
- **R-GD-07 — The magnet read.** In first-time playtests, 5/5 players describe the game unprompted with magnet/polarity vocabulary within 10 s of first input [T]. *Test:* playtest protocol includes the vocabulary probe; failure blocks submission.
- **R-GD-08 — Playcentric cadence.** A Poki playtest runs after every even milestone (M2, M4) and before every funnel test; findings are logged in `docs/ROADMAP.md` with closure status [T]. *Test:* roadmap ledger entries exist with dates.

### 11.4 Anti-patterns (Commission A, unanimous)

- Adding a fourth verb to "add depth" — depth comes from the charge-decision space, not more buttons (Meier, Koster).
- Tutorial text — the first screen teaches by doing; if a word is needed, the design failed (Miyamoto; see Ch. 15).
- Difficulty as identity ("rage game" *tone*) — rage is a genre label, never a design value (Juul; Ch. 10.3).
- Progression that must be explained — Scrap buys cosmetics only, and the locker explains itself in one glance [S] (Bushnell).

### 11.5 Build directive

Preserve the three-verb sim untouched. Add: the verb-probe harness (R-GD-01), the session-0 four-keys beats (R-GD-04, lands in `src/game/game.ts` + `coach.ts`), the flow-window curve assertions (R-GD-05, lands in `tests/levels.test.ts` + tuning table), the vocabulary-probe playtest protocol (R-GD-07, lands in `docs/SUBMISSION.md` playtest script). Direction requirements are cheap in code and expensive in discipline — they are mostly *tests and rituals*, and they are the spine every other chapter hangs from.

---

## Chapter 12 — The Core Loop & Mechanic Depth

### 12.1 The loop, precisely [S]

The closed six-step loop completes in **under three minutes** and is engineered so any interruption (ad, tab switch, bus arrival) lands *mid-loop* rather than at a cliff — the web-session survival strategy [S: original PRD, retained verbatim]:

```
SEE LEVEL → PLAN ROUTE (visual dialect: surfaces, hazards, magnets)
→ EXECUTE (stick · charge · flip · steer · snap)
→ RESOLVE (clear / fall / grade)
→ CELEBRATE (stars, confetti sparks, chime, Scrap)
→ DANGLE (next level card + ghost + one locker item visible)
→ REPEAT
```

Three parallel progression tracks keep three kinds of player moving [S]: **Stars** (up to 3 per level; biome gates at soft thresholds — biome 2 at 15 stars; 210 stars total for completionists), **Ghosts** (par ghost → personal ghost after beating par → friend/regional ghosts via exchange), and **Scrap** (10–50 per first clear, 2–8 on replays; cosmetics only, never progression).

### 12.2 Why this loop is already elite (and what "premium" adds)

Stickman Hook's published anatomy [R] — runs that die in under 5 seconds, restarts so cheap that "one more go" is involuntary, a cosmetic dangling after every level — is the platform's proof that *loop economy* beats content volume. MAGNETOPE's loop is longer (30–90 s levels [S]) but structurally the same machine. The premium deltas, each a requirement below: (a) the celebration currently exists but must become *addictive-grade* (Ch. 25); (b) the dangle must be visible on every clear card, not just implied; (c) the loop's mastery ceiling — no-assist runs, charge-cutting, weak-metal timing, route optimization against ghosts [S] — must be surfaced as an *achievement ladder*, not left for the player to discover.

### 12.3 Requirements — R-CL-01 … R-CL-10

- **R-CL-01 — Three-minute guarantee.** Loop completes < 180 s for a median first-time clear of any level [S preserved]. *Test:* solver par + first-clear telemetry p50 < 180 s across all 70 routes.
- **R-CL-02 — Momentum conservation.** Velocity on snap-attach is preserved per the existing magnet controller rules [S]; no velocity reset patches ever. *Test:* `tests/magno.test.ts` momentum cases stay green and gain a chain-velocity case (flip→snap→flip in one continuous arc).
- **R-CL-03 — Charge is a decision.** Hold-duration → launch-power curve plus the 60 ms ramp cut [S] give ≥ 3 meaningfully distinct exits (short hop, mid arc, full power) with distinct outcomes on ≥ 90% of levels. *Test:* reach harness (`npm run reach` [S]) logs per-level that all three powers reach distinct first surfaces.
- **R-CL-04 — Mastery ladder is visible.** The game states its own depth: a post-clear "mastery ribbon" (time vs par, assist used?, weak metals broken) shown on the clear card [T]. *Test:* `tests/screens.test.ts` asserts ribbon fields per locale.
- **R-CL-05 — Risk dial.** Assist-off play earns +5% Scrap [S preserved]; a *no-assist* ghost time is recorded as the par-tier above. *Test:* progression economy test covers the bonus path.
- **R-CL-06 — Ghost ladder.** Par → personal → friend (exchange code) → regional (AUDS) — every rung individually visible in-level (ghost view exists [S]); regional requires a Poki AUDS round-trip that degrades to friend-ghosts offline. *Test:* ghost-exchange tests + offline degradation case.
- **R-CL-07 — Interruption survival.** Any state is pause-safe; resume restores to the exact input frame (deterministic replay snapshot [S]); a killed tab recovers to the last checkpoint on reload. *Test:* session test's reload case extended to mid-charge kill.
- **R-CL-08 — Retry latency.** R / retry-button restart < 50 ms, no intermediate screen [S: 19–37 ms on heaviest levels — preserved]. *Test:* restart-time harness stays in CI.
- **R-CL-09 — Three currencies of achievement.** Stars (mastery), speed (par/personal ghosts), Scrap (collection) are shown as *three separate tallies* on the clear card and map screen [S: "scoring pays out three currencies of achievement"]. *Test:* HUD/screens assertions.
- **R-CL-10 — Loop-owned content.** All 70 levels + ending are reachable with zero ads watched and zero Scrap spent [T]. *Test:* progression suite gains a "no-ads, no-spend full clear" bot run.

### 12.4 Anti-patterns

- Paying to retry or skip (Koster: mastery for sale is learning interrupted; also Ch. 9.4).
- Dangle fatigue — the clear card must rotate its dangle (ghost, cosmetic, star, biome tease), never the same badge twice in a row [T].
- Lengthening levels to pad playtime — the 3-minute loop is the *unit*; playtime grows by better loops, not longer ones [P-D: 3-minute guidance].

### 12.5 Build directive

The loop code (`src/game/game.ts`, `src/ui/*` clear-card flow) gains: mastery ribbon (R-CL-04), rotating dangle (R-CL-04/12.4), ghost-ladder visibility states (R-CL-06), three-tally surfaces (R-CL-09). The sim gains nothing except a recorded assist-off flag (R-CL-05). Everything else is tests. **The loop is the product; this chapter's additions are deliberately surgical.**

---

## Chapter 13 — Game Feel & Juice (Commission B)

### 13.1 The seats and their doctrine

**Seat 11 — Steve Swink** (*Game Feel: A Game Designer's Guide to Virtual Sensation*). Doctrine: game feel is three things — **real-time control** (the avatar does what you intend, when you intend), **simulated space** (a world with believable weight you can intuit), and **polish** (feedback that amplifies what already works). His principles of feel: **predictable results, instantaneous response, easy but deep, appealing response, organic motion, harmony, ownership**. The order is law: *polish cannot rescue lag* — "polishing a game whose controls lag is putting a fresh coat of paint on a broken machine." Demand: response first — every input answers inside one frame at 60 Hz; then, and only then, juice.

**Seat 12 — Martin Jonasson & Petri Purho** (*Juice It or Lose It*, 2012 — the canonical talk). Doctrine: take a dull Breakout clone and pile on reactions — squash, stretch, particles, trails, sound, score pop — and the *same mechanics* feel alive; everything the player touches should visibly react, and everything that moves should feed back. Demand: no inert object may be touched: MAGNO's every state change (stick, charge, release, snap, slide, daze, clear, fall) carries a visible reaction stack.

**Seat 13 — Jan Willem Nijman** (Vlambeer; *The Art of Screenshake*, 2013). Doctrine: ~30 rapid tricks — hit-stop, camera kick, muzzle flash, freeze frames — that made Nuclear Throne feel violent and immediate; impact is a *composition* of small feedbacks, not one big effect. Demand: the launch is a composition: hit-stop + kick + flash + burst + voice, layered in the order his talk layers them.

**Seat 14 — Frank Thomas & Ollie Johnston** (*The Illusion of Life*, Disney's Twelve Principles). Doctrine: squash & stretch, **anticipation**, follow-through, overlapping action, timing — the 1930s grammar of life. Demand: MAGNO must *anticipate* before he launches (coil), *follow through* after he snaps (wobble), and overlap his secondary motion (eye blinks, magnet head counter-tilt) with his primary motion — a rig that moves like it was drawn, not like it was placed.

**Seat 15 — Richard Williams** (*The Animator's Survival Kit*). Doctrine: **timing and spacing** carry weight; breakdowns are where believability lives; a heavy thing and a light thing are distinguished by frames, not by polygons. Demand: MAGNO's mass must be legible in his arcs — slow-in/slow-out on the launch arc, hard fast impact on snap — with timing curves tuned per surface material.

**Seat 16 — Maddy Thorson** (Celeste — documented design write-ups on feel). Doctrine: forgiveness windows — coyote time and jump buffering of a few frames each — convert "player intent" into "player success" without ever feeling sloppy; keep the windows small (≤ ~150 ms); and an assist mode is *respect*, not cheating. Demand: coyote and buffer windows stay tuned, named in `tuning.ts`, and the snap-assist toggle carries zero shame.

**Seat 17 — Derek Yu** (Spelunky — documented essays on readability in motion). Doctrine: deterministic, readable physics is a *feel* feature: the player learns the world because the world never lies. Demand: MAGNO's determinism (fixed 60 Hz, bit-identical [S]) must never be traded for spectacle; any effect that *implies* physics the sim doesn't have is a lie and gets cut.

**Seat 18 — Bennett Foddy** (QWOP, *Getting Over It* — documented talks on failure aesthetics). Doctrine: failure can be the *most entertaining* thing your game does; losses deserve choreography, sound, and comic timing — the spectacle of loss is what makes players restart laughing instead of quitting. Demand: MAGNETOPE's fall-grading system [S] is already this idea — the falls must complete their comedy: setup (windmilling), punchline (impact + daze beat), topper (grade card with a deadpan line).

**Seat 19 — Mark Brown** (Game Maker's Toolkit — the field's standard juice checklists, e.g. *How to Make Your Game Feel Good*). Doctrine: feel is testable via checklist — does input respond instantly, does every action answer back with readable feedback, does polish (squash, shake, particles, sound) turn correctness into satisfaction? Demand: the Feel Bible (R-GF-14) — the checklist, written down, in CI.

**Seat 20 — Glen Keane** (Disney — the line of action and *appeal* in motion; documented masterclasses). Doctrine: appeal is readability plus charisma: a single line of action through the pose, and a character who enjoys being alive. Demand: MAGNO's flight poses follow a drawn arc — a line of action through every launch — and the rig must *love* moving: the eye leads the flight, the body chases it.

### 13.2 The diagnosis

The feel machinery is unusually complete [S, QA]: coyote window, input buffer, auto-align snap assist, weak-metal decay, attach friction ramp (250 ms joint + 1,800 N over 60 ms), a three-class shake grammar (capped at 1.2°, exponential decay, hard "never during aim" rule), a slow-motion fall system with a per-session budget (max 4 per 3 min), squash/stretch and secondary-motion test coverage (`tests/snap-juice`, `secondary-motion`, `motion-tokens`, `animation-budget` [S]). The prior verdict's one feel complaint: **the launch — the signature moment of the entire game — reads slightly soft in still frames** [QA], and static capture cannot fully judge motion, so the mandate is *verify in motion and escalate*: the launch must punch like a Vlambeer game, without breaking a single existing budget.

### 13.3 Requirements — R-GF-01 … R-GF-14

- **R-GF-01 — The launch is a composition (Nijman stack).** Full-power release fires, within the existing animation budget: hit-stop 40–80 ms at release → camera kick along flight vector (decay < 300 ms) → spark ring burst at origin → rig stretch along line of action → FOV pop +3° settling back over 400 ms [T]. *Test:* `tests/snap-juice.test.ts` gains a release-assertion case; a capture diff on scrapyard-00 shows ≥ 5 distinct simultaneous feedbacks in the release frame.
- **R-GF-02 — Anticipation & follow-through everywhere (Thomas/Johnston/Williams).** Pre-release coil (squash 120 ms before launch), post-snap wobble (damped oscillation ≤ 3 cycles), eye-leads-body overlapping action in flight. *Test:* `tests/render.test.ts` rig assertions; frozen-frame audit per R-GF-11.
- **R-GF-03 — Forgiveness windows stay tuned, named, small.** Coyote and buffer entries live in `tuning.ts` with names and comments; all ≤ 150 ms [R: Thorson's "forgiving, not sloppy"]; assist toggle text carries zero shame ("Snap assist: CATCH ME / LET ME FLY"). *Test:* tuning-table presence test + `tests/magno.test.ts` window values.
- **R-GF-04 — Snap = relief-then-momentum.** On catch: impact squash (≤ 120 ms), spark burst sized by impact speed, surface-material voice, magnet-glow pulse on the caught surface, camera settle — and momentum visibly continues (no dead stop). *Test:* snap case in juice suite asserts all six; momentum case from R-CL-02 re-runs against the visual layer.
- **R-GF-05 — The charge is a scene, not a wait.** Field rings expand with power, hum pitch ramps (audio map, Ch. 20), meter segments pulse at 33/66/100%, rig micro-shiver at 100%, subtle dolly-in ≤ 4% focal length. *Test:* charge-state animation assertions + audio-event assertions mid-charge.
- **R-GF-06 — Shake & hit-stop discipline.** Preserve the three-class grammar, 1.2° cap, exponential decay, never-during-aim rule [S]; hit-stop ≤ 80 ms, never stacked, max 1/s [R]. *Test:* `tests/animation-budget.test.ts` adds hit-stop ledger; hazard-clock test extended.
- **R-GF-07 — Falls complete the comedy (Foddy).** Setup (windmill + "uh-oh" rig look at the ground), punchline (impact + daze blink + wobble), topper (grade card with deadpan copy, per-locale). Big-fall slow-mo preserved with its 4-per-3-minute budget [S]. *Test:* `tests/fall.test.ts` gains the three-beat assertion; share-card test stays green.
- **R-GF-08 — No silent spectacle.** Every juice event has a mapped voice in the audio director (Ch. 20 table); a visual event with zero sound entries fails CI. *Test:* event-map completeness test (audio recipe registry vs render event names).
- **R-GF-09 — Numbers pop.** Star stamps punch-in with scale-settle (≤ 300 ms); Scrap counter tick-up ≤ 600 ms with coin-voice per tick capped at 8/s. *Test:* HUD reveal test + loudness timing budget.
- **R-GF-10 — Particle ceilings are law.** Existing per-effect ceilings and global particle caps [S] maintained; every new effect registers its cost in the budget table before merge. *Test:* `tests/animation-budget.test.ts` / `tests/physics-budget.test.ts` (render-side cost) extended per new effect.
- **R-GF-11 — The frozen-frame test.** At 10 sampled frames per level (solver route [S]), a paused frame must communicate: velocity (trail), polarity (rings color), charge state (meter), target (assist glow). *Test:* capture harness renders the 10 frames; a vision-model panel labels all four axes ≥ 9/10 frames correctly [T].
- **R-GF-12 — First-three-flip escalation.** Session 0's first three launches carry escalating flair (per R-ON-09's tutorial ramp): 1st = clean with coaching arrows, 2nd = standard stack, 3rd = full signature stack. *Test:* session test asserts flair tier by launch index.
- **R-GF-13 — Feel parity across tiers.** Tier-mid/low keep identical *timing* (hit-stop, shake cadence, slow-mo) with reduced particle counts; no tier gets delayed feel. *Test:* quality-tier matrix renders the release event; timing deltas asserted 0 ms across tiers, particle counts within tier budgets.
- **R-GF-14 — The Feel Bible.** `docs/FEEL.md`: every state transition → its juice stack → its audio map → its budget cost, generated-checked by CI against the code (the docs-vs-code drift test). *Test:* new CI test parses FEEL.md and asserts every rendered event name appears.

### 13.4 Anti-patterns

- Polish before response (Swink's law): any juice PR that also changes input timing is auto-rejected in review.
- Shake during charge/aim [S: existing hard rule — preserved], shake as ambient noise, hit-stop stacking.
- Particles as substitute for physics readability — if the player can't tell why they died, the explosion made it worse (Yu).
- Sound-less visual events and sight-less sounds (R-GF-08 kills both).
- Juice that lies: effects implying forces the sim never applies (Yu, deterministic truth).

### 13.5 Build directive

Lands in `src/render/vfx.ts`, `particles.ts`, `magno-rig.ts`, `camera-rig.ts`, `post-shaders.ts`, `src/audio/director.ts`, `tuning.ts`. The existing test files (`snap-juice`, `secondary-motion`, `motion-tokens`, `animation-budget`, `render`) are extended, never bypassed. This chapter is the highest-leverage pure-fun workstream in the PRD: it converts an 8.1-feel game into a 9.5-feel game using **timing, not budget** — every effect above is kilobytes, not megabytes.

---

## Chapter 14 — Level Design & Difficulty Architecture (Commission C)

### 14.1 The seats and their doctrine

**Seat 21 — Masahiro Sakurai** (Kirby, Smash Bros; his public design series *Masahiro Sakurai on Creating Games*). Doctrine: **readability is love** — a game state should be understood without explanation, text, or manuals; design so the screen itself teaches; "the screen is the manual." Demand: **every level readable at first glance** — goal, hazard, path — by a stranger, in five seconds, no text.

**Seat 22 — Kim Swift** (Portal — documented talks on Portal's teaching method). Doctrine: **teach by level, not by lecture**: safe demonstration → guided trial → exam; never test a mechanic before the level has let the player *see* it work. Demand: every twist prop follows the Portal triple: it appears at rest first (demonstrable), its first required use carries forgiving margins (guided trial), and only later levels gate on it (exam).

**Seat 23 — Marc LeBlanc** (MDA co-author; documented lectures on feedback loops and his taxonomy of kinds of fun). Doctrine: games are **feedback-loop machines** — loops that reward mastery pull players forward; loops that punish blindly push them out. Demand: the loop after every failure must reward the *retry* (instant restart, comedy beat, "this time I see it"), so the fall itself is positive reinforcement for the next attempt.

**Seat 24 — Ernest Adams** (*Fundamentals of Game Design*, documented difficulty-curve doctrine). Doctrine: difficulty must rise in a smooth, *perceivable* ramp with local dips for recovery; difficulty is a curve you *draw*, not a mood you feel. Demand: the 6%→68% fall-rate curve [S] is drawn per level in a curve editor and enforced by tests — with drawn dips at biome boundaries and after every exam level.

**Seat 25 — Scott Rogers** (*Level Up! The Guide to Great Video Game Design*). Doctrine: level anatomy is **clockwork** — every level: establish the space, introduce the twist, escalate, resolve; and the player's path should be *legible geometry* (sightlines, breadcrumbs, landmarking). Demand: every MAGNETOPE level runs the clockwork: quiet establish → twist at ~40% → escalation combo at ~80% → resolve at clear.

**Seat 26 — Brenda Romero** (documented talk *"The Mechanic Is the Message"*). Doctrine: mechanics speak; levels are sentences in the mechanic's language — filler that doesn't use the core verb is silence. Demand: **no filler levels** — every level contains at least one magnet-native sentence (flip chain, weak decay, repel trick, snap timing) that a hook game could not say.

**Seat 27 — Alexey Pajitnov** (Tetris; documented interviews on puzzle elegance). Doctrine: elegance = maximal interplay from minimal rules; a good puzzle is a paradise of control where every element earns its place. Demand: an **elegance pass** on every level — remove any prop whose removal does not change the solution space (the repo's ablation tool [S] already measures this; now it must *drive* cuts).

**Seat 28 — Tetsuya Mizuguchi** (Rez — documented synesthesia doctrine). Doctrine: pacing is music — arrange a level like a track: intro, build, drop, resolve; let the **audio director rise and fall with the level's intensity** (the adaptive music engine already exists [S]). Demand: each level's event density follows the arrangement, and the score's intensity envelope matches it (Ch. 20.5).

**Seat 29 — Dan Cook** (*The Chemistry of Game Design* — the skill-atom model). Doctrine: learning is the unit: **action → simulation → feedback → modeling**; a designer lists skill atoms and sequences them; gaps between taught and tested atoms are where players quit. Demand: a written **skill-atom table** for all 70 levels — what each level teaches, where it practices, where it examines — with zero gaps and zero un-examined skills.

**Seat 30 — Zach Gage** (SpellTower, Threes — documented puzzle-design talks). Doctrine: great puzzles are **readable in one shower-thought**: solvable by observation and reasoning, not brute force; if brute force is the solution, the puzzle is broken. Demand: every twist exam must be solvable *from the spawn sightline* — the physics clues visible (wind streaks, flicker rhythm, swing period), so a thinking player solves it before dying into it.

### 14.2 The diagnosis — the machinery is elite; the on-ramp is the risk

Verified level infrastructure [S]: 70 levels across 5 biomes; every level bot-solved with a stored route (`npm run solve`); twist-gating enforced (fixed ledges spaced beyond one flip's reach: **21 m at full gravity, 32 m at ×0.62, 39 m at ×0.5**, plus margin); ablation proves each level still solves without its moving/hung/flickering props — and that twists are *required*; hazards run on the run clock with 4–16 s periods; checkpoints sit above center-line ledges; difficulty is *specified numerically* as fall rate, 6%→68%. This is professional-grade level engineering. The two premium gaps: **(1) the skill floor** — the curve's start is 6% but its *slope* assumes tolerance for failure that Poki's casual 500-player sample may not share [QA risk #2]; **(2) readability under time pressure** — the twists are fair by construction, but "fair after dying" and "obvious before dying" are different products. This chapter converts the first 10 levels into an on-ramp that a bored 11-year-old on a bus completes, while keeping levels 30–70 for the mastery player.

### 14.3 Requirements — R-LD-01 … R-LD-22

**Grammar & teaching**
- **R-LD-01 — One pattern per level (Koster).** Every level is the teach, practice, or exam of exactly one pattern-combination; documented in the skill-atom table (`docs/LEVELS.md`, generated from route data). *Test:* CI asserts every level ID maps to a row; playtest confusion log cross-references it.
- **R-LD-02 — The Portal triple per twist (Swift).** New twist props appear first at rest and observable (demonstration), are first required with ≥ 1.5× reach margins (guided trial), and gate only from the next level on (exam). *Test:* `tests/levels.test.ts` gains the triple-phase assertion per twist type (fan, crane, flickering sign, swing, wheel, see-saw, trampoline, wind gust [S]).
- **R-LD-03 — Telegraphs (Sakurai).** Every hazard previews itself from spawn: moving doors visibly mid-cycle, fans spin-up before force zones, flicker rhythm visible ≥ 2 s before crossing, gusts telegraphed by streak particles ≥ 0.5 s ahead (existing wind-streak system [S]). *Test:* first-frame capture per twist level; 3/5 naive viewers identify the hazard and its rhythm from the still.
- **R-LD-04 — Reach gates preserved.** Fixed-ledge spacing vs reach numbers (21/32/39 m) + margin, enforced [S, unchanged]; ablation pass per level change. *Test:* existing `tests/levels.test.ts` spacing suite + `npm run ablate` in CI.
- **R-LD-05 — Checkpoint law preserved.** Checkpoints above center-line crossing ledges; respawn drop verified [S, unchanged]. *Test:* existing checkpoint suite.
- **R-LD-06 — Hazard clock discipline.** 4–16 s periods, run-clock determinism, never sweeping through fixed geometry [S, unchanged]. *Test:* existing `hazard-clock`, `motion`, `wind` suites.

**Pacing**
- **R-LD-07 — Level clockwork (Rogers).** Each level's event density: establish (0–25% of par time, quiet), twist (≈40%), escalation combo (≈75–90%), resolve. *Test:* solver-route event histogram per level conforms to the envelope ± 15%.
- **R-LD-08 — Music follows the clockwork (Mizuguchi).** The adaptive score's intensity envelope is mapped to the same event-density histogram (Ch. 20.5 dependency). *Test:* audio director test asserts envelope follows level-event sequence.
- **R-LD-09 — Skill-atom coverage (Cook).** No skill examined before taught; every skill taught gets ≥ 1 exam by biome end; the table ships in `docs/LEVELS.md`. *Test:* CI parses the table vs twist usage order.
- **R-LD-10 — Magnet-native sentences (Romero).** ≥ 1 magnet-native moment per level; a "filler detector" review (biome audit) removes any level failing this. *Test:* `npm run uses` (prop usage census [S]) extended to assert the per-level magnet-native event.
- **R-LD-11 — Elegance pass (Pajitnov).** Per level: remove every prop whose removal keeps the route solvable *and* the margin unchanged; final prop counts land in the budget table. *Test:* ablation-driven cut list executed per biome milestone; prop-kits triangle budgets stay green [S].

**Readability & fairness**
- **R-LD-12 — Five-second read (Sakurai).** From spawn, on first frame: 3/5 first-time viewers point the intended route within 5 s without prompts. *Test:* playtest protocol step; recorded in confusion log.
- **R-LD-13 — Shower-thought solvable (Gage).** Every twist exam's intended route is inferable from visible physics clues; no brute-force-only levels. *Test:* playtesters on 2nd attempt reach the twist solution without retries beyond 2.
- **R-LD-14 — The casual on-ramp (the review's Risk 2 answer).** Levels 1–5: fall-rate median ≤ 10%, charge window +25% wider, assist strength +50%, spacing at 1.5× reach margin, ≥ 1 guaranteed-clear level (L1) with scripted safety; levels 6–10 taper each boost by half. *Test:* `tuning.ts` ramp table + fresh-profile session bot asserts the taper; post-player-fit telemetry re-verifies the 10% gate.
- **R-LD-15 — Fair loss or no loss (Foddy).** No unsignaled death; every fall answers "why" within 1 s visually (the hazard visibly wins — door closes on him, wind streaks bend, weak metal dents first [S: weak metal carries dents]). *Test:* hazard-fall capture set; vision panel names the cause in ≥ 9/10.
- **R-LD-16 — Curve is data (Adams).** The fall-rate curve is drawn per level (not just specified), reviewed against the heatmap weekly pre-release and after every player-fit test; any level > 2σ above its curve band is retuned that week. *Test:* `npm run heatmap` report generation [S] + curve-band assertion in `tests/levels.test.ts`.

**Progression & star economy**
- **R-LD-17 — Par honesty.** Par = the author route + 20% buffer; par is beatable by a skilled first-day player < 5% of the time [T]. *Test:* `tools/design.ts` par audit; ghosts re-generated (`npm run ghosts` [S]).
- **R-LD-18 — Three-star definitions stay human.** Stars: clear · par-or-better · the third mastery star (no-fall / all-optional-scraps route) — all three achievable with assist on; the third may *require* mastery but never luck. *Test:* progression suite full-star bot run exists per biome.
- **R-LD-19 — Biome re-teach dip.** First level of each biome: difficulty dips ≤ 20% relative (flow window, R-GD-05), new mechanic demonstrated at rest (R-LD-02), gravity changes (Stratosphere) come with a dedicated float-teach level. *Test:* curve assertion + `tests/low-gravity.test.ts` teach-level case.
- **R-LD-20 — Endgame mastery ceiling.** Levels 61–70: combo exams; optional assist-off mastery ghosts; the ceiling is *visible* (biome 5 gate shows the mastery ribbon track). *Test:* ghost-tier assertions; no mandatory assist-off content.
- **R-LD-21 — Level-count honesty.** The game ships 70 verified levels [S]; in-game text never promises more; store copy says "seventy" plainly. *Test:* copy audit in locale test (no future-tense content promises).
- **R-LD-22 — Weak-metal law.** Weak metal introduced at L4 [S] and every weak surface dents visibly before shedding [S] — the "why" of every weak-metal fall is readable. *Test:* existing magnet-surface tests + dented-visual assertion in prop tests.

### 14.4 Anti-patterns

- Difficulty spikes ("the wall") — the #1 published cause of playtime collapse [P-D engagement doc: "avoid sudden difficulty walls"].
- Exam-before-teach (Swift's violation) — the #2 cause.
- Unsignaled hazards — the only genuinely unfair thing in a physics game.
- Filler levels (Romero's silence), brute-force puzzles (Gage's broken puzzle), tutorial text anywhere in gameplay [S: wordless policy].
- Nerfing mastery to protect casuals: the correct tool is **assist and on-ramp**, never ceiling-lowering (Thorson, Ch. 13; R-LD-14/20 both ship).

### 14.5 Build directive

Lands in `src/levels/*` (route JSONs get `skillAtom`, `phase`, `telegraph` metadata), `src/config/tuning.ts` (on-ramp taper table), `src/game/coach.ts` (telegraph-linked coaching), `tools/design.ts` / `ablate.ts` / `heatmap.ts` (audit CLIs), `tests/levels.test.ts` + new `tests/onramp.test.ts`. The route/solve/ablate loop [S] is the enforcement engine — this chapter mostly teaches the *tools you already own* to speak fluently about teaching.

---

## Chapter 15 — Onboarding & the First 90 Seconds (Commission D)

*Poki's own engagement doctrine anchors this chapter [P-D]: "the first session carries most of the weight"; "make the first minutes brilliant before making the tenth hour deep." The repo's session-0 arc [S] — boot straight into the Scrapyard, no menu, celebration at second 45, guaranteed clears in levels 1–2 — is already the right skeleton. This chapter makes its first 90 seconds un-losable.*

### 15.1 The seats and their doctrine

**Seat 31 — Amy Jo Kim** (game thinking; documented *Game Thinking* framework and core-loop essays). Doctrine: engagement is a **habit loop** — trigger, action, reward, investment — and the first session's only job is to complete that loop *fast* and leave an investment (a reason to return). Demand: session 0 ends with an investment owned by the player: a personal ghost to beat and a half-filled cosmetic shelf.

**Seat 32 — Nir Eyal** (*Hooked*). Doctrine: the hook cycle's compounding engine is **variable reward + stored investment**. Demand: onboarding plants both — the falls are the variable (never the same twice), the ghosts and locker are the investment — with the hard ethical line: variable *delight*, never variable *exploitation* (no dark patterns; Ch. 4.3).

**Seat 33 — Sebastian Deterding** (gameful-design researcher; documented onboarding/motivation lectures). Doctrine: a first-time user must get three answers in seconds — **"What do I do? Why? Is it worth it?"** — from the scene itself. Demand: the boot frame answers all three: MAGNO pulses on a magnet pad (what), a summit gleams far above with a teaser ghost (why), and the first flip looks like the most fun thing on the screen (worth it).

**Seat 34 — Don Norman** (*The Design of Everyday Things*; *Emotional Design*). Doctrine: **affordance, mapping, feedback** — controls that look like what they do, and instant visible consequence; visceral design sells in the first 100 ms, behavioral design keeps, reflective design brings back. Demand: the charge interaction is self-affording (holding visibly *does* something from frame one), and the reflection layer (grade cards, share cards, ghost ribbons) gives players a story to retell.

**Seat 35 — Steve Krug** (*Don't Make Me Think*). Doctrine: every interactive moment should be **self-evident**; thinking is friction and friction is churn. Demand: the whole game, menus included, is "obvious without instructions" — one click to play, one glance to understand a screen, zero menus before movement.

**Seat 36 — Ken Wong** (Monument Valley — documented talks on instant beauty). Doctrine: **beauty in the first frame is a promise**: it says "this was made with care, stay." Demand: the very first rendered frame — mid-throttle phones included (tier system) — is *composed*: horizon haze, rim light on MAGNO, the tower silhouette rising out of frame. The boot is a poster.

**Seat 37 — Jakob Nielsen** (usability heuristics, documented). Doctrine: **visibility of system status, match with the real world, user control, error recovery** — his heuristics, applied to games verbatim. Demand: every system state the player can act on is visible (charge meter, polarity, wind, weak metal), every recovery is one input (R restarts, pause resumes), and nothing interrupts without an exit.

**Seat 38 — Alan Cooper** (*About Face*; goal-directed design). Doctrine: design for **personas**, not for yourself; the primary persona here is a bored, casual, majority-mobile player [P-D] with zero patience and one thumb. Demand: every onboarding beat is validated against the persona card ("Aiko, 13, phone, bus, sound off, 3 minutes") before shipping.

**Seat 39 — Julie Dirksen** (*Design for How People Learn*). Doctrine: **chunking, spacing, scaffolding** — teach one chunk, practice it, space the next; scaffolds fade as competence rises. Demand: the tutorial scaffolds (wider windows, stronger assist — R-LD-14) fade on a *published* taper (25% wider → standard by L5), and no new chunk is taught while another is still shaking.

**Seat 40 — BJ Fogg** (Stanford Behavior Model, documented). Doctrine: **B = MAP** — behavior needs motivation, ability, and a prompt at the same moment; when ability is low, the prompt must carry the moment. Demand: idle-time prompts escalate gently (3 s → hand hint, 8 s → MAGNO demonstrates the flip himself, 15 s → camera pans the goal) — never text, never shame, never more than three nudges.

### 15.2 The diagnosis

The current opener is *clean but quiet* [QA]: level fades in, ghost hand gestures, and the player deduces charge-and-release. That deduces-step is the killer — Deterding's "what do I do?" answered by inference instead of spectacle. Two concrete flaws from the live session [QA]: staged HUD reveal hides touch controls until first input (the game's very first screenshot looks control-less on mobile), and nothing in the first 10 seconds demonstrates the joy the whole game is built on. The fix is not a tutorial — it is **a show**: the world plays the first flip *with* the player, not for them (scripted-adjacent, guaranteed-success, full-juice).

### 15.3 Requirements — R-ON-01 … R-ON-12

- **R-ON-01 — Boot to world, no menu [S preserved].** First frame is the Scrapyard platform; no title screen, no "press start." Time to first input ≤ 3 s desktop / ≤ 6 s mid-range mobile (budget in R-PE-06). *Test:* session test asserts zero DOM screens before world render; load-time harness records the input-ready delta.
- **R-ON-02 — The scene answers the three questions (Deterding).** At boot: MAGNO pulses on his pad (what), the summit/teaser visible (why), the pad glows invitingly (worth it) — within the first rendered second. *Test:* first-frame capture audit (Ch. 16's vista rules); 3/5 naive viewers name all three.
- **R-ON-03 — The first flip is a guaranteed spectacle (→ Ch. 16).** First flip in scrapyard-00: scripted-adjacent assist (catch guaranteed), full juice stack (R-GF-01), slow-mo landing beat ≤ 2 s. The player cannot fail the first flip. *Test:* session bot: first 10 inputs never produce a fall in L1; capture shows the full stack fired.
- **R-ON-04 — The 45-second contract [S preserved].** First flip ≤ 10 s, first snap ≤ 25 s, first clear + celebration ≤ 45 s [S: arc]. *Test:* fresh-profile session test timing assertions.
- **R-ON-05 — Modality parity.** Touch players see touch coaching (the flip-zone glow, drag-hint), keyboard players see key glyphs, mouse players see cursor-affordance — same beats, same timing, same outcomes [S: coach overlay + input modes]. *Test:* three-modality session runs, coaching event parity asserted.
- **R-ON-06 — Idle nudges (Fogg ladder).** 3 s idle → coach hand to the flip zone; 8 s idle → MAGNO does an *attention* micro-flip on the spot (visual prompt, not gameplay); 15 s idle → camera pans toward the goal and back; ladder stops on first input, never repeats more than twice. *Test:* coach timer unit tests + session test idle injection.
- **R-ON-07 — Controls visible at rest (the QA-screenshot fix).** Staged HUD reveal completes by first input **or** at 10 s, whichever is first; on coarse pointers, flip-zone affordance is faintly visible at rest thereafter (toggleable in settings [S: button layout option]). *Test:* layout test at 640×360 asserting zone visibility state machine.
- **R-ON-08 — Session-0 reward timeline.** First Scrap ≤ 60 s; first star on card ≤ 45 s; free cosmetic unlock ≤ 180 s [S: arc items]; locker opened by the celebration itself, not by a menu. *Test:* session test reward-timeline assertions.
- **R-ON-09 — Tutorial juice ramp (→ R-GF-12).** Launches 1–2–3 escalate: coached clean → standard → signature. *Test:* flair-tier assertion by launch index.
- **R-ON-10 — Failure-free first 120 s [S preserved, hardened].** L1–L2 guaranteed-clearable with default assist; the *first possible fall* (L3+) plays the comedy stack and an instant "Again!" one-tap restart (Foddy's fair loss, LeBlanc's reward-the-retry). *Test:* on-ramp bot run (R-LD-14) + fall-stack assertions.
- **R-ON-11 — Congratulate everything [P-D].** Celebration map: first clear, first star, first par-beat, first ghost, first cosmetic, biome entries — every milestone gets confetti/voice/stamp (the Puffy Cat pattern [P-D]). *Test:* celebration-event completeness vs progression state machine.
- **R-ON-12 — Session 0 ends invested (Kim/Eyal).** By end of session 0: a personal ghost exists (beat-yourself card queued), ≥ 1 cosmetic owned, ≥ 1 biome teaser seen — the return hooks of Ch. 25 are seeded, never spoken aloud. *Test:* session end-state assertions.

### 15.4 Anti-patterns

- Tutorial text of any kind [S: wordless policy — absolute].
- A title/menu screen before the world (kills C2P's "instant playable" [P-D]).
- Teaching two chunks at once (charge+steer together before either is stable) — Dirksen spacing violation.
- Nudge spam or shame ("tap here!") — Fogg's ladder is three rungs, then silence.
- Making the first level *able to be failed in the first flip* — the one place a scripted guarantee is correct (Norman: error recovery is later; error *prevention* is here).

### 15.5 Build directive

Lands in `src/game/game.ts` (boot state), `src/game/coach.ts` + `coach-overlay.ts` (nudge ladder, modality glyphs), `src/ui/hud-reveal.ts` (R-ON-07 state machine), `src/game/progress.ts` (reward timeline hooks), `src/levels/scrapyard.ts` L1–L2 (scripted-adjacent safety), `src/game/slowmo.ts` (first-flip beat). Onboarding is the *cheapest high-leverage* workstream in the PRD: it is mostly state machines and timing — and it moves C2P, playtime, and the reviewer's first impression simultaneously.

---

## Chapter 16 — The Signature Moment & the Spectacle System

*One chapter, one obsession: the review's verdict that MAGNO's launch "reads slightly soft" [QA] becomes impossible to write about the premium build.*

### 16.1 The doctrine (applied seats: Hunicke, Nijman, Keane, Mizuguchi, Wong)

- **MDA named aesthetics (Hunicke):** every spectacle moment has a named target emotion: launch = *triumph*, fall = *slapstick*, clear = *pride*, biome reveal = *wonder*, ending = *bittersweet homecoming*. A beat that does not produce its named emotion is a dynamics bug, fixed in tuning or cut.
- **Composition over volume (Nijman):** the launch stacks five feedbacks (R-GF-01) in the Art-of-Screenshake order — timing is the art, size is not the point.
- **Line of action (Keane):** every signature pose has a single readable arc through it; the eye leads, the body chases.
- **Pacing is arrangement (Mizuguchi):** spectacle beats are placed like a music drop — never consecutive, always earned by a build.
- **Beauty as promise (Wong):** the *first* frame of any new space is composed like a poster — light, haze, silhouette — before gameplay resumes.

### 16.2 Requirements — R-SM-01 … R-SM-08

- **R-SM-01 — The First Launch (the review's #2 action, shipped).** scrapyard-00's first full-charge flip: assisted catch guaranteed (R-ON-03), full Nijman stack (hit-stop 40–80 ms, kick, spark ring, stretch, FOV pop), 1.5–2 s slow-mo landing with the camera settling onto MAGNO's blink — end-to-end ≤ 4 s, interruptible (Juul), zero new budget lines. *Test:* capture session diff-asserts the stack; interrupt-fuzz confirms mid-beat pause safety.
- **R-SM-02 — Biome establishing shots.** Each biome's first level opens with a ≤ 2 s camera move on its identity (rust haze → laundry-soft white → blue dusk neon → giant playground geometry → thin-air silence), player input never delayed > 2 s, skippable by any input. *Test:* timer assertion per biome level 1; skip event resumes frame-exact.
- **R-SM-03 — The snap flash ident.** A consistent cyan arc-flash on every snap — the brandable fingerprint: it appears in the thumbnail (R-TH-04), the opener, and every catch, same shape family, always within the post-stack budget. *Test:* render assertion of flash presence + visual-consistency check in capture set.
- **R-SM-04 — Big-fall slow-mo preserved with budget [S].** Fall > 12 m or impact > 14 m/s triggers the graded slow-mo (max 4 per 3 min, prioritizing the biggest [S]) — unchanged, now ending in the comedy beat (R-GF-07). *Test:* existing fall suite stays green.
- **R-SM-05 — The ending is the last signature.** Wordless ending preserved [S]; final ascent gets the score's full resolve, one last slow-mo at the summit, credits ≤ 30 s, skippable after first play, completion rewards a summit cosmetic. *Test:* ending suite + duration assertion.
- **R-SM-06 — Spectacle spacing.** No two signature beats (slow-mo, establishing shot, ending) within 20 s of each other; celebration cards are the breathing space between them. *Test:* event-spacing linter over solver routes.
- **R-SM-07 — The aesthetics table ships in CI.** `docs/SPECTACLE.md`: every beat → named emotion → composition stack → budget cost → test — generated-checked like the Feel Bible (R-GF-14). *Test:* doc-drift CI test.
- **R-SM-08 — Shareability is a requirement, not a bonus.** Fall cards and clear cards [S: share-card system] compose signature-safe: rule-of-thirds layout, MAGNO legible, no HUD chrome — every card looks like a poster, because on web those cards *are* the marketing. *Test:* share-card render audit across locales.

### 16.3 Anti-patterns

- Spectacle that plays *instead of* the player (cutscene-itis): every beat here is ≤ 4 s and interruptible (Juul's law).
- Two drops in a row (Mizuguchi: silence makes the next note louder — the pacing table enforces the silence).
- A signature moment the thumbnail doesn't echo (R-SM-03 + R-TH-04 close the loop: the store card *is* the launch, the launch *is* the store card).

### 16.4 Build directive

Lands in `src/game/slowmo.ts`, `camera-rig.ts`, `src/render/ending-stage.ts`, `backdrop.ts` (biome idents), `vfx.ts` (snap flash family), `src/ui/share-card.ts`, plus the `docs/SPECTACLE.md` doc-test. **This chapter is where the review's "make the first fifteen seconds sell the mechanic" verdict gets its requirements — it is the highest-impact single day of engineering in the plan.**

---

## Chapter 17 — Thumbnail & Store Packaging (Commission E)

*Poki's own words frame this chapter [P-D]: "Your game thumbnail is the single most important factor for click-through rate on Poki." The current card reads ~3/10 [QA] — a two-day fix that changes the commercial fate of the whole project. This chapter turns that fix into a system.*

### 17.1 The seats and their doctrine

**Seat 41 — Susan Kare** (the original Mac icon designer — documented craft essays). Doctrine: design for the *smallest* target size first; a great icon survives the 16-pixel test; grid discipline, distinct silhouette, one idea per mark. Demand: MAGNO's thumbnail must be *designed at 128 px* — if the character and the snap-flash read on a phone row, the 628 px version is free.

**Seat 42 — Jimmy Donaldson / MrBeast** (the most A/B-tested thumbnail operation on the internet — documented in his own videos and interviews). Doctrine: one bold focal subject, maximal contrast, an emotional read (face or motion), and a curiosity gap — then *test*; never trust your own taste where data exists. Demand: the card carries a single emotion (joy of the launch), tested by forced-choice panel before upload (R-TH-09).

**Seat 43 — Chip Kidd** (jacket designer — *Go: A Kidd's Guide to Graphic Design*, documented TED talk "Designing books is no laughing matter"). Doctrine: a cover is a **promise and a tease** — communicate what's inside in one glance, but leave one thread unresolved so the viewer must open it. Demand: the thumbnail promises the launch *and* teases the tower — motion implied, destination unrevealed.

**Seat 44 — Saul Bass** (movie-poster and title-sequence master — documented oeuvre). Doctrine: **one symbol**, hand-reduced, with implied motion; identity is a single shape remembered. Demand: the arc-of-launch becomes the game's Bass symbol: the curl of the flip, readable as a logo.

**Seat 45 — Paul Rand** (IBM/ABC — documented essays *A Designer's Art*). Doctrine: **simplicity is not the goal, it is the by-product of a good idea**; distinctiveness over decoration; the viewer completes the design. Demand: the card is composed of three shapes at most — MAGNO, the arc, the tower — everything else is support.

**Seat 46 — Shepard Fairey** (OBEY/Hope — documented street-poster doctrine). Doctrine: **instant readability at any distance** — high contrast, flat bold shapes that survive photocopying, graffiti walls, and postage stamps. Demand: the card must survive Poki's *darkest* display environment: a muted phone screen, direct sun, a crowded category row — contrast tuned for worst-case, not best-case viewing.

**Seat 47 — Stefan Sagmeister** (documented manifesto work). Doctrine: attention is earned by **one committed twist** on an otherwise disciplined composition; anything almost-crazy reads as noise. Demand: exactly one surreal element in the card (the impossible arc of the magnet flight), not a busy scene.

**Seat 48 — Kyle Cooper** (title-sequence master — *Se7en* etc., documented motion-identity doctrine). Doctrine: a motion brand is an **ident, not a clip** — the animated thumbnail is a three-second statement of identity, structured, ending where it began. Demand: the animated thumbnail (required before global release [P-D]) is composed as: 0.0–0.5 s hook (the flip), 0.5–2.0 s the catch + flash, 2.0–3.0 s settle + blink — loop-clean, no gameplay footage, no UI.

**Seat 49 — Casey Neistat** (YouTube — documented thumbnail praxis). Doctrine: the frame must *tell the story of the video* in one look; the center of interest is large, lit, and unambiguous; boring is the only crime. Demand: a stranger sees "a robot flying between magnets" — not "some game screenshot."

**Seat 50 — Aaron Draplin** (Draplin Design Co. — documented logo craft talks). Doctrine: thick lines, honest shapes, "if it doesn't shout from across the street, it's not done"; craft as pride. Demand: the wordmark + ident lockup gets the Draplin test — printed at postcard size, viewed at arm's length, still loud.

### 17.2 Poki's published rules, engineered in full [P-D]

| Rule (their doc) | Implementation requirement |
|---|---|
| Square, full-bleed, ≥ 628×628, static required first | Existing 628/1256 pair [S] regenerated from the new composition scene (R-TH-01) |
| **Animated** required before global release (soft-release phase) | 3 s, 60 fps loop — Cooper ident structure (R-TH-10) |
| Show what's inside — **default skin** in the card | Card uses default MAGNO (and the free session-0 cosmetic is *not* the default [S alignment]) |
| One clear foreground object, simple background | Three-shape composition (Rand/Bass) — R-TH-01 |
| Dynamic pose, not static | Mid-launch line of action (Keane's arc from Ch. 16) |
| Contrast; **avoid the playground background `#83FFE7`** | Card LUT checked against the forbidden hue and against muted-screen worst case (R-TH-05); existing `tools/check-thumbnail.py` [S] extended with hue-collision audit |
| No borders, padding, letterboxing | Composition scene renders full-bleed by construction |
| Design for small tiles | The 128 px test is the *entry* test (Kare, R-TH-01) |
| **Text-free — "visuals alone drive better performance"** [P-D] | Absolute and forever; no logos-in-card either except the wordmark *outside* the image file |
| Update policy: free before web fit; sign-off after; substantial-update after release | Three pre-scored variants uploaded at once (R-TH-07) so post-sign-off iteration costs nothing |

### 17.3 Requirements — R-TH-01 … R-TH-10

- **R-TH-01 — The 200 ms composition.** MAGNO at 30–40% of frame height, mid-launch on his line of action, catching arc visible; tower silhouette filling upper-right third; sky grade warm-to-cyan so the snap-flash pops; **the 128 px test passes** (character silhouette + arc readable in a phone-row crop). *Test:* `tools/check-thumbnail.py` gains a downscale legibility check + human panel 5/5.
- **R-TH-02 — Text-free, forever.** Zero glyphs in card files — title, tagline, badges all live on the store page, not in pixels. *Test:* OCR pass on final PNG returns empty.
- **R-TH-03 — In-engine truth.** Thumbnails render from a dedicated **composition scene** in the capture tool [S: `npm run thumbnails` / `tools/capture.ts`] — no gameplay HUD, no touch UI in frame (the exact failure mode of the current card [QA]), staged lighting, no vignette-of-menus. *Test:* capture assertion: HUD layers disabled in thumbnail mode.
- **R-TH-04 — The magnet signature on the card.** The cyan snap-arc flash (R-SM-03's ident) is the visual differentiator a hook-game cannot fake (Ch. 10.4). *Test:* hue analysis: arc pixels present in the top-quartile luminance band; no hook-rope-like element.
- **R-TH-05 — Contrast law.** Global contrast ratio between subject and background ≥ 3:1 in luminance; zero pixels within ΔE ≤ 10 of `#83FFE7` [P-D rule]; card audited on a 30% dimmed composite (worst-case screen) — subject still readable (Fairey). *Test:* extended `check-thumbnail.py`.
- **R-TH-06 — The eye law.** MAGNO's eye is the emotional anchor: visible at 128 px, expressing joy (squint + brow), either toward the trajectory or to the viewer (Donaldson/Kare). *Test:* panel: 5/5 name the emotion correctly at card size.
- **R-TH-07 — Three variants, scored before upload.** A: hero-launch (primary); B: comedy-fall card (personality-forward); C: tower-scale wide (ambience-forward). Forced-choice local panel (≥ 10 naive viewers, 200 ms exposure, "which would you click?") — **winner uploads only after ≥ 9/10** [T]; all three retained for post-web-fit iteration with Developer Support sign-off [P-D policy]. *Test:* panel log stored in `thumbnails/report.json` (schema in Ch. 33).
- **R-TH-08 — The lockup.** Wordmark (`src/ui/wordmark.svg` [S]) + ident + palette become a tokenized design system (series coherence per Poki [P-D]) — reused verbatim in: store card family, clear-card corner stamp, ending title card. *Test:* token file existence + three usage sites render-asserted.
- **R-TH-09 — The local 200 ms gate.** No web-fit test is ever requested unless the current card passes: text-free ✓, 128 px legibility ✓, contrast ✓, panel ≥ 9/10 ✓, hue-collision ✓ — a five-point pre-flight checklist wired into `docs/SUBMISSION.md`'s upload ritual. *Test:* submission dossier's checklist section cites the panel log.
- **R-TH-10 — Animated ident spec.** ≤ 3.0 s, 60 fps, WebM + WebP + GIF [S: pipeline exists], ≤ 300 KB WebM [T], Cooper structure (hook ≤ 0.5 s), loop-clean crossfade [S], soundless (hover autoplay is muted), no UI. *Test:* duration/size budget assertions in the thumbnail pipeline.

### 17.4 The store page stack (the card's supporting cast)

The page around the card is also packaging [P-D: "Your game page" + `docs/SUBMISSION.md` copy, S]: **Title** one coined word (MAGNETOPE); **Tagline** verb-first ("Charge. Flip. Fling yourself through the junk."); **Description** leads the polarity verb, then the world tour, then the "no sign-in, no waiting" close [S: existing copy — verified against premium state after rebuild: update the *facts*, never the promises (R-LD-21)]; **Suggested tags** physics · magnet · skill · one-button · 3D · casual · speedrun [S list, trimmed of "ragdoll/rage" tone risk per Ch. 10.3 — "skill" carries the genre meaning without the punishment connotation]; **Categories** strategy deferred to Ch. 30.6.

### 17.5 Anti-patterns

- The raw screenshot (the current card's exact disease [QA]) — a capture is not a composition (Kidd).
- Text, badges, borders, letterbox [P-D: all named pitfalls] — instant amateur read.
- Muted palette vs a saturated category row — invisibility, not taste (Fairey).
- Misleading mystery-box composition — Poki's "show what's inside" rule exists because clicks that bounce still cost CTR credibility [P-D].
- A hook-rope silhouette anywhere in the card — genre suicide (Ch. 10.4).
- Shipping the card without the panel score — Donaldson's entire operation is *testing*; ours will be too.

### 17.6 Build directive

Lands in `tools/thumbnails.ts` + `tools/capture.ts` (composition-scene mode), `tools/check-thumbnail.py` (legibility, hue-collision, contrast, OCR audits), `src/render/grade.ts` (card LUT), `thumbnails/static/*` + `thumbnails/animated/*` (all regenerated), `src/ui/wordmark.svg` (lockup tokens), `docs/SUBMISSION.md` (the five-point pre-flight ritual). **Effort: two days [QA: estimate retained]. Leverage: the entire funnel's first number. There is no version of this PRD where this chapter is optional.**

---

## Chapter 18 — Art Direction: The End of the "AI Game Look" (Commission F)

*The full art doctrine already lives in `docs/MAGNETOPE_VISUAL_RENEWAL_PRD.md` (2891 lines, ~60 masters, its own diagnosis/first-principles/renewal/implementation structure [S]). This chapter does not repeat it — it binds its decisions into requirements, adds the five seats that file only applies implicitly, and wires the whole look into CI so an AI rebuilder cannot drift.*

### 18.1 The seats (the implementation watchdogs)

**Seat 51 — Josef Albers** (*Interaction of Color*). Doctrine: color is relational — the same cyan reads brilliant or dead depending on its neighbors; adjacency *is* the design. Demand: field-line cyan is tuned per background grade, per biome, never once globally.

**Seat 52 — Johannes Itten** (*The Art of Color*). Doctrine: the seven contrasts; every composition declares one dominant contrast type (hue, value, saturation, temperature…) and honors it. Demand: each biome names its dominant Itten contrast in the grade notes; a scene fighting its own contrast type fails review.

**Seat 53 — Bobby Chiu** (documented silhouette-first teaching). Doctrine: silhouette before detail — a character is what remains when you fill him in black; the 3-second read. Demand: MAGNO + every twist prop passes the filled-black test against its biome backdrop (existing colour-vision discipline [S] extends to silhouette luminance separation).

**Seat 54 — Iain McCaig** (documented "3 shapes, 3 lines" method). Doctrine: strong designs reduce to three memorable shapes and three gesture lines. Demand: MAGNO = horseshoe · capsule body · one eye; levels keep their three landmark shapes legible per scene.

**Seat 55 — Roger Deakins** (documented lighting doctrine). Doctrine: one motivated light story per scene — a single dominant source, everything else bounce and shadow; simple light, complex mood. Demand: each biome has one declared light story (rust sun, laundry overcast, neon dusk, giant noon, thin-air godlight) and the post-stack (bloom, vignette, grade [S]) serves it.

**Seat 56 — Dice Tsutsumi** (ex-Pixar art director — documented color-script doctrine). Demand: a **color script** document — one row per biome, one cell per level-beat — mapping emotional temperature across the 70-level arc; the Stratosphere reads as the color resolution of the whole story.

**Seat 57 — Wes Anderson** (documented auteur grammar: disciplined palettes, centered symmetry, flat space). Doctrine used with care: *commitment* — a palette committed-to is style; a palette hedged is mush. Demand: the palette table (`palette.ts` [S]) gets exactly one warm-cool story across five biomes and no gratuitous hues — 5 hues per biome, tops.

**Seat 58 — Ian Hubert** (documented "lazy tutorials" kitbash doctrine). Doctrine: worlds feel authored when detail is *everyday objects repurposed* — junk with a past, not geometric filler; the audience believes environments that imply stories. Demand: the kit system (`kit-*.ts` [S]) stays diegetic-junk-first: every prop implies provenance (a fridge door that once closed on someone's hand; a washing line that still holds one sock).

**Seat 59 — Vitaly Bulgarov** (documented mechanical-surface language). Doctrine: mechanical characters read through functional paneling — every surface exists for a reason; greebles imply engineering truth. Demand: MAGNO's body panels imply his function (the magnet head is *built*, not drawn — vents, seams, wear rings at the poles).

**Seat 60 — Simon Stålenhag** (documented narrative-painting practice). Doctrine: environments carry the story the text never tells — wear, signage, faded human traces. Demand: every biome tells one unstated story via set dressing (the repo already has faded festival banners, lawn mowers, mailboxes [S] — systematized into a per-biome *wear pass*).

### 18.2 The three silent killers, restated as gates [S: visual PRD's own diagnosis]

1. **Asset-pack equivalence** — flat-shaded low-poly in default palettes is what most AI-generated games look like; the panel's cure is the committed toon/painterly spec in the visual PRD (Ch. 7 of that document), not more geometry.
2. **Color muting** — desaturated "realistic" grades read as noise in a saturated category row; the cure is grade discipline per Itten/Albers, audited against card laws (Ch. 17).
3. **Empty-background syndrome** — playable space floating in haze with no horizon identity; the cure is the backdrop layer (`backdrop.ts` [S]) as authored skyline, not filler.

### 18.3 Requirements — R-AR-01 … R-AR-12

- **R-AR-01 — Commit to the signature look.** The visual PRD's shading decision (toon spec) is implemented and *total*: every prop, every biome, every tier — one look, zero mixed metaphors. *Test:* `tests/post-stack` + `grade` suites extended with per-biome style assertions (toon banding count, rim presence).
- **R-AR-02 — Grade per biome, accent per adjacency (Albers).** Field-line cyan is a *lookup*, not a constant — tuned against each biome's LUT; existing grade tables (`grade.ts` [S]) gain the accent-adjacency rows. *Test:* grade suite asserts accent contrast ratio ≥ 3:1 against every biome backdrop.
- **R-AR-03 — One Itten contrast per scene.** Biome grade notes declare the dominant contrast; scene captures are audited against the declaration. *Test:* capture audit per biome level-1 (Ch. 16 vista frames) with panel agreement ≥ 4/5.
- **R-AR-04 — One light story per biome (Deakins).** Light rigs per biome in `stage.ts`/`backdrop.ts`: declared source, consistent bounce; no omnidirectional fill. *Test:* light-configuration snapshot per biome; drift fails CI.
- **R-AR-05 — The color script ships.** `docs/COLOR_SCRIPT.md`: biome × beat table, authored before biome art passes, checked at art milestones. *Test:* doc presence + biome-grade conformance review at M2/M3.
- **R-AR-06 — Backdrop as skyline, always (Stålenhag/Hubert).** Every level's camera sky contains: horizon band + ≥ 2 parallax layers + 1 landmark silhouette — within triangle/draw budgets (`tests/prop-kits` [S]). *Test:* backdrop suite asserts layer counts per biome; budget suites stay green.
- **R-AR-07 — Junk with provenance.** Every interactive prop family carries wear-signature geometry (dents on weak metal, rust seams on steel, stickers/socks/signs per biome [S: existing vocabulary — systematized]); a wear-pass audit exists per biome milestone. *Test:* prop-kit tests extended with wear-marker assertions per family.
- **R-AR-08 — Mechanical truth for MAGNO (Bulgarov).** Rig gains functional paneling detail within budget: pole wear rings, vents, seams — readable at gameplay camera distance, not just close-up. *Test:* rig triangle budget + capture readability check.
- **R-AR-09 — Silhouette separation law (Chiu).** MAGNO's luminance silhouette separates ≥ 2:1 from his *most common* backdrop band per biome; twist props separate from static props by grade, not by outline hacks. *Test:* silhouette audit tool (capture + histogram) in CI per biome set.
- **R-AR-10 — Three-shape discipline (McCaig).** Per scene: 3 landmark shapes ≤; clutter metric on captures (shape-count audit) — action stays on MAGNO + twist + goal. *Test:* capture shape-count audit.
- **R-AR-11 — Tier-low is styled, never gray-box.** The low-quality tier preserves the committed look (toon banding, grade, accents) with reduced counts only — a low-end phone sees the *same world*, sparser. *Test:* tier matrix renders compared structurally (style features present in all tiers).
- **R-AR-12 — The 200 ms in-world test.** On 10 sampled frames/level (R-GF-11's set), a naive panel tags the world "magnet junk world," not "low-poly assets"; ≥ 8/10 per biome. *Test:* panel log appended to milestone reports.

### 18.4 Anti-patterns

- Mixed metaphors (toon character + PBR prop + painterly sky in one frame) — the AI-rebuild failure mode #1.
- Global constants for accents (Albers violation); uncommitted palettes (Anderson violation); light-from-nowhere (Deakins violation).
- Detail as polygon count — detail is *provenance* at silhouette distance (Hubert).
- Outline-pass hacks to fake separation — separation comes from grade, or it doesn't come at all.

### 18.5 Build directive

The visual PRD is the art bible; this chapter is its enforcement. Lands in `src/render/palette.ts`, `grade.ts`, `stage.ts`, `backdrop.ts`, `post-shaders.ts`, `prop-kit.ts`, `magno-rig.ts`, plus `docs/COLOR_SCRIPT.md` and the silhouette/shape audit tools. **Rule for the AI rebuilder: you may not restyle; you implement the committed spec. Style decisions were made by a human — your job is execution and the audits that prove it** (Ch. 29 authorship chain).

---

## Chapter 19 — MAGNO: Character & World Appeal

*Poki's benchmark mascots have faces the player can love in a 0.5-second glance [QA review's "simple next to expressive mascots" verdict]. MAGNO is one eye and a horseshoe magnet — a *perfect* minimal mascot in ingredients. This chapter makes him act like one.*

### 19.1 Requirements — R-CH-01 … R-CH-10

- **R-CH-01 — The plush test (Chiu).** MAGNO's silhouette at 64 px: huggable, unambiguous, recognizable — horseshoe head and capsule body; if you couldn't merch it, fix the rig, not the resolution. *Test:* 64 px silhouette panel 5/5 recognition; 128 px emotion read 5/5.
- **R-CH-02 — Idle charisma.** Idle state is a *performance*: breathing bob, magnet-head counter-tilt, curiosity glance toward the nearest steel, periodic blink-look cycle [S: blink system exists — extended]; one "character beat" every ~20 s (a look-around, a little magnet-flip flourish in place). *Test:* idle animation state machine covered in `tests/render.test.ts` rig cases; beat cadence asserted.
- **R-CH-03 — The eye is the soul.** Pupil states: dilate while charging, look along trajectory in flight, squeeze-shut on impact, dazed-spiral (X-curve, comic — never gory) on big falls, gleam on clear. *Test:* rig eye-state table in CI; vision panel reads emotion ≥ 4/5 per state at card size.
- **R-CH-04 — Emotional range map.** `docs/MAGNO.md`: the rig's emotion table — launch = joy-grit, charge = focus, fall = comic panic (windmill), catch = relief, clear = pride, daze = deadpan, ending = quiet homecoming — each tied to the MDA aesthetic it serves (Ch. 16.1). *Test:* doc-drift vs rig code (state enums match).
- **R-CH-05 — Secondary motion overlap.** Horseshoe head lags and counter-bounces the body (overlap/follow-through [R-GF-02]); in flight the head *leads* the look, body chases (Keane's line of action). *Test:* secondary-motion suite extended with head-lag constants from `tuning.ts`.
- **R-CH-06 — Chirp language (with Ch. 20).** MAGNO speaks in synthesized chirps — a 12-chirp emotion vocabulary (curious, focused, whee, uh-oh, ouch, ta-da…), each ≤ 250 ms, mapped 1:1 to the emotion table. No human speech, ever, anywhere [S: wordless — absolute]. *Test:* audio event map completeness (R-GF-08's suite) + per-chirp emotion recognition panel ≥ 4/5.
- **R-CH-07 — Cosmetics are jokes, not stats.** The 24-item locker [S]: every cosmetic is a one-beat gag or identity (a colander helmet, a sock from the washing line, a festival button), zero stat effects, default skin stays the card's face [P-D default-skin rule]. *Test:* locker suite asserts no stat fields; cosmetic copy (locker descriptions) reviewed in locale test.
- **R-CH-08 — The world has a face.** Props never have eyes; instead they have *histories* (R-AR-07) — wear, stickers, one sock: the Stålenhag rule — the world acts through implied stories, not cartoon faces (a deliberate stylistic boundary that keeps the game from mimicking the platform's cliché mascot-noise). *Test:* art review checklist at biome milestones.
- **R-CH-09 — MAGNO is the through-line of the ending.** The wordless ending [S] stages MAGNO's arrival *as* the reward: a home, a light, a last blink to the camera — the emotional payoff of 70 levels of a one-eyed robot's stubbornness. *Test:* ending suite + capture review; slow-mo summit beat (R-SM-05).
- **R-CH-10 — The character never breaks physics for charm.** All charisma is rig-layer (visual); the sim capsule never lies (determinism [S] preserved — Yu's truth rule applied to character). *Test:* sim-unchanged assertion: character PRs touch only `render/` and `audio/`.

### 19.2 Anti-patterns

- Human speech, dialogue, or on-screen words from MAGNO [S: wordless law].
- Cosmetic stat creep (a single stat-hat converts the locker into a store and the game into a grind — Bushnell/Koster both veto).
- Face-like props (undermines the world's voice and the mascot's uniqueness).
- Charisma via physics cheats (breaks determinism, breaks trust).

### 19.3 Build directive

Lands in `src/render/magno-rig.ts`, `blink-look.ts`, `vfx.ts` (eye states), `src/audio/recipes.ts` (chirp voices), `src/config/cosmetics.ts`, `docs/MAGNO.md`. **This is the difference between "a game with a character in it" and "a character's game" — Poki's biggest hits are the latter, and the review said so [QA].**

---

## Chapter 20 — Audio: The Junk Orchestra (Commission G)

*The review's Risk 6, honestly restated [QA]: "zero audio bytes shipped" is an engineering flex; the *aesthetic* risk is "programmer music." The premium answer is not bought samples — it is a committed, authored sound identity that only this game could have: the world is the orchestra.*

### 20.1 The seats and their doctrine

**Seat 61 — Koji Kondo** (Nintendo — documented approach across interviews). Doctrine: melody is identity — a three-to-five-note motif that *is* the game, hummable after one sitting, present from the first seconds and at every payoff. Demand: **the MAGNO motif** — five notes, playable by the synth from boot, quoted on clears, re-harmonized at biomes, resolved at the summit.

**Seat 62 — Winifred Phillips** (*A Composer's Guide to Game Music*, documented GDC talks on casual scoring). Doctrine: loops must survive *hundreds* of repetitions — short cells (2–4 bars), layer-variation and phrase rotation defeat repetition fatigue. Demand: the adaptive music is built from small crossfading cells, not long fixed loops.

**Seat 63 — Marty O'Donnell** (Halo — documented talks: *Sticks and Bombs*, audio-as-emotion doctrine). Doctrine: **stingers carry meaning** — a short musical word for each event class, mixed to be *felt*, never buried. Demand: a stinger grammar table: clear-star, par-beat, fall grades, biome-enter — each ≤ 1.5 s, each occupying its own mix slot.

**Seat 64 — Darren Korb** (Supergiant — documented stem-layering method). Doctrine: build cues from **stems** (melody / bass / perc / air) crossfaded by game intensity — the Hades model. Demand: four-stem architecture per cue; intensity driven by the level's event-density histogram (R-LD-07/08 Mizuguchi tie-in).

**Seat 65 — Austin Wintory** (Journey — documented continuous-score doctrine). Doctrine: the score should follow the player's *arc*, not the clock — continuous music that arrives, not music that loops at you. Demand: the ending is through-composed: one continuous cue from final ascent to credits, never looping, resolving the motif [S: ending exists — score upgraded to serve it].

**Seat 66 — Ben Prunty** (Celeste, FTX — documented minimal-stem method). Doctrine: three tiers of intensity (idle / explore / perform) from few stems — cheap to build, enormous in feel. Demand: per-biome three-tier cues: **rest** (idle on a ledge), **play** (standard traversal), **flight** (charged launch: air + perc enter).

**Seat 67 — Lena Raine** (Celeste — documented leitmotif re-harmonization across chapters). Doctrine: one theme, five harmonizations — unity and variety from a single DNA strand. Demand: the MAGNO motif gets one treatment per biome: jaunty (Scrapyard), breezy (Suburbia), neon-pulse (Metropolis), toy-box (Playground), thin-air (Stratosphere).

**Seat 68 — Richard Devine** (modular synthesis master — documented sound-design practice). Doctrine: synthesis systems beat static samples when they are *performances*: macro-parameter randomization within identity (± few percent pitch/decay) kills the machine-gun effect; modulation *is* the life. Demand: every repeat-prone voice randomizes within a ±10% envelope [T]; all parameter macros live in `recipes.ts` [S: recipe system exists — extended].

**Seat 69 — Diego Stocco** (documented experiential/invented-instrument sound design). Doctrine: the most distinctive instruments are *found* ones — the world itself, struck, bowed, and played. Demand: **the junk orchestra identity** — Scrapyard music's percussive layer *is* the material-voice set (fridge-door thunk, locker clank, girder ring [S: material families exist]) — the score and the physics share one source of truth (`config/materials.ts` [S]).

**Seat 70 — Bob Katz** (mastering authority — *Mastering Audio*, K-system). Doctrine: loudness is a *discipline*, not a war: consistent integrated loudness, disciplined true peaks, documented monitoring gain. Demand: −14 LUFS integrated with ≤ −1 dBTP preserved [S], extended to per-biome parity ≤ 1 LU and a published mix hierarchy.

### 20.2 The architecture that already exists [S] (protect, then upgrade)

Web Audio engine with material voices, magnet hum (crossfading attract/repel modes — also a tension device while dangling), adaptive music director, biome ambience, gust lead (wind audible before it pushes [S]), mix bus with ducking (−6 dB, 120 ms on ad breaks [S]), all synthesized — zero bytes; offline loudness tests [S]. The premium upgrade is *musical*, not architectural: motif, stems, tiers, re-harmonization, stinger grammar — all inside the existing recipe/director system.

### 20.3 Requirements — R-AU-01 … R-AU-12

- **R-AU-01 — The MAGNO motif.** Five-note identity, present in: boot hum (within 3 s), every clear card, every biome reveal (re-harmonized), the ending resolve. Hummable test: 4/5 testers reproduce it after one session [T]. *Test:* motif presence map in audio director tests; hummability probe in playtest protocol.
- **R-AU-02 — Cell-based stems (Phillips/Korb).** Cues built from 2–4-bar cells × 4 stems (mel/bass/perc/air) × 3 tiers (rest/play/flight [Prunty]); crossfade ≤ 500 ms; no cue repeats identically within a session (cell rotation). *Test:* director test asserts tier transitions, stem activation, rotation counter.
- **R-AU-03 — Five harmonizations (Raine).** One motif, per-biome treatment table (including instrument mapping to each biome's material palette). *Test:* `recipes.ts` biome-cue registry conformance; motif notes present in all five.
- **R-AU-04 — Junk-orchestra unification (Stocco).** The music's percussive stem sources the *same* material voices as collision SFX (config/materials [S]) — one instrument table for score and physics; the world literally plays itself. *Test:* recipe assertions: perc events map to material IDs; no orphan sample paths (there are no samples — ever).
- **R-AU-05 — Stinger grammar (O'Donnell).** Table: clear-star, par-beat, fall-grade (A/B/C/D classes [S: fall grading]), biome-enter, ghost-set — each ≤ 1.5 s, side-chained (never masked by bed), one stinger at a time. Gust-lead telegraphs preserved [S]. *Test:* stinger map completeness + overlap-forbidden assertion in mix tests.
- **R-AU-06 — Chirp voice (→ R-CH-06).** MAGNO's 12-emotion chirp set, ≤ 250 ms each, band-limited 1–8 kHz [T], always ≤ music bed −6 dB; never during stingers. *Test:* chirp table + mix-slot assertions; panel emotion-recognition ≥ 4/5.
- **R-AU-07 — Published mix hierarchy (Katz).** One table: buses (SFX / ambience / music / UI / chirp), per-bus targets, ducking rules (ads: music −6 dB/120 ms [S preserved]; stingers side-chain the bed −3 dB), monitoring gain note. *Test:* mix-levels suite extended to read the hierarchy table — table and code cannot drift.
- **R-AU-08 — Loudness law.** −14 LUFS integrated, ≤ −1 dBTP master [S preserved]; extended: per-biome integrated loudness parity within 1 LU; UI sounds peak-normalized as a class. *Test:* `tests/loudness.test.ts` gains per-biome render passes.
- **R-AU-09 — Ad ducking preserved.** commercialBreak/rewardedBreak duck the bed (existing behavior [S]) — including the pre-break breath (no music tail into the ad). *Test:* monetization browser test extends audio assertions.
- **R-AU-10 — Performance randomization (Devine).** Every repeat-prone voice (snap, clank, chirp) randomizes pitch/decay ±10% and micro-timing ±20 ms within identity; machine-gun detection test (≤ 3 identical voices in 2 s) in CI. *Test:* recipe randomization ranges asserted; fuzz run with trace.
- **R-AU-11 — The blind-listen gate (the Risk-6 answer).** A/B panel: five listeners, three reference tracks (top-tier platform titles), randomized order, "does this fit a premium game?" — **≥ 4/5 required** before milestone M4 [T]. If below: iterate recipes (macro tuning, chord voicings, reverb character) — commissioning a single 2-minute menu cue is the documented budget fallback, decided by the developer, not defaulted to [QA: review's suggestion, kept as option]. *Test:* panel log in milestone report; recipes revision recorded.
- **R-AU-12 — Silence is composed.** Stratosphere runs air-stem only for its first level (thin-air quiet), teaching the ear dynamics for the ending's through-composed cue; global mute remains fully playable (visual juice carries meaning — R-GF-11). *Test:* biome tier assertions + mute-state playthrough in session test.

### 20.4 Anti-patterns

- Sample packs, stock loops, or any audio file in the bundle [S: zero-bytes law — it is also the payload law].
- The 30-second fixed loop (Phillips' repetition death); stingers over stingers (O'Donnell overlap ban).
- Music louder than the world — the mix table is law (Katz); no LUFS wars vs. other games, only internal discipline.
- Emotional music over comedy falls — falls get the deadpan topper, never tragic strings (Foddy's comedy law, Ch. 13).
- "Tension pad over everything" (the AI-music tell #1): tier system means *quiet* exists (Wintory/Prunty).

### 20.5 Build directive

Lands in `src/audio/music.ts` (cell/stem/tier system), `director.ts` (stinger map, tier triggers from level-event histogram), `recipes.ts` (motif, harmonizations, chirp set, randomization macros), `mix.ts` (hierarchy table), `continuous.ts` (ending cue), `src/config/materials.ts` (junk-orchestra instrument rows), `tests/audio/` suites extended. **The miracle of this chapter: the world's most distinctive audio identity ships at 0 bytes, if the recipes are tuned with intent — that intent is the 12 requirements above.**

---

## Chapter 21 — UX: Menus, HUD & the Hands (Commission H)

### 21.1 The seats and their doctrine

**Seat 71 — Luke Wroblewski** (documented mobile-form and touch-target doctrine). Doctrine: mobile-first is not small-desktop — target sizes are thumbs, patience is shorter, and the primary action lives where the thumb rests. Demand: every interactive target ≥ 48 CSS px on coarse pointers; primary actions in the bottom thumb band.

**Seat 72 — Josh Clark** (*Tapworthy*). Doctrine: design for the thumb's comfort arc — the *edges and bottom* of the screen are prime estate; the top-middle is a desert; never make the thumb hunt. Demand: gameplay touch zones (steer left, flip right) stay in thumb arcs in **both** orientations — already the layout [S]; menus follow the same geography.

**Seat 73 — Ethan Marcotte** (documented *Responsive Web Design* doctrine). Doctrine: one source of truth, fluid under any viewport — proportions over pixels, layout that *flows* rather than snaps. Demand: the stage/scale system (`stage.ts` [S]) keeps flowing from 640×360 to 1031×580 (Poki's canonical trio [P-D]) and beyond — verified per release in the 5-size × 7-language layout audit [S].

**Seat 74 — Sara Soueidan** (documented inclusive-UI practice). Doctrine: accessibility is not a feature list, it is *defaults*: focus you can see, contrast that holds, semantics that machines read. Demand: DOM menus get visible focus rings, semantic buttons, ARIA labels; the *game* itself meets Ch. 28 (canvas accessibility via DOM shadow).

**Seat 75 — Jared Spool** (documented UX research doctrine). Doctrine: users cannot tell you what they want — but they can *show* you where they are stuck; usability is measured, never felt. Demand: menu friction is measured (clicks-to-action counters in telemetry, Ch. 26), and any screen where players visibly hesitate (mouse traces in playtest videos [P-D: playtesting exists]) gets redesigned that cycle.

**Seat 76 — Bill Buxton** (documented multi-touch research). Doctrine: the human is the instrument — design for what hands naturally do (rest positions, simultaneous gestures), not for cursors pretending to be fingers. Demand: multi-touch first: steer-drag and flip-press simultaneously and independently [S: multi-touch tests exist — preserved], palm-chresting doesn't detonate a flip (coarse-pointer dead-zone discipline).

**Seat 77 — Paul Fitts** (Fitts's law, 1954 — the targeting law of the field). Doctrine: acquisition time grows with distance and shrinks with target size. Demand: the *most-used* actions get the *biggest, nearest* zones: flip zone larger than steer zone; Next larger than Map on the clear card (R-UX-07).

**Seat 78 — William Edmund Hick** (Hick's law — decision-time doctrine). Doctrine: reaction time grows with the number of choices. Demand: pause ≤ 5 choices, map ≤ 3 interactions to any unlocked level, locker ≤ 2 levels deep — *decision budgets* enforced in screens tests.

**Seat 79 — Lea Verou** (documented pragmatic web-platform doctrine). Doctrine: use what the platform gives you before inventing machinery — media queries, `prefers-*` settings, semantic elements, CSS functions. Demand: reduced-motion, pointer-type, and viewport handling use standard platform signals (`prefers-reduced-motion`, `pointer: coarse`, `env(safe-area-inset-*)`) rather than bespoke sniffers where possible.

**Seat 80 — Heydon Pickering** (*Inclusive Components*). Doctrine: the accessible pattern *is* the better pattern for everyone — menus, modals, toggles have known-good structures. Demand: modal host (`modal-host.ts` [S]) implements focus-trap, ESC-close, state restore; toggles are real checkboxes/switches in shadow DOM (screen-reader operable — Ch. 28 dependency).

### 21.2 Requirements — R-UX-01 … R-UX-12

- **R-UX-01 — Full-bleed is law [S, P-D].** No letterbox, no bars at any canonical size or orientation — including during slow-mo and the ending. *Test:* layout-browser suite extended to slow-mo + ending captures at 640×360 / 836×470 / 1031×580.
- **R-UX-02 — Touch-target floor (Wroblewski/Fitts).** All interactive targets ≥ 48 px min dimension on coarse pointers; gameplay zones: flip ≥ 25% of screen area, steer-drag zone is the full left half [S]. *Test:* DOM audit in layout test computes target metrics at 360×640.
- **R-UX-03 — Decision budgets (Hick).** Pause ≤ 5 items; unlocked level reachable in ≤ 3 inputs from map; locker item ≤ 2 inputs from locker open; settings ≤ 2 from pause. *Test:* screens test walks each path programmatically, counting inputs.
- **R-UX-04 — Input parity in menus [P-D].** Every menu navigable by keyboard (arrows/enter/space), mouse, and touch with identical outcomes; keyboard nav visible (focus ring, Soueidan). *Test:* screens/keys-screen/controls-screen suites extended with parity assertions.
- **R-UX-05 — Pause omnipotence.** Escape/P toggles pause anytime (except during ads [P-D]); hardware back: gameplay→pause, pause→resume, menus→back one level [S: back-button — extended]; double-back-to-exit never needed (exit lives on the pause menu, Poki frame handles the rest). *Test:* back-button suite extended to menu stack.
- **R-UX-06 — HUD grammar is final and small.** In-game HUD: charge meter, star track, Scrap tally, level/biome label — staged reveal [S] completing by first input or 10 s (R-ON-07); nothing else during play; every element re-justified per Schell's lens in the HUD audit doc. *Test:* HUD element census test — the *set* of HUD nodes is asserted (no creep).
- **R-UX-07 — The clear card is a decision engine (Fitts ranking).** Next (largest, thumb-band) · Retry (mid) · Map (smallest); three tallies visible (R-CL-09); one rotating dangle (R-CL-04 anti-pattern rule); zero other choices. *Test:* screens test asserts hierarchy metrics (relative sizes, positions).
- **R-UX-08 — Modals with manners (Pickering).** Focus trap, ESC-close, state restore, no stacking > 1, and *never* during gameplay motion (R-MZ-06 tie-in). *Test:* modal-host suite extended.
- **R-UX-09 — Icon+text primaries [QA].** Primary buttons pair icon + label (the pause menu's noted professionalism [QA] — made standard); icon-only for universal glyphs (pause, close) with aria-labels. *Test:* icons audit + locale fit test covers the pair.
- **R-UX-10 — Motion preferences honored (Verou).** `prefers-reduced-motion` collapses: camera kick/shake to ≤ 20% amplitude, slow-mo to 50%, HUD transitions to opacity-only — **gameplay-critical timing (coyote/buffer/assist) unchanged** (feel parity for the player who asked for less). *Test:* motion-tokens test extended with a reduced-motion profile row.
- **R-UX-11 — Typography system.** Fredoka [S], one scale table at 3 breakpoints; body text ≥ 14 px equivalent at 640×360; the longest-locale layout test [S] gates every string change. *Test:* existing layout-browser suite + type-scale table in `screens.css` tokens.
- **R-UX-12 — Clicks are counted (Spool).** Boot→first input 0; retry ≤ 1; any unlocked level from map ≤ 3; settings change ≤ 2 — instrumented in telemetry (Ch. 26), reported per milestone. *Test:* session test emits the counter; milestone report includes it.

### 21.3 Anti-patterns

- Top-center buttons on touch (Clark's desert); icon-only mystery meat; text-only walls.
- HUD creep ("just one more badge") — the census test is the fence.
- Pause-menu deep trees (Hick); settings inside settings inside settings.
- Hover-revealed anything on touch (R-MO-06 in the next chapter closes this).

### 21.4 Build directive

Lands in `src/ui/*` (screens.css tokens, hud-reveal, clear-card, modal-host, icons), `src/input/keymap.ts` (parity maps), `src/platform/device.ts` (pointer/viewport signals), plus `docs/HUD_AUDIT.md`. Mostly DOM discipline — cheap, testable, and the *visible face* of craft in every playtest video.

---

## Chapter 22 — Mobile & Cross-Device (the majority platform)

*Poki's audience is majority mobile [P-D]; the QA already proved the plumbing works on emulated phones [QA]. This chapter is about *excellence* on the device class that decides the 500-player test.*

### 22.1 Requirements — R-MO-01 … R-MO-08

- **R-MO-01 — Both orientations, full-bleed, safe-area aware [P-D + QA].** Portrait and landscape fully playable (no forced rotation UI), cover the full canvas at 640×360 / 836×470 / 1031×580 [P-D], and respect `env(safe-area-inset-*)` for notches/rounded corners — HUD never collides with hardware edges. *Test:* layout suite renders both orientations × 3 canonical sizes with safe-area emulation; HUD-zone assertions.
- **R-MO-02 — The split layout [S preserved, documented].** Left half = steer-drag, right half = flip [S]; charge state lights the flip zone with the golden glow [QA-observed]; the zone boundary is visible when the settings option is on [S]; a faint at-rest affordance exists on coarse pointers (R-ON-07). *Test:* input-browser suite + layout assertions at 640×360.
- **R-MO-03 — Tablets are touch [P-D hard rule].** Force touch control schemes on tablets (device classifier [S]); a tablet never shows keyboard prompts by default. *Test:* device suite matrix (tablet profiles).
- **R-MO-04 — Pointer-type routing [S preserved].** Coarse pointer → touch layout & coach; fine pointer → cursor aiming with keyboard hybrid available; touchscreen laptops/Chromebooks start on keyboard [S]. *Test:* existing device tests; new hybrid matrix row.
- **R-MO-05 — Thumb-band rule (Clark).** All gameplay-critical zones within one-thumb arcs in both orientations (documented in a thumb-map overlay for design review); the flip zone never crosses into the top third. *Test:* layout audit emits zone rectangles; assertion vs thumb-band template.
- **R-MO-06 — Hover-independence.** Zero affordances require hover on any pointer type; mouse-only aiming is an *option*, never a requirement [S]. *Test:* fuzz with hover-never inputs completes a level.
- **R-MO-07 — Hardware back [S extended].** Android back: gameplay→pause, pause→resume, modal→close, menu→back a level; never exits the game silently. *Test:* back-button suite covers the full state graph.
- **R-MO-08 — Latency & multi-touch (Buxton/Swink).** All gameplay input binds to `pointerdown`-class events (no click delay, no 300 ms): input→response ≤ 1 frame at 60 Hz; simultaneous steer+flip and palm-rest tolerance verified [S: multi-touch tests preserved]. *Test:* input suite latency assertions + 2-finger interleaved fuzz.

### 22.2 Anti-patterns

- Rotation-lock screens (both orientations are first-class [P-D]); desktop-first layouts scaled down (Wroblewski's inversion sin).
- Anything that assumes hover or a keyboard on touch-first devices.
- Tiny 32 px buttons shipped because "it fits" — 48 px floor or redesign (Fitts).
- Treating tablets as desktops [P-D hard rule violation].

### 22.3 Build directive

Lands in `src/platform/device.ts`, `src/input/input.ts` + `back-button.ts`, `src/render/stage.ts` (safe-area), `src/ui/layout` tests. The mobile build is *the* build: every design decision in Part III was already made thumb-first — this chapter is where that promise is audited.

---

## Chapter 23 — Performance Engineering (Commission I)

*Poki's technical criterion is one sentence [P-D]: "fast load times, stable frame rates, lean file size." The current build is already elite here [QA] — this chapter's job is to make elite survive the premium rebuild's added ambition, with budgets that have CI teeth.*

### 23.1 The seats and their doctrine

**Seat 81 — Yoav Weiss** (Chrome rendering team — documented talks). Doctrine: the rendering pipeline is the budget — parse, style, layout, paint, composite: know which one you are spending; render-blocking anything is the first thief. Demand: boot's critical path is *known* and *counted* (R-PE-06); nothing render-blocking ships without a budget line.

**Seat 82 — Addy Osmani** (Chrome DevRel — documented performance-budget doctrine). Doctrine: budgets are enforced at PR time, not discovered in prod; performance is a feature with acceptance criteria. Demand: the budget table (`docs/PERF_BUDGET.md`) is checked into CI via `check-budget.mjs` [S] — including the `--poki` fix (R-QA-01).

**Seat 83 — Paul Irish** (documented `requestAnimationFrame` and profiling doctrine). Doctrine: the main thread is a single-lane road — everything competes; profile before optimizing; rAF is the clock, timers are drift. Demand: the fixed-tick sim + rAF render marriage [S] stays the only clock; setInterval gameplay is banned outright.

**Seat 84 — Paul Lewis** (documented *High Performance Animations* doctrine). Doctrine: 16.67 ms is the entire frame; animate **transform and opacity only** on the fast path; everything else costs layout/paint. Demand: HUD & DOM UI animations are fast-path-only (R-PE-04); canvas VFX live inside the render budget ledger.

**Seat 85 — Jake Archibald** (documented event-loop/scheduling doctrine). Doctrine: the main thread must *breathe* — long tasks choke input; idle-time is a resource (rIC) to schedule non-critical work. Demand: post-boot work (locale strings beyond EN, ghost data, cosmetic previews [S: progressive loading pattern]) is scheduled, never racing input (R-PE-05).

**Seat 86 — Steve Souders** (*High Performance Web Sites* — documented rules). Doctrine: the frontend is where the user's time goes; reduce requests, inline what's tiny, defer what's not critical, measure the start-render. Demand: zero render-blocking extras in `index.html`; fonts preloaded [S: self-hosted Fredoka], everything else post-boot.

**Seat 87 — Patrick Meenan** (WebPageTest creator — documented filmstrip/waterfall doctrine). Doctrine: the *filmstrip* is the truth — frame-by-frame progression, not aggregate numbers; start-render and first-interaction are the moments that matter. Demand: `npm run loadtime` [S] produces a filmstrip-equivalent report (frame timings to first input) at 3 device profiles — read at every milestone.

**Seat 88 — Surma** (documented workers/WASM doctrine). Doctrine: WASM should *stream* and start early (`WebAssembly.instantiateStreaming`); heavy work belongs off the main thread; but [McKenzie's correction] worker-izing a fixed-tick sim for determinism's sake is a bug generator — stream it, don't scatter it. Demand: streaming instantiation preserved [S]; no base64 WASM, ever (R-PE-07).

**Seat 89 — Sébastien Crozet** (Rapier's author — the very engine this game runs; documented engine guidance). Doctrine: a physics engine is fed by discipline — limit active bodies, let islanding/sleeping work for you, prefer kinematic over dynamic where the answer is known, keep the timestep fixed. Demand: the body-budget gates per level [S] preserved; hazards stay pure functions of run time [S]; zero per-frame allocations in the step (R-PE-09).

**Seat 90 — Alon Zakai** (Emscripten creator — documented WASM size/streaming doctrine). Doctrine: streaming compile overlaps download and compile — it is the difference between "loading…" and "loaded"; binary size is a UX number. Demand: the 1.48 MB discipline continues under the 3.5 MB ceiling — the payload budget is *per asset class*, not one lucky total (R-PE-01).

### 23.2 The verified baseline (protect list) [S, QA]

1.48 MB gzipped total; WASM streamed; sim fixed 60 Hz bit-identical; physics step p99 < 3.5 ms on the seven busiest levels; animation layer p99 0.14–0.31 ms against a 1.5 ms gate; restart 19–37 ms on heaviest levels; cold load ~1.3 s desktop / 4–5 s throttled mid-range; dynamic resolution + quality tiers; particle ceilings; per-level body budgets; 10-minute soak without heap growth; load-time gate harnesses (`run-load-gate.mjs`, `loadtime`, `cold-load`, `perf`, `anim-cost`) already in the repo. **Any workstream that regresses a row above fails CI** (R-PE-02 ledger).

### 23.3 Requirements — R-PE-01 … R-PE-14

- **R-PE-01 — Payload ceiling + class budgets.** Total ≤ 3.5 MB gzipped [T]; per-class lines (JS / WASM / fonts / level-data / UI) in `docs/PERF_BUDGET.md`; audited by `check-budget.mjs` *with the `--poki` flag* (R-QA-01 dependency). *Test:* CI budget job red/green on every PR.
- **R-PE-02 — Frame-budget ledger.** 60 fps = 16.67 ms total: sim step p99 < 3.5 ms [S], animation p99 ≤ 1.5 ms [S], render+composite budget documented per tier; ledger test fails on regression. *Test:* perf/anim-cost harnesses in CI with recorded baselines.
- **R-PE-03 — Tier targets.** tier-high 60 fps (desktop + flagship); tier-mid 60 fps on a 2020 mid-range profile [T]; tier-low ≥ 30 fps on a 2021 budget-Android profile (Mali-G52-class) [T]; dynamic resolution active within tier before any downgrade. *Test:* tier-matrix render profile; fps EMA assertion per tier in soak.
- **R-PE-04 — Fast-path DOM (Lewis).** HUD/menu animations touch transform/opacity only (screens.css tokens audited); `layout thrash` detector in browser tests (forced-reflow count ≤ 5 per state change). *Test:* layout-browser suite gains a reflow counter.
- **R-PE-05 — Boot scheduling (Archibald/Souders).** Critical path: index.html + app JS + WASM + L1 data + font — nothing else render-blocking; post-boot work scheduled (idle callback / microtask queue): non-EN strings, ghosts, cosmetics [S pattern preserved]. *Test:* request census in release test: boot requests == critical set.
- **R-PE-06 — The C2P numbers.** Playable-first-input ≤ 1.5 s desktop, ≤ 4.0 s mid-range over 4G (from 4–5 s [S] to 4.0 [T]), ≤ 10 s low-end slow-4G; filmstrip report at 3 profiles each milestone (Meenan). *Test:* `npm run loadtime` gates; milestone report attaches filmstrips.
- **R-PE-07 — Streaming WASM law.** `instantiateStreaming` with fallback [S preserved]; no base64/inlining (Zakai); WASM size growth ≤ +25% from current. *Test:* build audit asserts streaming path + size line.
- **R-PE-08 — Tier decision & watchdog.** First-frame device probe (renderer/GPU string, DPR, memory hint) picks tier; a frame-time EMA watchdog may down-tier **only** at state boundaries (never mid-flight, never during charge); watchdog events logged (Ch. 26). *Test:* watchdog unit tests + boundary assertion; probe matrix snapshots.
- **R-PE-09 — Physics discipline (Crozet).** Body budgets per level [S]; sleeping/islanding effective on static scenes; hazard kinematics pure on run clock [S]; **zero per-frame heap allocation** in the sim step (soak extended with allocation-diff assertion). *Test:* soak + a new allocation probe on the 3 busiest levels.
- **R-PE-10 — Memory ceilings.** 10-min soak no-growth [S] + 3× full 70-level load/unload cycle with heap delta < 2% [T]; geometry/texture caches LRU-capped, caps documented. *Test:* soak suite extension; cache cap assertions.
- **R-PE-11 — The device-report oracle.** After the first player-fit test, Poki's player device report [P-D] becomes the tier-map authority: recalibrate tier probes + budgets to its device distribution monthly; perf telemetry (fps EMA, tier, device class, watchdog events) ships in the event taxonomy (Ch. 26). *Test:* telemetry fields present; a `tools/tiermap` report generator.
- **R-PE-12 — No long tasks in play.** After first input, any main-thread task > 50 ms = CI failure (longtask observer in soak + browser tests). *Test:* observer wired in soak harness with threshold assertions.
- **R-PE-13 — Permanence of instantaneity.** Restart ≤ 50 ms [S]; level→level ≤ 1.0 s including clear card; zero inter-level loading screens, ever. *Test:* restart-time + session pacing assertions.
- **R-PE-14 — SDK overhead is budgeted.** Poki SDK loads async behind the boot decision; init failure never blocks first input [S fault-guard preserved]; SDK-inclusive boot delta measured and inside the R-PE-06 numbers. *Test:* release test measures with/without SDK mode delta.

### 23.4 Anti-patterns

- Worker-izing or async-izing the fixed-tick sim to "feel modern" — determinism is the product (Surma/McKenzie caveat, repo law [S]).
- Budgetless effects: a single bloom toggle added without a ledger line (Osmani's PR-time law).
- Photo textures, audio files, third-party fonts [S: none exist — keep it that way].
- Overdraw-confetti (full-screen stacked transparent quads) — the particle ceiling exists for this.
- Trusting your flagship phone — the device report is the only market truth [P-D].

### 23.5 Build directive

Lands in `vite.config.ts`, `scripts/check-budget.mjs`, `run-load-gate.mjs`, `tools/loadtime/cold-load/perf/anim-cost.ts`, `src/render/quality.ts` (tier probe + watchdog), `src/platform/fault-guard.ts`, `docs/PERF_BUDGET.md`, soak/test suites. **Performance is the one domain where the game already out-builds most professional submissions [QA] — the premium mandate is: do not spend that lead anywhere else's mistake.**

---

## Chapter 24 — Economy & Progression Design (the non-ad half of monetization)

*Poki's economy law [P-D]: **one understandable currency, clear rewards, no secondary currencies — web players dislike them.** MAGNETOPE's Scrap economy already obeys [S]. This chapter upgrades it from compliant to compelling.*

### 24.1 The seats and their doctrine

**Seat 91 — Michail Katkoff** (Deconstructor of Fun — documented economy teardowns). Doctrine: every economy needs balanced **sources and sinks**, and the joy is the *decision*, not the number; a source without a sink is inflation, a sink without a source is a wall. Demand: the source/sink map is written down and simulated (R-EC-11) — every Scrap earned has a design reason; every price has a psychology.

**Seat 92 — Nick Yee** (Quantic Foundry — documented player-motivation research: Achievement / Immersion / Social). Doctrine: players are motivated by different things; progression systems serve motivations best when each player can see *their* ladder. Demand: three visible tracks for three motivations (stars → Achievement, cosmetics/biomes → Immersion, ghosts/share-cards → Social), each with its own visible progress indicator in the first session (R-GD-04 tie-in).

**Seat 93 — Richard Bartle** (player-types taxonomy — documented classic). Doctrine: achievers, explorers, socializers, killers want different verbs from the same world. Demand: the locker is the explorers' closet (try-before-buying with Scrap), the ghost exchange is the socializers' channel [S], stars are the achievers' mountain — and there is nothing for "killers," correctly, because the platform is a playground [P-D: content safety].

**Seat 94 — Gabe Zichermann** (documented gamification/reward-scheduling doctrine). Doctrine: rewards have *schedules* — fixed rewards build trust, variable rewards build appetite, collection sets build completionist devotion. Demand: the reward schedule table (R-EC-07) mixes all three deliberately; every cosmetic belongs to a set.

**Seat 95 — Greg Costikyan** (*I Have No Words & I Must Design* — documented essay). Doctrine: an economy is a decision space — choices between meaningful alternatives are the game; without trade-offs, shopping is just accounting. Demand: Scrap decisions have texture (save for the signature item vs. spend on two fun ones now — real price separation enforces real choice).

**Seat 96 — John Hopson** (Bungie behavioral-design essays — documented *Behavioral Game Design*). Doctrine: schedule rewards on the player's behavior clock — "not too early, not too late"; reinforcement that arrives after the action it rewards loses the association. Demand: first-item unlock ≤ 180 s [S], next unlock never more than one ordinary session away (R-EC-04), rewards land in the same beat as their earning action.

### 24.2 The verified economy [S]

Scrap (single currency): 10–50 per first clear, 2–8 per replay; 24 cosmetics — 12 Scrap-purchasable, 8 reward-path (ads), 4 seasonal; stars gate biomes at soft thresholds (biome 2 at 15 stars; 210 stars total); assist-off play earns +5% Scrap; progression never gates on spending (cosmetics only); ghost ladder par→personal→friend→regional [S].

### 24.3 Requirements — R-EC-01 … R-EC-12

- **R-EC-01 — One currency, forever [P-D + S].** Scrap is the only spendable number; stars and fall grades are achievements, never money. *Test:* progression suite asserts no second spendable.
- **R-EC-02 — Three documented sources.** Play (clears, stars), mastery (par/no-fall routes, assist-off bonus [S]), optional ads (reward-path items, doubler) — a source table with per-source caps; **no real-money transactions anywhere, ever** (platform + compliance law, Ch. 29.4). *Test:* source table in `tuning.ts`; audit test greps for any pricing hooks.
- **R-EC-03 — Sink map with psychology.** 12 Scrap items priced in three tiers (novelty 30–60 / themed 80–120 / signature 150–200 [T]) so choices trade off (Costikyan); sets themed per biome; seasonal items rotate free on the weekly spotlight [S + R-MZ-12]. *Test:* locker suite asserts price-tier distribution and set membership.
- **R-EC-04 — Pacing law (Hopson).** First item free ≤ 180 s [S]; second item affordable ≤ 15 min of ordinary play [T]; from any moment, the next visible unlock is ≤ 1 ordinary session away (the *dangle law*, enforced on the clear card and locker). *Test:* economy sim (R-EC-11) asserts the pacing medians.
- **R-EC-05 — Collection sets (Zichermann).** Biome sets of 4–5 items; complete-set triggers a purely cosmetic "full-set flourish" (a unique idle animation); collection completion % visible in the locker. *Test:* locker tests assert set structure + flourish unlock.
- **R-EC-06 — Three motivations, three ladders (Yee/Bartle).** Stars (Achievement), cosmetics + biome identity (Immersion), ghosts + share-cards (Social): each track shows progress on the map screen and first-session beat exists (R-GD-04). *Test:* map-screen test asserts three track indicators; session test asserts first beat of each.
- **R-EC-07 — The reward schedule table.** Fixed: per-clear Scrap, star stamps; Variable: fall grades, set-piece moments, dangle rotation; Scheduled: weekly spotlight, seasonal slots [S]. Documented in `docs/ECONOMY.md`; progression bot replays it. *Test:* table ↔ code drift test (doc-drift pattern).
- **R-EC-08 — Difficulty is never for sale.** Assist toggle free and shame-free (R-GF-03); no purchasable easements exist at all (revives/skips live only as *rewarded* options in Ch. 9's placements — never as Scrap sinks). *Test:* locker audit: zero gameplay-effect fields.
- **R-EC-09 — Ghost ladder economics.** Par = author route + 20% (R-LD-17); personal ghost free at first par-beat [S]; friend codes and regional ghosts cost nothing, degrade offline (R-CL-06) — social is never monetized. *Test:* ghost suite + exchange tests.
- **R-EC-10 — Farm-proof without punishing.** Replays earn 2–8 [S] unchanged; ad-Scrap capped 200/day [R-MZ-10]; same-level Scrap replays decay ×0.5 after the 3rd same-day clear to keep the honest path attractive [T]. *Test:* economy sim asserts decay + caps; rewarded-rule compliance (unlimited views, capped *value*).
- **R-EC-11 — The 1,000-player economy sim.** A synthetic economy bot (extending `progression.ts` tests): 1,000 playthroughs sampled from playtime curves assert: zero dead-ends; over-accumulation (unspent > 1.5× priciest item) < 2% of sims; median first-item ≤ 180 s; **full content reachable with zero ads** (R-CL-10 tie) in ≤ ~10 honest hours. *Test:* the sim, in CI.
- **R-EC-12 — Locale-neutral numbers.** Scrap is a fictional unit — no currency symbols; numbers formatted per-locale grouping (CLDR) in `locale/strings.ts` tooling. *Test:* locale suite formats 20000 Scrap in all 7 locales.

### 24.4 Anti-patterns

- A second currency, premium currency, or any IAP-shaped object [P-D violation].
- Progression gates with price tags (R-MZ-02's law, enforced twice on purpose).
- Uniform prices (no decisions — Costikyan's accounting trap).
- Randomized paid-gacha behavior — the locker shows exactly what you get; mystery boxes are a dark pattern and a kids-safety smell (Ch. 29.3).

---

## Chapter 25 — Session Design & Retention (the playtime benchmark's home)

*Poki's engagement doc [P-D] is this chapter's scripture: web players return less; **session 0 carries most of the weight**; ~3-minute repeatable loops; ~1 hour of content; continuous action beats waiting; congratulate every milestone; short- and long-term goals; tune difficulty from playtests ("stuck" = difficulty, "drifting away" = need reward or new challenge).*

### 25.1 Requirements — R-RT-01 … R-RT-12

- **R-RT-01 — Session 0 is the product (Ch. 15 complete + verified).** The first session's arc is the primary retention artifact: spectacle opener, guaranteed early wins, celebration at 45 s, investment at close (R-ON-12). *Test:* session-0 bot + playtest confusion log; entry gate for any player-fit test.
- **R-RT-02 — Return hooks are seeded, not spoken.** At session-0 close: a personal ghost waiting to be beaten, a half-filled set, one locked biome vista card — visible on next boot's map (no notification noise, no guilt). *Test:* session-end state assertions + map first-frame test.
- **R-RT-03 — One-more-go friction floor.** Retry ≤ 1 input (R-CL-08); Next always visible with a dangle (R-CL-04); no inter-level screens that aren't the clear card (R-PE-13). *Test:* pacing counters (R-UX-12) assert retry path ≤ 1 input.
- **R-RT-04 — Sessions end with a highlight, not a cliff.** The session's best falls/clears collect into the rolling highlight strip on the map screen [S — surfaced at natural close and next boot]; a session-summary card (levels cleared, stars, best fall, ghost deltas) appears after a natural break, never interrupts. *Test:* highlight-strip state + summary-card trigger tests (natural-break heuristic documented).
- **R-RT-05 — The weekly spotlight (Zichermann schedule).** One rotating cosmetic per client-side week clock (deterministic, offline-safe, no server) [S: seasonal slots + Stickman-Hook-pattern rotation [R]]. *Test:* week-clock unit tests across date boundaries; rotation determinism.
- **R-RT-06 — Biome gates as chapter hooks.** Every gate triggers the next biome's vista card (R-SM-02's establishing shot teaser) — curiosity, never grind: gate thresholds per original design [S: 15 stars → biome 2…]. *Test:* gate → teaser card assertion in progression tests.
- **R-RT-07 — Beat-your-ghost loop.** After any sub-par clear, the card shows the player's own ghost delta ("you were 1.8 s ahead at the flip") — the cheapest, most personal retention hook in the game [S: ghosts exist]. *Test:* ghost-delta rendering in card tests; personal ghost set at first par-beat (R-EC-09).
- **R-RT-08 — No guilt, no debt (Juul/Eyal ethical line).** No streaks, no decay-on-absence, no daily-login walls, no FOMO countdowns in UI; absence costs nothing, presence earns everything. *Test:* pattern audit — timers/streak vocabulary banned in locale strings test.
- **R-RT-09 — Session-length targets.** Post-opener ship: median ≥ 5 min, p90 ≥ 12 min on owned telemetry [T] — the 7-minute average target of Ch. 3 comes from the whole distribution, engineered by this chapter's stack. *Test:* analytics report per milestone; benchmark table in `docs/KPI.md` (Ch. 26).
- **R-RT-10 — The stuck/drift protocol (Poki's own diagnostic [P-D]).** Weekly funnel ritual: stuck (fail-repeat loops at a level) → R-LD-16 retune cycle; drift (clean exits mid-loop after clear) → dangle rotation + celebrate-cadence audit; each week's read logged with an action item. *Test:* ritual exists in `docs/ROADMAP.md` cadence + heatmap report tooling [S].
- **R-RT-11 — Endgame is depth, not length.** ~1 hour of core content [S + P-D guidance]; the ending completes the story; post-ending: mastery ghosts, collection completion, spotlight rotation, assist-off star-hunting — a replay-depth endgame, honestly sized. *Test:* post-ending content map documented; endgame loops in progression sim.
- **R-RT-12 — Room to grow (Poki criterion #8).** Content-drop architecture ready: level-route slots, biome-6 concept language in roadmap [S], post-release update plan in submission dossier [P-D "systems that support updates"]. *Test:* dossier section exists; level-indexing system supports append (build test).

### 25.2 Anti-patterns

- Retention by obligation (streaks, decay, guilt) — ethically banned (Ch. 4.3) and practically stupid on a platform where session 0 is the only session most players ever give you [P-D].
- Length-padding playtime (violates the 3-minute loop law [P-D]); inter-level "menus" between the player and the next flip.
- Endless-grind cosmetics (a set that can't be finished in honest playtime — the sim catches it).
- FOMO countdowns on seasonal items — the spotlight rotates *in*, never *out of existence forever* (accessibility of collection completion).

---

## Chapter 26 — Analytics & Telemetry (the game's nervous system)

*The repo already consumes Poki's telemetry export for weekly difficulty review (`npm run heatmap -- export.jsonl` [S]) and ships a telemetry layer with parsing/cluster/heatmap tooling [S]. The premium build extends it from "difficulty review" to "full funnels + economy + feel," under one law: [P-D] all measurement flows through the Poki SDK — no external analytics, ever.*

### 26.1 The seats and their doctrine

**Seat 97 — Avinash Kaushik** (*Web Analytics 2.0*). Doctrine: the *segment* and the *funnel* beat the average; every metric needs a paired action ("listen to what the data says when nobody is defending it"); identify "unknown unknowns" via exploratory segment mining. Demand: all reporting is segmented (device class, tier, locale, session index) and every KPI in `docs/KPI.md` names its *decision* — a number with no action attached gets deleted.

**Seat 98 — Alistair Croll** (*Lean Analytics*). Doctrine: **one metric that matters** per stage — before launch it's engagement depth, at web-fit it's the funnel trio, post-release it's retention-return behavior; instrument the loop, not the ego. Demand: the KPI doc declares the stage's One Metric That Matters per milestone (playtime at player-fit; CTR+C2P at web-fit; return behavior at soft release).

**Seat 96 — John Hopson** (cross-cited from Commission J, Ch. 24 — documented behavioral instrumentation practice). Doctrine: measure *behavior*, not opinions; a retry is worth a thousand survey answers; reinforcement is invisible without event trails. Demand: the stuck/drift signatures (R-RT-10) are machine-detected from event trails, not guessed.

**Seats 99 & 100 (cross-cited from Ch. 29) — Lorrie Faith Cranor & danah boyd**: instrumentation must be safe for a child on a school Chromebook. Demand: no PII, no free-text events, no fingerprinting — the vocabulary law (R-AN-09).

### 26.2 Requirements — R-AN-01 … R-AN-10

- **R-AN-01 — Event taxonomy, published.** `docs/EVENTS.md` defines the full vocabulary (names, payloads, trigger points): boot/load stages; session start/stop; pause/resume; level enter/exit/clear/fall/retry with times, stars, cause; assist state; break/rewarded impressions, accepts, declines; Scrap earn/spend; unlocks; ghost set/exchange/beat; nav paths; clicks-to-action counters (R-UX-12); perf (tier, fps EMA, watchdog, downgrade events); fault-guard errors. *Test:* doc-drift CI (names in code ⊆ table).
- **R-AN-02 — SDK-only law.** Every event exits via the SdkBus → Poki SDK `measure` path [S: existing measure taxonomy]; zero other telemetry; ad-block tolerance keeps the game identical without SDK [S]. *Test:* request census (release test) + bus trace assertions.
- **R-AN-03 — Child-safe vocabulary.** No PII, no user free-text in events, no device fingerprinting beyond Poki's own SDK surface; event values enumerated where possible. *Test:* vocabulary audit greps payloads against enum tables; review signature in compliance checklist.
- **R-AN-04 — Export loop preserved & extended.** The Poki export pipeline (heatmap, cluster, records, report [S]) gains: session-0 funnel reader, economy pacing reader, dangle-choice reader. *Test:* analytics suite fixtures grow reader cases.
- **R-AN-05 — KPI doc with decisions (Kaushik).** `docs/KPI.md`: each KPI → segment → benchmark (Ch. 3 targets) → the decision it arms. Stage OMTM declared per milestone (Croll). *Test:* doc present; milestone reports template includes it.
- **R-AN-06 — Session-0 funnel.** Seven events: boot → first input → first clear → level 3 entry → first par → first ghost → first cosmetic. Drop-off between adjacent steps is the playtest-fix target list. *Test:* funnel reader emits step table; confusion log cross-references.
- **R-AN-07 — The Friday report.** One command regenerates: difficulty heatmap (fall/quit per level), session-0 funnel, economy pacing medians, dangle ratios, perf tier distribution — the weekly retune ritual's input (R-LD-16, R-RT-10). *Test:* `tools/analytics/report.ts` produces all five sections from a fixture export.
- **R-AN-08 — Analytics absence changes nothing.** No SDK, no export: gameplay, saves, unlocks, progression identical (storage-resilience doctrine analog [S]). *Test:* session test runs with SDK stub failing; all progress assertions pass.
- **R-AN-09 — Locale- and device-segment parity.** Every KPI readable segmented by locale × device class — the desktop/mobile gap habit of Ch. 8.2 institutionalized. *Test:* reader emits the cross-tab.
- **R-AN-10 — Inspector cross-check in QA.** Poki Inspector [P-D] used in milestone QA to verify SDK events and language behavior in-platform. *Test:* QA checklist row with screenshot evidence slot.

---

## Chapter 27 — Localization (the 7-locale discipline)

*Poki's own guidance [P-D]: start with **EFIGS + Turkish** as the first batch (MAGNETOPE ships exactly this: EN·DE·ES·FR·IT·PT·TR [S]); add CJK/BR-PT/RU when earned; use `PokiSDK.getLanguage()` synchronously at load; manual override in the menu; test through the Poki Inspector's language selector.*

### 27.1 Requirements — R-LO-01 … R-LO-08

- **R-LO-01 — Platform language flow verified [open item, S].** `PokiSDK.getLanguage()` wiring verified on a real Poki-hosted page (Inspector language selector [P-D]); fallback to EN for unsupported; manual override persisted [S: settings]. *Test:* QA checklist row + screenshot; unit test of the supported-code matcher.
- **R-LO-02 — Wordless gameplay, forever [S].** Locales cover menus, cards, settings, locker, store copy — **zero in-gameplay text**; every new UI string ships with all 7 locale rows in the same PR. *Test:* locale completeness test gates merges (no orphan keys).
- **R-LO-03 — Fit law [S extended].** The 5-size × 7-language layout audit [S] gates every string change; UI strings carry ≥ 30% headroom (TR/DE length) before truncation — ellipsis is a bug. *Test:* longest-locale fixtures per screen; layout suite red on overflow.
- **R-LO-04 — Pseudo-locale LQA tooling.** A pseudo-expansion locale (×1.4 length, brackets, diacritics) renders every screen before new strings merge — catches fit bugs before translation money is spent. *Test:* pseudo locale in dev menu; fixtures render.
- **R-LO-05 — Native LQA pass [open item, S].** One native speaker per non-EN locale reviews all screens with a checklist (screenshots per screen per locale, tone notes for the fall-card comedy lines — humor is the hardest string to translate); findings tracked to closure. *Test:* dossier row flips to **done** with evidence.
- **R-LO-06 — Cultural fit of the comedy.** Fall-card toppers, locker item names, tagline: reviewed for idiom-safety per locale; number formatting per locale (R-EC-12). *Test:* LQA checklist section; locale screenshots.
- **R-LO-07 — Font coverage proof.** Fredoka latin covers all 7 [S: verified glyph set]; a render test draws the full string set per locale and asserts zero tofu/missing glyphs. *Test:* locale render sweep in browser test.
- **R-LO-08 — Post-launch batch plan.** CJK/BR-PT/RU evaluated after web-fit (Poki's "when it's worth it" doctrine [P-D]); the strings pipeline (single table [S]) means adding a locale = adding a column, not a refactor. *Test:* pipeline schema test accepts an 8th column fixture.

---

## Chapter 28 — Accessibility (premium includes everyone)

*Not one Poki hard gate — which is exactly why it is a competitive edge: a reviewer who watches a color-blind-safe, reduced-motion-aware, one-hand-playable submission reads *authorship* in every accommodation (Ch. 10.2's craft criterion). The color-vision suite already exists [S]; this chapter generalizes it.*

### 28.1 Requirements — R-AC-01 … R-AC-10

- **R-AC-01 — Never color alone.** Gameplay state is encoded by shape + motion + label, never hue alone: polarity shows in ring *style* (attract: converging chevrons; repel: radiating), hazards in rhythm, weak metal in dents [S: vocabulary exists — asserted]. *Test:* colour-vision suite extended to shape-encoding assertions; simulated dichromacy captures pass the frozen-frame test (R-GF-11).
- **R-AC-02 — Reduced-motion profile.** Per R-UX-10: kicks/shake ≤ 20%, slow-mo 50%, transitions opacity-only; **sim timing never changes** — accessibility never becomes a different game. *Test:* motion-tokens profile test.
- **R-AC-03 — One-hand and tremor tolerance.** Full play with one thumb (zones per R-MO-02/05); forgiveness windows (coyote/buffer [S]) as the tremor aid; assist strength adjustable in settings; no double-tap-only interactions. *Test:* one-thumb fuzz run completes L1–L3; settings assertions.
- **R-AC-04 — No audio-only, no visual-only information.** Gust leads sound *and* streak [S]; charge full: meter, flash *and* voice; every gameplay-critical cue exists in two senses. *Test:* dual-channel audit per cue table.
- **R-AC-05 — Contrast floors.** Text UI ≥ 4.5:1; HUD icons/graphics ≥ 3:1 against worst-case backdrop band (per biome); audited by the silhouette tool (R-AR-09). *Test:* contrast audit in capture pipeline.
- **R-AC-06 — UI scale option.** 100 / 125 / 150% UI scale with layout audit at each step (locale fit law composed). *Test:* layout suite × scale matrix.
- **R-AC-07 — DOM menu accessibility (Pickering).** Semantic buttons, ARIA labels, visible focus, switch/toggle operability, focus-trapped modals (R-UX-08). *Test:* a11y DOM audit in browser test (axe-style rule subset).
- **R-AC-08 — Cognitive load laws.** Hick budgets (R-UX-03), no timed menus, everything skippable except play itself, zero reading during gameplay (wordless law). *Test:* screens tests + copy audit.
- **R-AC-09 — Flash safety.** No sequence flashes > 3×/s anywhere (snap-flash ident audited); reduced-motion also halves flash intensity. *Test:* capture photometry scan across the busiest scenes; profile assertion.
- **R-AC-10 — Visible & documented.** The submission dossier gains an accessibility statement + the settings screen documents every accommodation (a reviewer-visible craft artifact). *Test:* dossier section; settings screen render includes a11y group.

---

## Chapter 29 — Compliance, Safety & the Authorship System (the AI-game answer)

*This is the chapter Poki wrote for this project without knowing it [P-D]: "We look for original games with a clear sense of human creativity, polish, and authorship. Using AI and other tools to accelerate development is fine; **games that feel heavily tool-assisted or rapidly assembled are not.**" Everything else in this PRD builds the game; this chapter builds the thing the reviewer actually judges: proof that a human made this.*

### 29.1 The seats and their doctrine

**Seat 99 — Lorrie Faith Cranor** (privacy researcher, former FTC Chief Technologist — documented privacy-by-design work). Doctrine: design for the most vulnerable user; the *absence of a data surface* is the strongest privacy control there is. Demand: the game collects nothing, persists nothing personal, and teleports nothing anywhere — an offline Chromebook session and a datacenter session are indistinguishable.

**Seat 100 — danah boyd** (documented youth-and-online-safety research). Doctrine: young users are the norm on open platforms, not the edge case; safety is designed in the social surfaces — friend codes, sharing, visibility. Demand: the only social surface (ghost exchange [S]) is a closed vocabulary — opaque codes, zero free text, zero contact surfaces, nothing a stranger can type *at* a child.

*(Their doctrine continues here from Ch. 26's privacy seat — one law, two chapters.)*

### 29.2 The content safety audit (P-D: "anything even slightly shocking" is out)

| Row | Audit question | MAGNETOPE's position |
|---|---|---|
| Violence | Any harm to living things? | None — a robot, slapstick falls, zero combat |
| Shock | Jump scares, gore, horror beats, darkness? | None — the grade card is deadpan comedy, not punishment |
| Gambling | Wagering, mystery boxes, pay-to-spin? | None — prices are labeled, items are shown, Scrap is earned by play (R-EC-10's law) |
| Language | Text/voice content per locale? | Menus only; LQA'd comedy lines; zero profanity adjacency |
| Themes | Religion, politics, tragedy, romance? | "A small robot climbs home" — the most defensible story on the platform |
| Data | Anything collected? | Nothing personal; SDK-only events; child-safe vocabulary (R-AN-03) |
| Ads coexistence | Would an advertiser's brand be unsafe adjacent? | No — clean, bright, toy-scale world [P-D: advertiser comfort is their stated bar] |
| Sound | Loud/sudden audio risks? | Loudness-disciplined (R-AU-08), no stinger stacking |
| Fall "tone" | Is failure punitive? | No — falls are the comedy (Foddy's law); retry is one tap |
| Exit safety | Can a player be trapped? | No — everything interruptible, pausable, skippable (R-GD-06) |

**R-CM-03:** this audit is reviewed at M3 and again pre-submission; any red row is a release blocker. *Test:* the checklist lives in the submission dossier with signature slots.

### 29.3 The authorship system — five layers, all shippable

1. **The AI ledger, completed honestly [S: `docs/AI_LEDGER.md` exists; the human column is the open item].** Every AI-assisted area of the project lists the human decision that shaped it — chosen, rejected, retuned — signed and dated by the developer. Not an apology: a creative-director's log. Poki explicitly welcomes AI-accelerated work [P-D]; the ledger converts that welcome into evidence. **R-CM-04**, *test:* ledger review at M3/M4; human column 100% filled before submission.
2. **Craft signatures — the anti-"rapidly assembled" evidence.** Five moments no template produces, each requirement-tested elsewhere in this PRD: the scripted first launch (R-SM-01), the junk-orchestra identity (R-AU-04), the biome color script (R-AR-05), the fall-grade comedy system (R-GF-07), the wordless ending (R-SM-05). **R-CM-05:** reviewed as a set at M4 — a reviewer must be able to *name the game from any one of them*.
3. **Procedural authorship [S].** Every model generated in code (`kit-*.ts`), every sound synthesized, no asset packs, no templates, no ports [S: clone-defence table]. The build audit proves the negative (no binary assets beyond the font) — machine-checkable originality.
4. **The evidence discipline of this PRD.** [P-D]/[QA]/[S] tags, 214 traceable requirements, doc-drift tests — the *process itself* is an authorship artifact: assembly lines don't write acceptance tests.
5. **The human's name on it.** The developer is the director of record — in the dossier, the ledger, and the ending credits (a wordless game can still say thank-you).

### 29.4 Legal & compliance requirements — R-CM-01 … R-CM-06

- **R-CM-01 — The closed-world law.** Zero external requests (CSP test [S]); zero PII; child-safe event vocabulary (R-AN-03); ad-blocker parity (R-QA-04). One law, three chapters, one CI. *Test:* release test + request census + vocabulary audit.
- **R-CM-02 — License hygiene.** Three.js (MIT), Rapier (Apache-2.0), Fredoka (OFL 1.1, `public/fonts/OFL.txt` [S]) — a `THIRD_PARTY` notice ships in the bundle and repo. *Test:* build audit asserts license files present; dependency license scan.
- **R-CM-03 — Safety audit shipped (29.2's table, signed).** *Test:* dossier row.
- **R-CM-04 — Ledger complete & signed.** *Test:* dossier row + review signature.
- **R-CM-05 — Five craft signatures reviewed.** *Test:* M4 review minute attached to milestone report.
- **R-CM-06 — Closed social surface.** Ghost exchange validates opaque codes only; AUDS records limited to ghost runs; no chat, no usernames shown by default (names are local-only unless the player opts in later — future feature, post-submission decision). *Test:* exchange input validation tests; AUDS payload schema assertion.

### 29.5 Anti-patterns

- Hiding the AI (a ledger discovered late is worse than none) — Poki's policy explicitly *permits* acceleration [P-D]; the crime is feeling assembled, and hiding is assembling.
- "Disclaimers" — the ledger is a director's log, not an apology.
- Compliance theater (checklists without signatures) — every row above has a human's name on it or it does not count.

---

## Chapter 30 — QA & Release Engineering (the process that makes hard gates permanent)

*The prior QA session proved the gates pass [QA]. This chapter's job: make sure they pass on a Tuesday in three months when nobody heroic is watching.*

### 30.1 The verified spine [S]

~1,700 behavioural tests; browser-driven suites (session, soak, monetization, restart, controls, input, layout, fuzz on the real game); the 10,000-input SDK trace judge; the load gate; the budget audit; the CSP release test; solver/ablate/reach CLI verification; telemetry readers; all in `npm test` + `npm run build:poki` (one flag from fixed, R-QA-01).

### 30.2 Requirements — R-QA-01 … R-QA-10

- **R-QA-01 — The first commit.** `build:poki` passes `--poki` to `check-budget.mjs` (the false-positive audit failure [QA]); gate goes green on a Poki build. *Test:* CI green on `build:poki` — trivial, mandatory, first.
- **R-QA-02 — The Milestone Gate (Ch. 7.8).** At M1–M5 the full battery runs against the real artifact: canonical sizes, incognito, CSP, trace judge, ad-block sim, budgets, cold-load profiles, zero-page-errors. *Test:* the battery script exists (`scripts/milestone-gate.mjs`), red blocks milestone.
- **R-QA-03 — Resilience invariant.** Every new persistence feature ships with incognito/quota/corrupt tests in the same PR [S pattern]. *Test:* review checklist + suite.
- **R-QA-04 — Ad-block CI.** SDK-blocked run: game boots, plays, saves, celebrates — zero errors [QA-verified live; now automated]. *Test:* browser test with blocked SDK stub.
- **R-QA-05 — Physical device matrix [open item, S].** One phone, one tablet, one low-end laptop; both orientations; Chrome + (if available) Samsung Internet/Firefox; evidence rows (photos/screen-records) in the dossier — **before submission**. *Test:* dossier matrix table filled.
- **R-QA-06 — The human playthrough [open item, S].** Developer plays all 70 levels + ending with the per-level verdict form (fair? fun? flow?), feeding R-LD-16 retunes; dull levels are bugs. *Test:* verdict form completed; retune issues closed.
- **R-QA-07 — The 5-tester dress rehearsal [open item, S].** Five external playtesters, screen recordings, protocol focused on first 90 seconds + first fall + first ad moment [P-D: playtesting mirrors]; findings log → fixes → closure before player-fit. *Test:* protocol artifacts in dossier.
- **R-QA-08 — Submission-day runbook.** One page: build green → thumbnail pre-flight (R-TH-09's five checks) → dossier current → ledger signed → categories chosen (30.4) → upload → playtest immediately → log the first 10 videos. *Test:* runbook exists; executed with checklist evidence.
- **R-QA-09 — Suite health.** Browser suites run (not skip) in the real CI environment; milestone battery ≤ 10 min wall-clock; flake quarantine ≤ 72 h or fix. *Test:* CI report fields.
- **R-QA-10 — Version discipline.** Each Poki submission = one git tag + CHANGELOG row + dossier state hash — the reviewer's questions always answer against a specific build. *Test:* tag-audit in runbook.

### 30.3 The category strategy (positioning the portfolio-overlap defense)

Suggested categories (Poki allows up to 4 suggestions [P-D], their team balances the mix): **physics · puzzle · skill · one-button** — the spaces where "magnet-polarity climber" is a differentiator, deliberately adjacent-but-distinct from the swing-fling lineage (Ch. 10.4). Tags mirror this: physics, magnet, skill, one-button, 3D, casual, speedrun [S: trimmed of tone-risky rage/ragdoll labels per Ch. 10.3]. *Requirement R-QA-11:* the category suggestion set + rationale is written in the dossier, re-checked against the live catalog at submission time (the platform's portfolio moves; the fourth row of Ch. 10.4's defense is honest: this is checked *at the door*).

### 30.4 The post-submission protocol (what the developer does while Poki measures)

1. Playtest immediately; watch all 10 videos twice; log confusions (the unlock for player-fit is watching them [P-D]).
2. Run player-fit only when Ch. 6.2's entry conditions are true; then read it per Ch. 8.2 (device-split C2P, playtime distribution).
3. Iterate per the published diagnostics (CTR→thumbnail variants [R-TH-07's reserve]; playtime→stuck/drift protocol; C2P→load/onboarding) — *one focused change per test* [P-D's own iteration advice].
4. Prepare parallel-portal builds (CrazyGames, GameDistribution, itch.io) — subject to the signed agreement's exclusivity terms — the portfolio law (Ch. 10.5).
5. Start game #2 the same week (Blumgi's law [R]: a catalog is a business; also: it keeps the developer sane during a 2–3-month pipeline).

# PART IV — THE BUILD SPEC
## From 214 requirements to an ordered, testable rebuild

*The workstreams are dependency-ordered, sized for a solo developer with AI assistance, and each ends in evidence. An AI builder takes one workstream at a time (Rule 3) and cannot proceed while its gate is red.*

---

## Chapter 31 — The Sixteen Workstreams

| # | Workstream | Scope (requirements) | Effort* | Exit evidence |
|---|---|---|---|---|
| **W1** | **Gate repairs** | R-QA-01 (`--poki` flag), milestone-gate script (`scripts/milestone-gate.mjs`) + baselines capture (R-QA-02 infra) | 0.5 d | CI green on `build:poki`; battery report exists |
| **W2** | **The Opener** | R-ON-01…07, R-SM-01…02, R-GF-12: scripted first launch, idle-nudge ladder, HUD reveal law, first-45 s arc verified end-to-end | 3 d | Session-bot timing evidence + capture diff of the first 4 s; interrupt-fuzz green |
| **W3** | **Thumbnail system** | R-TH-01…10: composition scene, 3 variants, audit tooling (128 px / contrast / hue / OCR), panel protocol, animated ident | 2 d | Panel log ≥ 9/10 on the winner; all audits pass; assets regenerated |
| **W4** | **The casual on-ramp** | R-LD-02/03/12/13/14/15/22, R-ON-10: tuning ramp tables L1–L10, telegraph pass, guaranteed clears, fall-rate gates; uses solve/ablate/reach | 4 d | On-ramp bot run (fresh profile) + curve-band assertions green |
| **W5** | **Juice pass I — launch & snap** | R-GF-01…06, R-SM-03, R-SM-06: Nijman stack on release, anticipation/follow-through, charge scene, shake/hit-stop discipline, snap ident + spacing | 3 d | Capture set shows 5-feedback release frame; budgets green; frozen-frame panel ≥ 9/10 |
| **W6** | **Level language II** | R-LD-01/04…11, R-AR-06/07, R-LD-16/17: skill-atom table, clockwork pacing assertions, elegance cut pass (ablate-driven), prop vocabulary, curve data ritual | 4 d | `docs/LEVELS.md` complete; pacing histograms conform; cut list executed |
| **W7** | **The doc-drift spine** | R-GF-14 (FEEL.md), R-SM-07 (SPECTACLE.md), R-AR-05 (COLOR_SCRIPT.md), R-EC-07 (ECONOMY.md), R-AN-01 (EVENTS.md) + CI doc-drift tests | 2 d | Five docs generated-checked; drift tests in CI |
| **W8** | **Character charm** | R-CH-01…06, R-AU-06: idle performance, eye-state table, chirp vocabulary, secondary motion, MAGNO.md emotion map | 3 d | Rig suites green; chirp emotion panel ≥ 4/5; 64 px silhouette 5/5 |
| **W9** | **Audio identity** | R-AU-01…05/07…12: motif + five harmonizations, stems/tiers, stinger map, junk-orchestra wiring, mix hierarchy, randomization, silence design | 4 d | Director/mix suites green; **blind-listen ≥ 4/5 gate (R-AU-11) run** |
| **W10** | **Economy & retention systems** | R-EC-01…12, R-RT-01…07/09…12: reward schedule, sets & flourish, spotlight clock, session summary, ghost-delta card, dangle rotation | 3 d | 1,000-player economy sim green; session-end state tests |
| **W11** | **Telemetry & KPI** | R-AN-01…10: EVENTS.md + bus wiring, funnel readers, Friday report, `docs/KPI.md`, device segmentation | 3 d | Fixture-export run produces all 5 report sections |
| **W12** | **Accessibility & l10n hardening** | R-AC-01…10, R-LO-02…04/07: shape-encoding audit, contrast tooling, UI scale, pseudo-locale, font render sweep | 2 d | A11y audit suite + pseudo-locale fixtures green |
| **W13** | **Performance hardening** | R-PE-01…14 gaps: budget table + CI, tier watchdog, longtask observer, soak extensions, allocation probe, loadtime filmstrip | 2 d | Budget CI red-line; watchdog tests; filmstrip report at 3 profiles |
| **W14** | **Monetization etiquette** | R-MZ-01…13 (placement layer in SdkBus path, rewarded placements, ad-free parity test) | 2 d | Placement-layer trace test + ad-block parity suite green |
| **W15** | **Authorship & compliance** | R-CM-01…06, R-RT-08: ledger completion, safety audit signatures, craft-signature review pack, license file, guilt-pattern ban audit | 2 d | Ledger signed; audit rows signed; THIRD_PARTY in bundle |
| **W16** | **Funnel operations (ongoing)** | R-QA-05…08, R-GD-08, R-LD-16 ritual, R-RT-10 ritual, Ch. 30.4 protocol: physical matrix, human playthrough, 5-tester rehearsal, runbook, submission itself | ongoing | Dossier rows flip to **done** with evidence |

\* Effort = focused solo days with AI assistance, calibrated against the repo's existing tooling (the tooling is unusually strong [S] — every workstream leans on `solve / ablate / reach / capture / heatmap / perf` rather than inventing new machinery). Total ≈ **44 focused days + the funnel's calendar time** — deliberately small, because premium here is *decisions and discipline*, not scope.

**Dependencies (the order is the contract):** W1 → W2 → (W3 ∥ W4) → W5 → W6 → W7 → (W8 ∥ W9) → W10 → (W11 ∥ W12 ∥ W13) → W14 → W15 → W16. The parallel pairs are safe (they touch disjoint files); everything else is serial because *feel decisions cascade* (Ch. 13 before levels, levels before docs, docs before tests-of-docs).

---

## Chapter 32 — Architecture: Where Every Requirement Lands

### 32.1 The protected spine (touching these requires a written amendment)

| Spine asset | Why untouchable |
|---|---|
| `src/sim/*` fixed-tick determinism | Bots, ghosts, replays, routes, soak — the entire verification economy [S] |
| `src/platform/sdk-bus.ts` state machine | Poki SDK correctness by construction [QA-verified] |
| `src/platform/storage.ts` resilience pattern | Incognito hard gate [P-D] |
| The 1.48 MB → 3.5 MB budget law | Load/C2P class advantage (Ch. 23) |
| Zero binary assets (except the font) | Originality-by-construction + payload law [S] |
| Wordless gameplay + one currency | Platform law [P-D] × design law (Ch. 27/24) |

### 32.2 New surfaces this PRD adds

| New | Contents | Landing workstream |
|---|---|---|
| `scripts/milestone-gate.mjs` | The Ch. 7.8 battery | W1 |
| `docs/FEEL.md` `SPECTACLE.md` `COLOR_SCRIPT.md` `ECONOMY.md` `EVENTS.md` `KPI.md` `LEVELS.md` `MAGNO.md` `HUD_AUDIT.md` `PERF_BUDGET.md` | The doc-drift spine (generated-checked) | W7 (then per-workstream content) |
| `src/game/opener.ts` | Scripted first-launch + nudge ladder | W2 |
| `src/render/thumbnail-scene.ts` + capture mode | Card composition truth | W3 |
| `src/config/onramp.ts` | L1–L10 assist/spacing ramp tables | W4 |
| `src/platform/ad-placement.ts` | Break/rewarded placement policy layer (wraps SdkBus) | W14 |
| `tools/audit/{silhouette,contrast,shape,pseudo-locale,alloc-probe}.ts` | The audit CLIs this PRD's tests call | W5–W13 |
| `tests/onramp.test.ts` `tests/a11y-dom.test.ts` `tests/economy-sim.test.ts` (+ extensions of 20 existing suites) | The acceptance language | throughout |

### 32.3 The placement map (requirement domain → primary files)

**GD** `game/game.ts`, `coach.ts`, playtest rituals · **CL** `game/game.ts`, `ui/*` cards, `tuning.ts` · **GF** `render/vfx|particles|magno-rig|camera-rig|post-*`, `audio/director.ts` · **LD** `levels/*`, `config/tuning.ts`, `tools/{solve,ablate,reach,design,heatmap}.ts` · **ON** `game/game.ts`, `game/coach*.ts`, `ui/hud-reveal.ts`, `game/slowmo.ts` · **SM** `game/slowmo.ts`, `render/{camera-rig,backdrop,ending-stage}.ts`, `ui/share-card.ts` · **TH** `tools/{thumbnails,capture}.ts`, `tools/check-thumbnail.py`, `render/grade.ts` · **AR** `render/{palette,grade,stage,backdrop,prop-kit}.ts` · **CH** `render/magno-rig.ts`, `blink-look.ts`, `audio/recipes.ts` (chirps), `config/cosmetics.ts` · **AU** `audio/{music,director,recipes,mix,continuous}.ts`, `config/materials.ts` · **UX** `ui/*`, `input/keymap.ts` · **MO** `platform/device.ts`, `input/*`, `render/stage.ts` · **PE** `vite.config.ts`, `scripts/check-budget.mjs`, `render/quality.ts`, `tools/{loadtime,cold-load,perf,anim-cost}.ts` · **MZ/EC** `platform/ad-placement.ts`, `game/progress.ts`, `game/locker.ts`, `config/cosmetics.ts` · **RT** `game/game.ts` (session summary), `game/ghost-director.ts`, `ui/map-screen.ts` · **AN** `platform/telemetry.ts`, `tools/analytics/*` · **LO** `locale/*`, strings pipeline · **AC** `render/palette.ts` (shape encoding), `ui/screens.css` (focus/scale), tests · **CM** `docs/AI_LEDGER.md`, dossier · **QA** CI battery + rituals.

---

## Chapter 33 — Data & Tuning Schemas (the machine-readable contract)

*Rule 2 (never invent numbers) requires that every tunable number lives in one place with a table behind it. These schemas are that place. All files are generated-checked (doc-drift CI): the table and the code cannot disagree.*

### 33.1 `src/config/tuning.ts` — the master knobs file

Every entry: key · value · unit · range (min/max with rationale) · evidence tag · linked requirement ID · comment (one line, why it exists). Example shape:

```ts
/** R-GF-03 [R:Thorson ≤150ms] Coyote window for snap after leaving a surface. */
coyoteMs:          { v: 120,  unit: 'ms',  min: 80,  max: 150 },
/** R-LD-14 [T] On-ramp assist strength multiplier, levels 1-5 → 1.5, 6-10 → 1.25, 11+ → 1.0 */
assistRamp:        { levels: [5, 10], mult: [1.5, 1.25, 1.0] },
/** R-MZ-03 [T] Minimum spacing between any two commercial breaks in one session. */
breakFloorMs:      { v: 90_000, unit: 'ms', min: 60_000, max: 180_000 },
```

**CI test:** the tuning table parses; every `v` sits inside `[min,max]`; every entry carries a requirement ID that exists in this PRD; duplicate keys fail.

### 33.2 Level route metadata (`src/levels/routes/*.json`)

Existing routes [S] gain three fields, all consumed by tests (R-LD-01/02/03/07):

```json
{
  "id": "scrapyard-04",
  "route": [ /* solver frames, unchanged */ ],
  "skillAtom":  { "teaches": "weak-metal-decay", "practices": "mid-power-exit", "examines": null },
  "phase":      { "establish": 0.18, "twist": 0.42, "escalate": 0.78, "resolve": 0.95 },
  "telegraph":  { "type": "weak-metal", "visibleFromSpawn": true, "previewSec": 2.1 }
}
```

**CI test:** every route row validates against the schema; `skillAtom.teaches` must appear earlier in `docs/LEVELS.md` than any level that `examines` it (Cook's gap law, machine-checked).

### 33.3 `docs/EVENTS.md` — the telemetry vocabulary

Table format: `event · payload (typed, enumerated) · trigger point · requirement(s) · segment fields`. No free-text fields exist anywhere in the schema (R-AN-03). The doc-drift test asserts: every `bus.emit(<name>)` in code exists in the table; every table row's payload type-checks against the emit sites.

### 33.4 `thumbnails/report.json` — the panel log (R-TH-07/09)

```json
{ "date": "2026-11-02", "variants": ["A-hero-launch","B-fall-comedy","C-tower-scale"],
  "panel": { "n": 10, "exposureMs": 200, "forcedChoiceWinner": "A-hero-launch", "score": 0.9 },
  "audits": { "legibility128": true, "contrast": 3.4, "hueCollision": false, "ocrEmpty": true },
  "uploaded": "A-hero-launch" }
```

**Gate:** `score ≥ 0.9` and all audits true → may request a web-fit test (R-TH-09's ritual).

### 33.5 The doc-drift set (Ch. 32.2) — one pattern, five+ files

`FEEL.md` (transition → juice stack → audio map → budget cost), `SPECTACLE.md` (beat → emotion → composition → test), `COLOR_SCRIPT.md` (biome × beat), `ECONOMY.md` (sources/sinks/schedule), `KPI.md` (metric → segment → benchmark → decision). Each pairs with a CI test that parses the doc and asserts code-referent consistency. **A doc that cannot be tested is deleted** — if it can't answer to CI, it isn't a spec, it's poetry.

---

## Chapter 34 — Milestones & Definition of Done

### 34.1 The six milestones

| Milestone | Contains | Entry gate | Exit gate (Definition of Done) |
|---|---|---|---|
| **M0 — Baseline** | The current build [QA] | — | Audit recap verified; W1 scoped |
| **M1 — Gates** | W1 | Baseline CI red on `build:poki` | `build:poki` green; battery script runs; all hard-gate rows green on M1 artifact (R-QA-02) |
| **M2 — The Offer** | W2 + W3 | M1 | Session-bot timing evidence; capture diff of the 4-second opener; **thumbnail panel ≥ 9/10**; R-GD-07 vocabulary probe ready; predicted C2P-critical numbers green (R-PE-06) |
| **M3 — The Game** | W4 + W5 + W6 | M2 | On-ramp bot green; frozen-frame panel ≥ 9/10; `LEVELS.md` complete; pacing histograms conform; **Poki playtest #1 run, confusion log closed**; safety audit signed (R-CM-03); ledger reviewed (R-CM-04) |
| **M4 — The Identity** | W7 + W8 + W9 + W10 | M3 | **Blind-listen ≥ 4/5**; chirp panel ≥ 4/5; economy sim green; craft signatures reviewed (R-CM-05); **playtest #2 run**; player-fit entry conditions all true (Ch. 6.2) |
| **M5 — The Submission** | W11–W15 + W16 kickoff | M4 | Friday report runs; a11y suite + pseudo-locale green; budget CI live; placement tests green; ledger signed; **physical device matrix + human playthrough + 5-tester rehearsal done**; runbook executed; **Final Gate (Ch. 35) ≥ 95/100 with every red item carrying a dated remediation** |

### 34.2 Global Definition of Done (applies to every workstream merge)

1. The requirement ID(s) are in the commit message and the PR description carries the acceptance-test evidence.
2. The milestone battery (R-QA-02) is green on the merge's artifact — no red gate ever waits for "later."
3. Zero page errors in the workstream's own browser sessions (Rule 7).
4. Docs touched by the change pass their doc-drift test (Rule 9's language: untested requirement = unmet requirement).
5. The tuning table parses and every new number carries an evidence tag (Rule 2).
6. No merge deletes or weakens a Protected Spine item (Ch. 32.1) without a written amendment referencing the requirement that justifies it.

### 34.3 The honest calendar

44 focused days of build + the funnel's own clock (playtests within hours, player-fit ~5 h, web-fit ~3–5 days, final review 1–2 weeks, release pipeline 2–3 months [P-D]). The plan is built to enter the funnel at M4's exit — with the game already excellent — and use the free tests as the last polishing loop rather than the first quality check. Over-polishing past that point violates Ch. 4.3: the funnel's data is worth more than a fifth perfection pass in the dark.

---

## Chapter 35 — The Final Gate: the 100-Point Zero-Rejection Audit

*The submission-day instrument. Ten sections × ten points. Each point cites its requirement ID(s) and needs **evidence** — a CI log, a capture, a panel sheet, a dossier row. 1.0 = evidence complete; 0.5 = machine evidence only, human evidence pending; 0 = fail. **Submission requires ≥ 95.** A failing point gets a dated remediation or a written, honest waiver — never a shrug.*

| § | Points (requirement IDs in parentheses) |
|---|---|
| **A. Hard gates** | 1 Devices/aspect verified live (7.1–7.2, R-MO-01/03) · 2 Incognito + corrupt-save (7.3, R-QA-03) · 3 Zero external requests + CSP (7.4, R-CM-01) · 4 No splash/outbound/other-ads (7.5) · 5 Ad-block parity in CI (7.5, R-QA-04) · 6 SDK trace judge green (7.6) · 7 `build:poki` budget green incl. `--poki` (7.7, R-QA-01) · 8 Cold-load filmstrips at 3 profiles (R-PE-06) · 9 Zero page errors across battery (R-QA-02) · 10 Suite health: browser tests run, ≤10 min battery (R-QA-09) |
| **B. The card** | 1 200 ms composition (R-TH-01) · 2 128 px legibility · 3 Text-free OCR-empty (R-TH-02) · 4 Contrast ≥ 3:1 dimmed (R-TH-05) · 5 No `#83FFE7` collision · 6 Eye/emotion 5/5 (R-TH-06) · 7 Panel ≥ 9/10 logged (R-TH-07/09) · 8 Animated ident ≤ 3 s ≤ 300 KB (R-TH-10) · 9 Magnet-signature visible, no-hook-read (R-TH-04, R-GD-07) · 10 Lockup tokens used in 3 surfaces (R-TH-08) |
| **C. The opener** | 1 Boot→input ≤ 3 s / 6 s (R-ON-01, R-PE-06) · 2 No menu before world (R-ON-01) · 3 Three-questions first frame (R-ON-02) · 4 First flip = spectacle, guaranteed (R-ON-03, R-SM-01) · 5 The 45-second contract timing (R-ON-04) · 6 Modality parity beats (R-ON-05) · 7 Nudge ladder ≤ 3 rungs (R-ON-06) · 8 HUD visible by first input/10 s (R-ON-07) · 9 Reward timeline met (R-ON-08) · 10 Session-0 investment state (R-ON-12) |
| **D. Feel** | 1 Five-feedback release frame (R-GF-01) · 2 Anticipation/follow-through (R-GF-02) · 3 Windows ≤ 150 ms & named (R-GF-03) · 4 Snap relief-momentum stack (R-GF-04) · 5 Charge scene complete (R-GF-05) · 6 Shake/hit-stop discipline (R-GF-06) · 7 Fall comedy 3-beat (R-GF-07) · 8 Frozen-frame panel ≥ 9/10 (R-GF-11) · 9 Tier feel parity 0 ms delta (R-GF-13) · 10 FEEL.md drift-free (R-GF-14) |
| **E. Levels** | 1 Skill-atom table complete, gap-free (R-LD-01/09) · 2 Portal triple per twist (R-LD-02) · 3 Telegraphs visible from spawn (R-LD-03) · 4 Reach/ablate gates green (R-LD-04) · 5 Checkpoint + hazard-clock laws (R-LD-05/06) · 6 Clockwork histograms (R-LD-07) · 7 Curve band + re-teach dips (R-LD-16/19) · 8 On-ramp bot ≤ 10% median L1–L5 (R-LD-14) · 9 Fair-loss capture set ≥ 9/10 (R-LD-15) · 10 Par honesty + full-star bot run (R-LD-17/18) |
| **F. Identity** | 1 Committed look, all tiers (R-AR-01/11) · 2 Color script + grade conformance (R-AR-02…05) · 3 Backdrops ≥ 2 layers + landmark (R-AR-06) · 4 Prop provenance/wear pass (R-AR-07) · 5 MAGNO 64 px + plush test (R-CH-01) · 6 Idle charisma + eye states (R-CH-02/03/04) · 7 Chirp panel ≥ 4/5 (R-CH-06, R-AU-06) · 8 Motif hummability 4/5 (R-AU-01) · 9 Five harmonizations + junk orchestra wired (R-AU-03/04) · 10 **Blind-listen ≥ 4/5** (R-AU-11) |
| **G. Economy & ads** | 1 One currency audit (R-EC-01) · 2 No progression gates, ever (R-EC-08, R-CL-10) · 3 Source/sink table + sim green (R-EC-02/11) · 4 Pacing law medians (R-EC-04) · 5 Sets + spotlight clock (R-EC-05, R-RT-05) · 6 Break floor + placement map (R-MZ-03) · 7 Rewarded etiquette: primary-position natural path (R-MZ-04…06) · 8 Reward celebration + auto-apply (R-MZ-08/09) · 9 Ad-free completeness run (R-MZ-13) · 10 Guilt-vocabulary ban (R-RT-08) |
| **H. Cross-device & perf** | 1 Thumb-band + target floor audits (R-UX-02, R-MO-05) · 2 Decision budgets (R-UX-03) · 3 Input parity all menus (R-UX-04) · 4 Back-button graph (R-MO-07) · 5 Latency + multi-touch (R-MO-08) · 6 Budget table + ledger green (R-PE-01/02) · 7 Tier targets on matrix profiles (R-PE-03) · 8 Watchdog + longtask green (R-PE-08/12) · 9 Soak + allocation probe (R-PE-09/10) · 10 Instantaneity: restart/level-link (R-PE-13) |
| **I. Trust & law** | 1 EVENTS.md drift-free (R-AN-01) · 2 SDK-only + child-safe vocabulary (R-AN-02/03) · 3 Shape-encoding + contrast audits (R-AC-01/05) · 4 Reduced-motion + UI scale (R-AC-02/06) · 5 Locale fit + font sweep 7/7 (R-LO-03/07) · 6 `getLanguage()` verified on-pavement (R-LO-01) · 7 Ledger complete & signed (R-CM-04) · 8 Safety audit signed, zero red (R-CM-03) · 9 Licenses + THIRD_PARTY in bundle (R-CM-02) · 10 Closed social surface (R-CM-06) |
| **J. Release ops** | 1 KPI doc with decisions + OMTM (R-AN-05) · 2 Friday report runs on fixture (R-AN-07) · 3 Device matrix physical evidence (R-QA-05) · 4 Human 70-level playthrough verdicts (R-QA-06) · 5 Five-tester rehearsal artifacts (R-QA-07) · 6 Runbook executed + version tag (R-QA-08/10) · 7 Categories + rationale current (R-QA-11) · 8 Funnel rituals scheduled (R-GD-08, R-RT-10) · 9 Dossier every row done/parts honest (SUBMISSION.md) · 10 Predicted scorecard ≥ 95 (below) |

### 35.1 The predicted scorecard (how the panel maps to Poki's eight criteria)

| Poki criterion | Weight·logic (from their doc [P-D]) | MMP predicted score |
|---|---|---|
| Quality / core loop & feel | Exceptional craft compensates elsewhere | **9.5** (D+E+F sections) |
| Player fit | Majority-mobile casuals; 500-player test | **9.0** (C+E+G: on-ramp + hooks + margin) |
| Technical | Load · fps · size across devices | **9.5** (A+H: already elite [QA], now permanent) |
| Originality & craft | Human authorship, uniqueness in category | **9.5** (B·C·F signatures + Ch. 29 system) |
| Depth & replayability | Opens over time | **9.0** (ghosts, stars, sets, mastery ladder) |
| First impression | Seconds: card → boot → first input | **9.5** (B+C: engineered 200 ms→15 s→45 s) |
| Cross-device feel | Thumb + mouse parity | **9.5** (H: audited, both orientations) |
| Room to grow | Content hooks, update systems | **9.0** (W16 architecture + roadmap language) |
| **Weighted total (their lens)** | — | **≈ 9.3 / 10 — submit** |

Honesty note, because this document owes you that: the predicted scorecard is the *local* projection of Section A–J evidence. The funnel's 500 strangers and 10,000 impressions remain the only votes that count on Player fit and First impression; the scorecard exists to guarantee the game walks in over *every* measurable bar, not to replace the measurement.

---

## Chapter 36 — The Residual Risk Register (what could still go wrong, and its tripwire)

| # | Residual risk | Tripwire (signal) | Mitigation already built | If it fires |
|---|---|---|---|---|
| 1 | Playtime variance in the 500-player test (the true unknown) | Player-fit < 4 min median | Margin design (7-min target), hooks stack, on-ramp | Stuck/drift protocol; retune same week; retest is free |
| 2 | CTR taste variance (panel of 10 ≠ 10,000 strangers) | Web-fit CTR score ≤ 2 | 3 scored variants; post-sign-off swap path [P-D policy] | Fresh-take thumbnail per their own cure [P-D]; re-run web fit |
| 3 | Low-end long tail (devices no profile predicts) | Device report + watchdog telemetry outliers | Tier-low aggression, downgrade-at-boundary | Retune tier probe to the report; ship perf patch in soft release |
| 4 | Portfolio overlap drift (their catalog moves) | Category check on submission day | Differentiation legibility (R-GD-07), category rationale (R-QA-11) | Reframe suggested categories; lean originality dossier |
| 5 | Audio gate miss (blind-listen < 4/5) | M4 gate | Recipe iteration loop | Iterate macros/voicings; commissioned 2-min cue as budgeted fallback |
| 6 | Synth perception residual ("programmer music") | Playtest tone comments | Junk-orchestra identity — distinctiveness over imitation | Push identity harder (the Stocco law), never chase sound-alikes |
| 7 | Solo-maintainer fatigue | Velocity collapse across two workstreams | Serial scope; 44-day plan; funnel-as-validation; next-game parallel | Re-scope: W12/W13 defer; core offer (W1–W9) is the product |
| 8 | Poki policy/SDK drift during the 2–3-month pipeline | Monthly docs-changelog read (Ch. 30.4) | SdkBus isolation [S]; re-verification ritual (R-QA-02) | Patch bus adapter; battery re-runs in < a day |
| 9 | Tone drift toward punishment in difficulty retunes | Safety-audit + guilt-vocabulary CI | Comedy-first laws in CI (R-CM-03, R-RT-08) | Revert to last green tag; re-audit |
| 10 | Income pressure vs funnel calendar (2–3 months [P-D]) | Bank-runway check (developer's own ledger) | Portfolio law: game #2, parallel portals, direct-traffic 100% tier, devlog/TikTok margin (Ch. 6) | Submit *now* if Final Gate ≥ 95 — never let polish compete with rent |

**The register's one-sentence summary:** every risk that survives this PRD has a tripwire, an owner, and a rehearsed response — which is the only honest definition of "zero chance of rejection" any submission can manufacture.

# PART V — APPENDICES

## Appendix A — The 100-Seat Panel Directory

*Every seat is a real person or canonical team, anchored to public doctrine (Appendix B). The "demand" column is this PRD's application of that doctrine to MAGNETOPE — traceable to the cited public source, not a private consultation. This directory is also the audit trail for the authorship claim (Ch. 29): it documents exactly where each design judgment came from.*

**Commission A — Game Direction (Ch. 11)**
| # | Seat | Known for | The demand made of MAGNETOPE |
|---|---|---|---|
| 1 | Shigeru Miyamoto | "Find the fun"; Nintendo's prototype-the-verb doctrine | The verb must delight stripped bare (R-GD-01) |
| 2 | Sid Meier | "A series of interesting decisions" | The charge must stay a live decision, never always-max (R-GD-03) |
| 3 | Jesse Schell | The Book of Lenses | Every screen justified by the player's goal (R-GD-03/UX-06) |
| 4 | Raph Koster | *Theory of Fun* — patterns learned safely | 70 levels = teach-then-test stories (R-LD-01) |
| 5 | Nicole Lazzaro | 4 Keys 2 Fun | All four funs inside session 0 (R-GD-04) |
| 6 | Jenova Chen | Flow (Csikszentmihalyi applied) | Ride the flow channel; re-teach at biome gates (R-GD-05) |
| 7 | Robin Hunicke | MDA framework | Name the aesthetic of every moment (R-SM-07) |
| 8 | Nolan Bushnell | "Easy to learn, difficult to master" | Easy in 10 s; difficulty after minute 3 (R-ON-04, R-LD-14/20) |
| 9 | Jesper Juul | *The Casual Revolution* | 90-second lovability; total interruptibility (R-GD-06) |
| 10 | Tracy Fullerton | Playcentric process | The funnel is the workshop — scheduled playtests (R-GD-08) |

**Commission B — Game Feel & Juice (Ch. 13)**
| 11 | Steve Swink | *Game Feel* — control/space/polish | Response before polish, always (R-GF-01/02) |
| 12 | Jonasson & Purho | *Juice It or Lose It* (2012) | No inert touch: everything reacts (R-GF-02/05) |
| 13 | Jan Willem Nijman | *The Art of Screenshake* | Impact = composition of small feedbacks (R-GF-01) |
| 14 | Thomas & Johnston | Disney's 12 principles | Anticipation & follow-through on the rig (R-GF-02) |
| 15 | Richard Williams | *The Animator's Survival Kit* | Weight lives in timing/spacing per material (R-GF-02) |
| 16 | Maddy Thorson | Celeste feel write-ups | Forgiveness windows ≤ 150 ms, shame-free assist (R-GF-03) |
| 17 | Derek Yu | Spelunky readability doctrine | Effects may never lie about physics (R-GF anti-pattern) |
| 18 | Bennett Foddy | *Getting Over It* failure aesthetics | Falls complete the comedy in three beats (R-GF-07) |
| 19 | Mark Brown | GMTK feel checklists | The Feel Bible, written and CI-enforced (R-GF-14) |
| 20 | Glen Keane | Line of action; appeal | The eye leads the flight; poses are drawn arcs (R-GF-01/02, R-CH-05) |

**Commission C — Level & Difficulty (Ch. 14)**
| 21 | Masahiro Sakurai | Readability; the screen is the manual | 5-second route read, text-free (R-LD-03/12) |
| 22 | Kim Swift | Portal's demonstrate→guide→exam | The Portal triple per twist (R-LD-02) |
| 23 | Marc LeBlanc | Feedback loops; kinds of fun | Failure must reward the retry (R-ON-10) |
| 24 | Ernest Adams | Drawn difficulty curves | Curve is data, drawn and tested (R-LD-16) |
| 25 | Scott Rogers | *Level Up!* clockwork anatomy | Establish → twist → escalate → resolve (R-LD-07) |
| 26 | Brenda Romero | "The mechanic is the message" | Zero filler; magnet-native sentences (R-LD-10) |
| 27 | Alexey Pajitnov | Elegance = minimal rules, maximal interplay | Ablation-driven elegance cuts (R-LD-11) |
| 28 | Tetsuya Mizuguchi | Synesthesia; Rez pacing | Score intensity follows the level histogram (R-LD-08) |
| 29 | Dan Cook | Skill atoms (*Chemistry of Game Design*) | The 70-level skill-atom table, gap-free (R-LD-01/09) |
| 30 | Zach Gage | Shower-thought solvability | Exams inferable from spawn sightlines (R-LD-13) |

**Commission D — Onboarding & Session (Ch. 15/25)**
| 31 | Amy Jo Kim | Game Thinking; habit loops | Session 0 ends invested (R-ON-12) |
| 32 | Nir Eyal | *Hooked* (ethical use only) | Variable delight + stored investment, zero dark patterns (R-RT-08) |
| 33 | Sebastian Deterding | Situated motivational design | The scene answers what/why/worth-it (R-ON-02) |
| 34 | Don Norman | Affordance; emotional design | Charge self-affords; instant feedback (R-ON-02/06) |
| 35 | Steve Krug | *Don't Make Me Think* | Zero think-moments in menus (R-UX-03) |
| 36 | Ken Wong | Monument Valley's instant beauty | The boot frame is a poster (R-ON-02, R-SM-02) |
| 37 | Jakob Nielsen | Usability heuristics | Status visible; control; one-input recovery (R-UX-04/05) |
| 38 | Alan Cooper | Personas; goal-directed design | Every beat passes the bus-teenager persona card (R-ON-* tests) |
| 39 | Julie Dirksen | *Design for How People Learn* | Chunked, spaced, scaffold-faded teaching (R-LD-14) |
| 40 | BJ Fogg | B=MAP; tiny prompts | The three-rung nudge ladder, then silence (R-ON-06) |

**Commission E — Packaging & CTR (Ch. 17)**
| 41 | Susan Kare | Icon craft; the small-size law | Design at 128 px first (R-TH-01) |
| 42 | Jimmy Donaldson | Thumbnail testing at scale | One emotion, forced-choice tested (R-TH-06/07) |
| 43 | Chip Kidd | Covers as promise + tease | Promise the launch, tease the tower (R-TH-01) |
| 44 | Saul Bass | One-symbol identity | The launch-arc as the game's symbol (R-TH-04/08) |
| 45 | Paul Rand | Simplicity = good idea's by-product | Three shapes, everything else support (R-TH-01) |
| 46 | Shepard Fairey | Readable at any distance | Contrast tuned for worst-case screens (R-TH-05) |
| 47 | Stefan Sagmeister | One committed twist | Exactly one surreal element (R-TH-01) |
| 48 | Kyle Cooper | Motion identity | The animated card is an ident, not a clip (R-TH-10) |
| 49 | Casey Neistat | Thumbnail tells the story | "Robot flying between magnets," unambiguous (R-TH-01) |
| 50 | Aaron Draplin | Loud, honest, thick-lined | The lockup passes the arm's-length test (R-TH-08) |

**Commission F — Art & Character (Ch. 18–19)**
| 51 | Josef Albers | *Interaction of Color* | Accents tuned per adjacency, never global (R-AR-02) |
| 52 | Johannes Itten | *The Art of Color* | One dominant contrast declared per scene (R-AR-03) |
| 53 | Bobby Chiu | Silhouette-first design | The plush test; filled-black separation (R-CH-01, R-AR-09) |
| 54 | Iain McCaig | Three shapes, three lines | Scene landmark discipline (R-AR-10) |
| 55 | Roger Deakins | One motivated light story | Light rigs declared per biome (R-AR-04) |
| 56 | Dice Tsutsumi | Color scripts | `COLOR_SCRIPT.md` across 70 levels (R-AR-05) |
| 57 | Wes Anderson | Committed palettes | 5 hues per biome; no hedge (R-AR-03) |
| 58 | Ian Hubert | Kitbash worldbuilding | Junk with provenance (R-AR-07) |
| 59 | Vitaly Bulgarov | Functional mechanical design | MAGNO's panels imply engineering truth (R-AR-08) |
| 60 | Simon Stålenhag | Narrative environments | Biome wear-passes tell unstated stories (R-AR-07, R-CH-08) |

**Commission G — Audio (Ch. 20)**
| 61 | Koji Kondo | Melody as identity | The five-note MAGNO motif everywhere (R-AU-01) |
| 62 | Winifred Phillips | Casual-loop scoring craft | 2–4-bar cells; rotation defeats repetition (R-AU-02) |
| 63 | Marty O'Donnell | Stinger grammar | ≤ 1.5 s musical words, never masked (R-AU-05) |
| 64 | Darren Korb | Stem-layered adaptive cues | 4 stems × 3 tiers (R-AU-02) |
| 65 | Austin Wintory | Through-composed arcs | The ending is one continuous cue (R-AU-12, R-SM-05) |
| 66 | Ben Prunty | Minimal stems, maximal feel | rest/play/flight tiers (R-AU-02) |
| 67 | Lena Raine | Leitmotif re-harmonization | Five biome treatments of one motif (R-AU-03) |
| 68 | Richard Devine | Modular performance | ±10% randomization kills machine-gunning (R-AU-10) |
| 69 | Diego Stocco | Found-object instruments | The junk orchestra: world = orchestra (R-AU-04) |
| 70 | Bob Katz | Mastering discipline | −14 LUFS, ≤ −1 dBTP, parity ≤ 1 LU (R-AU-08) |

**Commission H — UX & Touch (Ch. 21–22)**
| 71 | Luke Wroblewski | Mobile-first targets | 48 px floor; thumb-band primaries (R-UX-02) |
| 72 | Josh Clark | *Tapworthy* | Edges and bottom are prime estate (R-MO-05) |
| 73 | Ethan Marcotte | Responsive doctrine | Flow across the canonical trio + beyond (R-UX-01) |
| 74 | Sara Soueidan | Inclusive UI defaults | Visible focus; semantic controls (R-AC-07) |
| 75 | Jared Spool | Measured usability | Clicks-to-action instrumented (R-UX-12) |
| 76 | Bill Buxton | The human is the instrument | Multi-touch-first; palm tolerance (R-MO-08) |
| 77 | Paul Fitts | Fitts's law | Most-used = biggest, nearest (R-UX-02/07) |
| 78 | William E. Hick | Decision-time law | Menu choice budgets (R-UX-03) |
| 79 | Lea Verou | Pragmatic platform use | Standard signals over sniffers (R-UX-10) |
| 80 | Heydon Pickering | *Inclusive Components* | Focus-trapped modals; real toggles (R-UX-08) |

**Commission I — Performance (Ch. 23)**
| 81 | Yoav Weiss | Rendering-pipeline budgets | Known, counted critical path (R-PE-06) |
| 82 | Addy Osmani | Budgets at PR time | The budget table in CI (R-PE-01) |
| 83 | Paul Irish | rAF + profiling culture | One clock; profile before optimizing (Ch. 23 spine) |
| 84 | Paul Lewis | 16.67 ms; fast-path animation | Transform/opacity DOM only (R-PE-04) |
| 85 | Jake Archibald | Event-loop breathing room | Post-boot work scheduled, never racing input (R-PE-05) |
| 86 | Steve Souders | Frontend perf rules | Zero render-blocking extras (R-PE-05) |
| 87 | Patrick Meenan | Filmstrip truth | Frame-timing filmstrips each milestone (R-PE-06) |
| 88 | Surma | WASM/worker doctrine | Stream the sim; never scatter determinism (R-PE-07) |
| 89 | Sébastien Crozet | Rapier engine discipline | Body budgets; sleeping; zero step allocations (R-PE-09) |
| 90 | Alon Zakai | Emscripten/WASM streaming | Streaming instantiation forever; size = UX (R-PE-07) |

**Commission J — Economy, Analytics & Compliance (Ch. 24–26, 29)**
| 91 | Michail Katkoff | Deconstructor of Fun teardowns | Source/sink map + simulation (R-EC-02/11) |
| 92 | Nick Yee | Player motivation research | Three ladders for three motivations (R-EC-06) |
| 93 | Richard Bartle | Player types | Achiever/explorer/socializer served; nothing for "killers" (R-EC-06) |
| 94 | Gabe Zichermann | Reward scheduling | Fixed + variable + collection schedules (R-EC-05/07) |
| 95 | Greg Costikyan | Economies are decision spaces | Price tiers force real choices (R-EC-03) |
| 96 | John Hopson | Behavioral game design | Rewards on the behavior clock (R-EC-04, Ch. 26 telemetry) |
| 97 | Avinash Kaushik | *Web Analytics 2.0* | Segments/funnels; every KPI arms a decision (R-AN-05/09) |
| 98 | Alistair Croll | *Lean Analytics* | One Metric That Matters per stage (R-AN-05) |
| 99 | Lorrie Faith Cranor | Privacy by design | The closed-world law (R-CM-01, R-AN-03) |
| 100 | danah boyd | Youth online-safety research | The social surface stays closed (R-CM-06) |

---

## Appendix B — Research Bibliography

**Poki platform law (all read October 2026, developers.poki.com):** Requirements · What we look for · Game thumbnail · How testing works · Interpreting your test results · Web fit test · Player fit test · Playtesting · Final review · Release process · Monetization overview + Monetization tips · SDK overview & events · PokiSDK: HTML5 · Easy access & onboarding · Engagement · Localization · Content & player safety · External resources policy · Player device report · Your game page · Glossary. Plus: poki.com blog, "What makes a high-quality browser game?"; Poki developer-rel interviews (Indie Game Business podcast, 2026); Blumgi, "My journey on the web — 100M players" (Poki/Medium, 2023); Stickman Hook title page & catalog data (poki.com).

**Books & canonical talks (as publicly documented):** Swink, *Game Feel* (2008) · Jonasson & Purho, *Juice It or Lose It* (2012) · Nijman, *The Art of Screenshake* (2013) · Thomas & Johnston, *The Illusion of Life* (1981) · Williams, *The Animator's Survival Kit* (2001) · Keane masterclasses · Thorson, Celeste design notes · Yu, Spelunky design essays · Foddy, failure-aesthetics talks · Brown, Game Maker's Toolkit feel episodes · Koster, *Theory of Fun* (2005) · Schell, *The Art of Game Design* (2008) · Lazzaro, *4 Keys 2 Fun* (2004) · Csikszentmihalyi, *Flow* (1990) · Chen, *Flow* (2006) · Hunicke/LeBlanc/Zubek, *MDA* (2004) · Juul, *The Casual Revolution* (2010) · Fullerton, *Game Design Workshop* · Meier, memoir (2020) · Kim, *Game Thinking* (2018) · Eyal, *Hooked* (2014) · Deterding, gameful-design lectures · Norman, *The Design of Everyday Things* (1988) / *Emotional Design* (2004) · Krug, *Don't Make Me Think* (2000) · Nielsen's heuristics (1994) · Cooper, *About Face* · Dirksen, *Design for How People Learn* (2011) · Fogg, behavior-model work (2003–2019) · Wong, Monument Valley talks · Kare, icon-design essays · Kidd, *Go* + TED (2012) · Bass poster oeuvre · Rand, *A Designer's Art* (1985) · Fairey/Sagmeister/Cooper(DC)/Draplin/Neistat documented praxis · Albers, *Interaction of Color* (1963) · Itten, *The Art of Color* (1961) · Chiu/McCaig/Deakins/Tsutsumi/Hubert/Bulgarov/Stålenhag documented teaching & works · Kondo interviews · Phillips, *A Composer's Guide to Game Music* (2014) + GDC talks · O'Donnell GDC talks · Korb stem-method talks · Wintory Journey talks · Prunty/Raine documented method notes · Devine modular practice · Stocco found-sound talks · Katz, *Mastering Audio* (2007) · Wroblewski, *Mobile First* (2011) · Clark, *Tapworthy* (2010) · Marcotte, *Responsive Web Design* (2010) · Soueidan inclusive-UI articles · Spool UIE research · Buxton, *Sketching User Experiences* (2007) · Fitts (1954) · Hick & Hyman (1952) · Verou, *CSS Secrets* (2015) · Pickering, *Inclusive Components* (2019) · Lewis, *High-Performance Animations* (2012) · Archibald event-loop articles · Souders, *High Performance Web Sites* (2007) · Meenan/WebPageTest · Surma workers/WASM talks · Crozet, Rapier documentation · Zakai, asm.js/Emscripten papers & talks · Katkoff, Deconstructor of Fun · Yee, Quantic Foundry motivation research · Bartle, *Hearts, Clubs, Diamonds, Spades* (1996) · Zichermann, *Gamification by Design* (2011) · Costikyan, *I Have No Words & I Must Design* (1994) · Hopson, *Behavioral Game Design* (Gamasutra, 2001) · Kaushik, *Web Analytics 2.0* (2009) · Croll & Yoskovitz, *Lean Analytics* (2013) · Cranor privacy-research corpus · boyd, *It's Complicated* (2014).

**Prior QA evidence (this project, October 21, 2026):** the live review session — production `build:poki`, Chromium at 1031×580 + Pixel 7 profiles, Poki SDK live-logging, 27 screenshots, 0 page errors — recorded in `download/MAGNETOPE_Poki_Review.pdf` [QA].

---

## Appendix C — Glossary

**CTR** — click-through rate: share of players who click the card. **C2P** — conversion to play: share who reach the first `gameplayStart()` [P-D]. **Web fit** — ~10,000-player category-page test of CTR / time-on-page / C2P, scored 0–5 vs category average [P-D]. **Player fit** — 500-player playtime test (healthy: 3+ min, 25% over 3 min) [P-D]. **Playtest** — 10 recorded strangers; free, unlimited [P-D]. **Soft release** — live category pages before global [P-D]. **SdkBus** — the repo's state machine that makes SDK violations unreachable [S]. **AUDS** — Poki's arbitrary user data store (ghost records) [P-D]. **Route** — a bot-solved input sequence per level, replayed in tests [S]. **Par ghost** — developer-pace ghost; **personal ghost** — your own best; **friend/regional ghosts** — exchanged/AUDS ghosts [S]. **Fall rate** — % of level entries ending in a fall; the difficulty metric [S]. **Twist** — a level's one new idea (prop/mechanic recombination) [S]. **Skill atom** — action→simulation→feedback→modeling learning unit (Cook) [R]. **Frozen-frame test** — a paused frame must communicate state (velocity/polarity/charge/target) [T]. **Junk orchestra** — score + SFX share one material-voice instrument table (Stocco) [T]. **Dangle** — the visible next-goal teaser on the clear card (Stickman-Hook lineage) [R]. **Guilt vocabulary** — streak/decay/FOMO patterns, banned (R-RT-08). **Quality tier** — device-tier render profile; watchdog downgrades at state boundaries [S/T]. **Doc-drift** — CI test that code and spec docs cannot disagree [T]. **Final Gate** — the 100-point submission audit (Ch. 35). **OMTM** — one metric that matters per stage (Croll) [R].

---

## Appendix D — Conflict Resolution & the Law of Precedence

When requirements collide, the **earlier chapter wins** (Rule 11). The decided cases, in writing:

| Collision | Resolution | Where codified |
|---|---|---|
| Monetization vs onboarding | No break of any kind before the first input; first break ≥ 60 s | R-MZ-03, R-ON-01 |
| Juice vs determinism | Charisma is rig-layer only; the sim never lies | R-CH-10, R-GF anti-patterns |
| Juice vs accessibility | Reduced-motion trims presentation; sim timing never changes | R-UX-10, R-AC-02 |
| Localization vs gameplay | Wordless gameplay wins; locales live in menus | R-LO-02 |
| CTR temptation vs honesty | "Show what's inside" [P-D] is law; no mystery-box cards | R-TH anti-patterns |
| Retention vs ethics | No guilt systems, ever | R-RT-08, Ch. 4.3 |
| Performance vs spectacle | Budget lines first; no effect ships without one | R-PE-01/10 |
| Funnel speed vs polish | Final Gate ≥ 95 then submit; the funnel is the last 5% | Ch. 34.3, Risk 10 |
| Expert taste vs Poki law | [P-D] outranks the panel, always | Ch. 0 protocol |

**Requirement count, reconciled:** this PRD binds **234 numbered requirements** across 21 domains (GD 8 · CL 10 · GF 14 · LD 22 · ON 12 · SM 8 · TH 10 · AR 12 · CH 10 · AU 12 · UX 12 · MO 8 · PE 14 · MZ 13 · EC 12 · RT 12 · AN 10 · LO 8 · AC 10 · CM 6 · QA 11), audited into 100 Final-Gate points (Ch. 35). Every ID is testable; every test is CI; every CI run is a submission rehearsal.

**Closing note to the AI builder:** if you are reading this line, you have the whole contract. Take W1 first. Leave the spine untouched. Ship evidence, not promises. And when the robot with a magnet for a head finally flies across a stranger's phone screen, do not add anything — get out of the way of the launch.

