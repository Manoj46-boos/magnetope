# MAGNETOPE — THE PREMIUM REBUILD PRD
## Encyclopedia Edition · Operation Zero-Reject

**Document class:** Product Requirements Document — rebuild program
**Product:** MAGNETOPE (magnetic slingshot platformer, TypeScript + Three.js + Rapier, 70 levels)
**Target platform:** Poki.com (primary), open web
**Version:** 2.0 — Premium
**Supersedes:** `MAGNETOPE_PRD.pdf` (v1) as the governing product document; v1 remains the historical record of build 1
**Status:** READY FOR AI-DRIVEN EXECUTION

---

## 0.1 What this document is

This is the rebuild brief that takes MAGNETOPE from *"technically immaculate, commercially unproven, visually generic"* to *"the most defensible submission Poki's review team sees that quarter."*

It was produced by:

1. **Playing the game as Poki's QA would** — a full instrumented session on the production build (desktop, mobile landscape, mobile portrait), with every finding photographed and logged.
2. **Deep research across 14 professional domains** — platform policy, thumbnail/CTR science, first-time-user-experience, game feel, art direction, audio, level design, mobile ergonomics, performance engineering, ad monetization, retention, analytics, child safety, and submission operations. Every domain is grounded in the published work of the strongest practitioners and researchers in that field — the full list is Appendix B, **The Faculty: 100 sources**.
3. **Grounding in the actual codebase** — every requirement names the real file, module, and constant it changes (`src/render/thumbnail-scene.ts`, `src/platform/ad-placement.ts`, `src/config/onramp.ts`, `src/render/stage.ts`, and so on). Nothing here is generic advice; everything is a surgical instruction.

The document is written to be executed by an AI developer agent with the repository open. Each requirement carries: **the change, the reason (with source), the acceptance criterion, and the verification method** (unit test, browser test, panel, or instrumented metric).

---

## 0.2 The honest truth about "100% acceptance" — read this first

You asked for zero rejection chance. Here is the professional answer, and it matters:

**No document, no consultant, and no amount of engineering can *guarantee* acceptance, because two votes in Poki's pipeline belong to strangers: the click vote (does a kid stop on your thumbnail?) and the minute vote (does that kid play for five minutes?).** Those votes are cast by real players in the player fit test and web fit test, and they are the only votes that count on exactly the two criteria where the current build is weakest.

What CAN be engineered — and what this PRD engineers — is **zero controllable rejection vectors**:

- Every hard requirement in Poki's published checklist: **green, with evidence** (one — internal ad timers — is currently *violated* by the codebase and is fixed in Volume IX).
- Every quality criterion Poki's reviewers name (quality, player fit, tech, originality, depth, first impression, cross-device, room to grow): **attacked with a dedicated volume, a spec, and a measurable gate**.
- Every weakness found in the live QA session: **converted into a requirement with an acceptance test**.
- The two stranger-votes: **de-risked to the maximum degree knowable in advance** — the thumbnail spec in Volume I was *empirically validated* (concept renders scored 9/10 in the 128-pixel scroll test versus 3/10 for the current card; see §1.10), and the FTUE spec in Volume II is built around Poki's own published session-0 doctrine.

That is the real meaning of "so premium they can't reject it": **remove every reason to say no that is within your power to remove, then buy confidence for the rest with evidence.** This PRD is that program, volume by volume.

---

## 0.3 The evidence baseline — where the game stands today

Independent QA session on the production build (`npm run build`, served locally), October 2026. All screenshots preserved in `download/poki-qa-01..28*.png`.

| # | Finding | Evidence | Severity |
|---|---------|----------|----------|
| F-01 | Thumbnail fails the scroll test — robot ~15% of frame, no face/emotion, muted palette | VLM review vs Poki's own thumbnail guide: **3/10 CTR appeal** | **CRITICAL** — kills the funnel at its first gate |
| F-02 | Mobile portrait reads at ~8–10% robot-to-width with large dead bands | Instrumented session on iPhone 14 viewport: **4/10** | **CRITICAL** — Poki hard requirement: "cover the full screen in portrait or landscape, or both" |
| F-03 | No first level clear in ~90 seconds of naive QA play; snap/launch learning curve too steep for a 9-year-old's patience | Live session log; repo's own planner confirms first two levels are not one-thumb clearable | **HIGH** — first-clear conversion is the M3 gate |
| F-04 | Claimed live demo page is dead — `https://manoj46-boos.github.io/magnetope/` returns "Site not found"; `gh-pages` branch does not exist; `scripts/deploy-pages.mjs` was never run | `git ls-remote --heads origin` → only `main` | **HIGH** — dossier credibility; Poki runbook leg 8 |
| F-05 | 71/71 level verdict rows empty — no human has played the campaign end-to-end, including the developer | `docs/VERDICTS.md` | **HIGH** — "fun" is unvalidated; Volume VI protocol |
| F-06 | Internal ad-frequency timers (`breakFloorMs`, `retryFloorMs`) in `ad-placement.ts` conflict with Poki's "do not implement internal ad timers, rely on Poki's system" | Code review vs `developers.poki.com/guide/requirements-quality` | **HIGH** — compliance risk + revenue left on the table |
| F-07 | Opener cinematic swallows keyboard input before Skip is clicked | Live session: Space dead during opener | MEDIUM |
| F-08 | Engineering is genuinely elite: 2,499 passing behavioral tests, 1.50 MB gzipped initial payload, zero console errors across all sessions, deterministic 60 Hz sim, guarded SDK adapter | `vitest run` 105 files/2,499 tests in 125 s; build audit; error logs | **STRENGTH — keep and lead with it** |
| F-09 | Pause menu design scores 9/10 (glassmorphism, clean hierarchy) | VLM review | STRENGTH |
| F-10 | Mobile landscape experience competent: 8/10 | Instrumented session | STRENGTH |

**Current overall verdict as if submitted today: 5.5/10 — "iterate and resubmit." Target after this program: 9+/10 with every gate green.**

---

## 0.4 How to use this document with AI builders

This PRD is the contract between you (the director) and any AI agent (the builder). Rules of engagement:

1. **Execute volumes in priority order**: I (Thumbnail) → VII (Portrait) → II (FTUE) → IX (Monetization compliance) → XIII (Live page) → then the craft volumes (III, IV, V, VI) → then VIII, X, XI, XII → XIV is the final audit.
2. **One requirement at a time, test-first.** The repo's discipline (2,499 behavioral tests, byte-stable generated docs) is its crown jewel. Every change lands with a test that pins it. If a change cannot be pinned by a test, it gets a panel protocol instead (Appendix D).
3. **Requirement IDs (`P-XX-nn`) are the build's spine.** Cite them in commits, in the dossier, and in the final gate scorecard.
4. **Do not trust, verify.** Where a requirement says "verified by panel of N humans," that leg is yours — the developer's — and cannot be delegated. The submission-day runbook (Volume XIII) is sequenced so the human legs are batched into one sitting each.
5. **The repository's existing requirement IDs (R-…) remain valid history.** This PRD's `P-…` requirements extend and, where they conflict (exactly one case: internal ad timers), supersede them.

---

## 0.5 Methodology and source discipline

Every claim in this document belongs to one of three classes, marked inline:

- **[S]** *Sourced* — drawn from a fetched, read document (Poki's developer guide pages, platform research, vendor studies). The source is named in Appendix B.
- **[C]** *Canonical* — established literature, cited by title/author/year in Appendix B (books, peer-reviewed papers, standards).
- **[Q]** *QA-verified* — produced by the instrumented play session on this exact build (Appendix D).

Numbers without one of those three marks do not appear in this document. Where a benchmark is directional rather than exact (for example, mobile ad eCPMs applied to web inventory), the text says so explicitly. This discipline is what makes the document safe to build against — and what makes the dossier you eventually submit to Poki credible rather than aspirational.

---

---

# VOLUME 0 — THE ACCEPTANCE MACHINE
## How Poki actually decides, gate by gate, number by number

> *"Poki is a highly curated platform, and we decide which games to feature."* — Poki Requirements & Quality Guidelines [S]

You cannot beat a review process you have not memorized. This volume is the machine, disassembled. Every later volume exists to pass one of these gates.

---

## 0.6 The five-stage pipeline [S]

`developers.poki.com/guide/how-testing-works`, verified against the live documentation:

| Stage | What happens | Duration | Your gate |
|---|---|---|---|
| 1. Add your game | Upload a web build (prototype acceptable). Passes **content moderation** first | Minutes–hours | Build runs, content is clean (Volume XII) |
| 2. Playtesting | **10 recordings of real Poki players** playing your game; watchable repeatedly; first results often within minutes–hours | Hours | Watch all 10, twice; log confusions (Volume XIII) |
| 3. Player fit test | **500 real players** try the game. Measures **playtime only** (conversion comes later). Requires a thumbnail. Repeatable, ≤2 tests/day | ~5 hours per test | **≥3 min average playtime and ≥25% of plays over 3 minutes** — the "healthy" line |
| 4. Web fit test | Game appears on **real category pages** like a released game. Measures **CTR, time on page, conversion to play (C2P)** against category averages. Repeatable | ~7 days (longer when busy) | CTR and C2P at or above category average |
| 5. Final review | **The Poki team reviews results and plays the game itself** — quality, originality, fit within categories | 1–2 weeks | Green-light → agreement → release |
| Post | Legal → QA → Soft Release → Global Release | ~2–3 months total | Ship cadence (Volume X) |

**Published benchmarks [S]:** healthy conversion to play is **65%+** (average game on Poki: ~70%); recommended average playtime before requesting review is **5+ minutes** (10+ for management/simulation; average game: ~6+). Poki's own language: *"treat these numbers as a floor, not a finish line."*

**A real rejection, on the record [S]:** an indie developer documented a Poki rejection at **1 minute 12 seconds average playtime against the 3-minute line** — iterate, retest, resubmit (reitgames.com, "Test Your Game Early"). The machine is honest: it will tell you exactly which number failed. The premium strategy is to arrive with every number already above the line.

---

## 0.7 The eight judgment criteria [S]

From `developers.poki.com/guide/what-we-look-for` — with the volume of this PRD that answers each:

| # | Poki's criterion | What they mean | Answered by |
|---|---|---|---|
| 1 | **Quality** | UX/feel and the core loop; "fun and interesting" | Volumes II, III, VI |
| 2 | **Player fit** | Would *their* players — global, majority mobile, young-skewing casual — enjoy it | Volumes I, II, VII |
| 3 | **Tech** | Fast load, stable frame rate, lean file size, mobile + desktop optimization | Volume VIII (+ existing test suite: 2,499 tests [Q]) |
| 4 | **Originality** | Fresh mechanics; *"clones of existing hits won't be promoted"* | Polarity-flip sling is a genuine differentiator; Volume IV makes it *visually* ownable |
| 5 | **Depth & replayability** | A loop that opens up over time; holds attention past the first clever idea | Volumes VI, X (stars, par ghosts, ghost exchange, Friday drops) |
| 6 | **First impression** | *"Players decide in seconds"* — thumbnail + immediate playable opening | Volumes I, II |
| 7 | **Cross-device feel** | Thumb and mouse both first-class; majority-mobile audience | Volume VII |
| 8 | **Room to grow together** | Content hooks and systems that support updates; a roadmap shared at submission | Volume X |

Poki's own note: these are weighed together, and exceptional on one dimension can offset another. The premium program does not rely on offsets.

---

## 0.8 The hard requirements checklist [S]

`developers.poki.com/guide/requirements-quality`, "Before your game can go live, our QA team checks it against the requirements below." Status is the current build's [Q]:

| Requirement | Poki's rule | Current status | Fixed in |
|---|---|---|---|
| Devices | Desktop, mobile, tablet; **cover the full screen in portrait or landscape, or both**; force mobile control schemes on tablets | Portrait fails the read test (F-02) | Vol VII |
| Aspect | 16:9 canvas coverage; scale proportionally (640×360 / 836×470 / 1031×580) | Pass [Q] | — |
| Incognito | localStorage wrapped in try/catch; game stays playable | Pass (tested) | — |
| External requests | **None** — bundle fonts, assets, libs | Pass (0 external) | — |
| Branding/ads | No splash screens, no outgoing links, no third-party ad systems | Pass | — |
| Ad-block | Must stay fully playable with an ad blocker; no custom messaging | Pass (adblock suite) | — |
| SDK events | No double-fires; `gameplayStart()` on **first input, not load**; `gameplayStop()` on **every interruption**; **no events during ads**; `commercialBreak()` **only when exiting pause into gameplay** | Pass (10,000-input trace) | — |
| Clean build | No dev tools, debug code, test artifacts | Pass (build audit) | — |
| Save system | Save where appropriate or inform clearly | Pass | — |
| File size | *"Players tend to move to another game if loading takes more than 10 seconds"*; keep initial download small, progressive loading | 1.50 MB gzipped, ~1.3 s desktop [Q] | Vol VIII |
| Thumbnails | **Both static and animated required for global release** | Present but failing the scroll test (F-01) | Vol I |
| Page integration | Game viewport scrolling must not affect parent page | Pass | — |
| Mobile controls | **Automatically force mobile control schemes on tablets** | Pass (`device.ts` forces touch on tablets) | — |
| Streamlined entry | *"Minimize UI screens and menus, ideally placing players directly into gameplay"* | Opener swallows input (F-07) | Vol II |
| Keyboard | ESC or spacebar pause/resume with correct SDK events | Pass (Escape tested) | — |
| Cutscenes | All skippable | Pass | — |
| Tutorials | *"Visual and intuitive rather than text-heavy"* | Partial — first-clear too hard (F-03) | Vol II |
| Ad breaks | `commercialBreak()` / `rewardedBreak()` integrated correctly | **VIOLATION: internal ad timers** (F-06) | **Vol IX** |
| Ad audio | Mute game audio during ad playback | Pass (bus ducks) | — |
| Ad timing | *"Do not implement internal ad timers, rely on Poki's system to manage ad frequency"* | **VIOLATION: `breakFloorMs` / `retryFloorMs` floors** (F-06) | **Vol IX** |
| Rewarded UI hierarchy | Standard continue button always present, equal or **larger** than the rewarded button, adjacent, **never green**, prominent 🎬 icons, simultaneous display | Partial | Vol IX |
| Reward rules | One video per reward; confirmation feedback; auto-apply rewards; no double-rewarding; ad-block → no reward, silent | Mostly pass | Vol IX |
| Localization | Recommended for text-heavy games; layouts adapt to longer strings | 7 locales shipped; native review owed | Vol XII |
| No IAP / no dual currency | Single currency only; *"grind is one of the fastest ways to lose a web player"* | Pass (single Scrap currency) | — |

**One hard-requirement violation is a stopped submission. The codebase carries exactly one (ad timers). Volume IX removes it and, in the same motion, recovers the revenue the timers were suppressing.**

---

## 0.9 The economics of the machine [S]

From `developers.poki.com/guide/revenue-deal-types`:

- **Web-exclusive deal (their preference):** game published on the open web only via Poki (browser, Discord, YouTube Playables count as web); default **5-year term**; Steam/app stores/consoles remain yours. In return: marketing and promotion to 100M+ monthly players, top-tier ad partners and brand deals, **50/50 revenue share on players Poki brings** (promotions, recommendations, marketing). **Everything a player generates arriving directly — search, bookmarks, social, your community — is 100% yours.**
- **Non-exclusive:** for games already live on other web portals or niche/short-term fits — a one-time flat license fee, no revenue share, no marketing investment.
- **The strategic implication for MAGNETOPE:** this is an exclusive-shaped game. Nothing about it exists elsewhere on the web; its systems (ghost exchange, Friday drops) are built for a long exclusive arc. Volume X's live-ops plan is written to make the exclusivity *cheap for Poki to say yes to* — a game that visibly prints retention is a game they promote.

**Directional revenue reality (no promises, only arithmetic):** ad revenue is a function of engaged minutes × ad density × eCPM. Web-portal eCPMs are materially lower than the ~$24 mobile-mediated rewarded eCPMs quoted in vendor research [S: Coinis, 2026] — but Poki's contribution is *scale*: "more than 5 million monthly players per high-performing game" [S: developers.poki.com]. A disciplined reading: a first accepted game from an unknown developer should be planned as a **audience- and craft-building asset with modest first-year revenue**, with upside concentrated in (a) running the live-ops cadence, (b) the 100%-yours direct traffic, and (c) game #2 shipping faster because game #1 built the machine. That is the honest business plan this PRD serves.

---

## 0.10 The funnel, as arithmetic

The machine is a leaky funnel; the premium program plugs the leaks in order:

```
Impression  ──CTR──▶  Game page  ──C2P──▶  Play  ──session-0──▶  Minutes  ──loop──▶  Return
   ▲                      ▲                    ▲                    ▲                 ▲
 Vol I                 Vol I + II            Vol II              Vol II/X           Vol X
 (thumbnail)          (load law, opener)   (first clear ≤45 s)  (3-min loops)    (ghost codes,
                                                                            Friday drops)
```

Poki's own engagement doctrine [S]: **web players have shorter sessions and return less often than mobile players; the first session (session 0) carries most weight; quick, satisfying, repeatable loops of ~3 minutes perform best; about one hour of content is usually the right scope.** MAGNETOPE's 70 levels × 30–90 s = 35–105 minutes of content — squarely in scope. The fight is entirely in session 0, and that is why Volume II is written the way it is.

---

## Volume 0 requirements — the machine's contract

| ID | Requirement | Acceptance criterion | Verification |
|---|---|---|---|
| **P-AM-01** | Treat every Poki-published number as a floor, not a target: C2P ≥ **75%** (floor 65%), average playtime ≥ **7 min** (floor 5), first-clear conversion ≥ **85%** | All three hold in the final player fit test before final review is requested | Poki dashboard, device-split |
| **P-AM-02** | No hard-requirement violation ships, ever | The Volume 0 checklist table reads green end-to-end on submission day | Submission-day runbook re-audit (Vol XIII) |
| **P-AM-03** | The five-stage pipeline is walked in order; no stage is skipped or rushed | Playtest videos watched ×2 before player fit test; player fit test passing before web fit test; web fit test before final review request | Runbook log |
| **P-AM-04** | Every metric regression sends the game back one stage, not forward | If any player fit test regresses below 3 min average, the next action is a fix + retest, never a review request | Runbook log |
| **P-AM-05** | The exclusivity decision is made deliberately, with the contract read | Developer reads the full agreement before signing; web-exclusive is the default posture this PRD assumes | Dossier §7 item 6 |

---

---

# VOLUME I — THE THUMBNAIL CODEX
## The single highest-leverage artifact in the entire program

> *"Your game thumbnail is the single most important factor for click-through rate on Poki."* — Poki Game Thumbnail guide [S]

This volume has one job: replace three muted, small-subject, emotionless cards with a family of cards engineered to win the scroll war. The spec below was **empirically validated before being written** — concept renders built to this spec scored **9/10 in the 128-pixel scroll test against 3/10 for the current hero card** (§1.10, Appendix D). You are not being asked to trust taste; you are being asked to reproduce a validated target.

---

## 1.1 The science of the half-second decision

**Netflix [S/C].** The most-studied artwork-choosing population on earth. Netflix's published artwork work (Tech Blog, "Artwork Personalization in Netflix Recommendations," 2017; covered by Fast Company, Dec 2017) established the economics: a browsing member spends on the order of **two seconds or less per title**, and within that glance **artwork dominates the choice** — which is why Netflix personalizes imagery per member and reports that the recommendation system overall influences ~80% of streamed hours (Gomez-Uribe & Hunt, *The Netflix Recommender System*, ACM TMIS 2015 [C]). Their art-direction findings transfer directly to game tiles: **expressive faces outperform neutral ones; complex/ambiguous emotional expressions outperform stoic ones; polarizing "villain" imagery outperforms bland hero imagery; a single clear focal subject outperforms collages.**

**YouTube [S].** The platform's own creator guidance and thumbnail-CTR analyses (Creator Academy; practitioner studies 2023–2026) converge on the same shortlist: **≤3 visual elements, one dominant subject, high luminance/saturation contrast, exaggerated facial expression, motion implied by pose and motion lines, no text** (or text as a tertiary element). Thumbnails are consumed in ~200 ms against a wall of competing tiles — the same exact condition as Poki's grid.

**Game-icon research [S].** *How Character-Centric Game Icon Design Affects the Perception of Gameplay* (Cao et al., *Applied Sciences* 11(21):9911, MDPI, 2021) evaluated character-centric icons across game categories and found perceptual quality scores driven by **character prominence, expression, and visual clarity — not scene detail**. Industry corroboration: CrazyLabs' icon guidance (one object, 1–2 dominant colors, strong contrast, iconic and scalable) [S]; and UX Planet's compilation of **10 documented case studies where icon redesign alone measurably increased downloads** [S].

**Poki's own rules [S]** (the binding ones — `developers.poki.com/guide/game-thumbnail`):
1. **Show what's inside** — the thumbnail is a store window; mismatch kills conversion *and* playtime.
2. **Embrace simplicity** — one clear foreground object, not a collage; clarity beats complexity.
3. **Give it motion** — a stiff pose is scrolled past; suggest movement.
4. **Keep a series together** — the three cards must read as one family.
5. **Design for small tiles** — detail turns to mush; check large *and* small.
6. **Avoid text** — *"Poki's own tests show players prefer text-free thumbnails: visuals alone drive better performance."*
7. **Mind color and contrast** — the Poki playground background is **#83FFE7**; avoid colors close to it or the tile disappears *into the page*.
8. **Full-bleed square ≥628×628** — no borders, padding, letterboxing; corners are rounded by Poki.

---

## 1.2 Diagnosis: why the current cards lose [Q]

Instrumented VLM review of `thumbnails/static/thumbnail-hero-628.png` against Poki's eight rules and the research above:

| Dimension | Current card | Verdict |
|---|---|---|
| Subject prominence | MAGNO ≈ **15%** of frame, lower-left; a large beige prop owns the center | Fail (research floor: character fills 45–70%) |
| Emotion | No readable expression; the eye is a neutral dot at card size | Fail (Netflix/YT: expression is the hook) |
| Danger / consequence | None — a robot near a box | Fail (top tiles show the *consequence*: falling, crashing, mid-peril) |
| Palette | Muted beige-orange, low saturation | Fail (grid competitors: neon, high-saturation) |
| Motion | Static isometric pose | Partial |
| Text | None | Pass |
| Mint collision | None near #83FFE7 | Pass |
| Series consistency | Consistent family style | Pass (keep this) |

Overall CTR appeal: **3/10.** The frame reads as *"a screenshot luck produced"* — precisely the failure mode the codebase's own `thumbnail-scene.ts` header says the card must never be. The architecture is right; the *shot* is wrong. Nothing else in this document changes the funnel's first number as much as fixing this one file's numbers.

---

## 1.3 The Twelve Laws of the Click

The research above compresses into twelve laws. Every card must obey all twelve; the audits in §1.9 enforce them mechanically where possible.

1. **The 50% Law.** The protagonist occupies 45–60% of card height. A face/eye the viewer can *read* at 128 px is the entire game.
2. **The Emotion Law.** One exaggerated, unambiguous expression — panic, glee, shock — outperforming any neutral render. The eye does the work: dilated pupil, raised lid, agape mouth.
3. **The Consequence Law.** Show the moment of peril: falling junk below, a gap, a mid-air miss. The viewer's brain completes the story ("what happens next?") — that completion *is* the click.
4. **The Vector Law.** One strong diagonal (launch trajectory) crossing the frame; the subject sits at a thirds intersection, motion implied along the vector.
5. **The Three-Element Law.** Subject + one danger layer + one destination hint. Nothing else survives downscale anyway.
6. **The Saturation Law.** Punchy, high-saturation complementary palette — but **engineered, not garish**: one warm key, one cool sky, one energy accent.
7. **The Contrast Law.** Subject/background luminance contrast ≥ 3:1; the subject's immediate backdrop is the *darkest* or *most complementary* band in the frame, never mid-gray.
8. **The Mint Law.** No pixel within ΔE 10 of Poki's #83FFE7 playground background — and bias cyans toward *blue* so the tile can never blend into the page.
9. **The No-Text Law.** Zero glyphs at OCR confidence 65+ (existing audit keeps this).
10. **The 128px Law.** The card is *designed at 128 px first*, then confirmed at 628. If the story (who + what + peril) is not readable at 128, the composition is wrong, not the resolution.
11. **The Family Law.** All cards share sky grade, palette family, rim treatment, and character pose language — a series a player recognizes from the corner of the eye.
12. **The Truth Law.** The card shows the real game's world, rig, and props (the codebase's own law — the card renders through `thumbnail-scene.ts`, never a separate pipeline). *Store window ≠ store fiction:* exaggerated pose, honest world.

---

---

## 1.4 SPEC: HERO-A — "The Panic Launch" (the primary card)

*The one that has to win the grid. A tiny robot, one enormous panicked eye, launched like a slingshot shot, with the world's junk falling into the dark below him.*

### 1.4.1 Shot specification

| Parameter | Value | Why |
|---|---|---|
| Variant id | `panic-launch` (new member of `ThumbnailVariant`) | |
| Dressing level | `scrapyard-01` (real level; the card never invents a world) | Truth Law |
| Framing: `visibleHeight` | **4.2 m** (close-up; current hero ≈ 8.6 m class) | The 50% Law: MAGNO (~0.9 m + field rings) fills ~48% of frame height |
| Subject center (UV) | **(0.38, 0.62)** — lower-left thirds intersection | Vector Law: launch reads bottom-left → top-right |
| `subjectMargin` | **1.05 m** (subject box ≈ 50% of card height) | Drives the existing `thumbnailSubjectBox()` audits |
| Launch vector | **38° above horizontal**, toward upper-right | Canonical "up-and-to-the-right" optimism diagonal |
| Camera | Low angle, **12° below horizon looking up**; Dutch roll **6°** | Scale + motion; matches the existing card language |
| Pose | `airborne`, `polarity: repel`, arms windmilled, body leaned −18° into travel | Give it motion (Poki rule 3) |
| Destination hint | Upper-right corner: one steel beam end catching a **#FFD32A glint** (the snap target) | Consequence Law — where he's *going* completes the story |
| Danger layer | Bottom **20%** of frame: near-navy gap wedge (#0E1320) + **3 tumbling props** (fridge, bicycle, TV) with motion streaks, depth-fogged | Consequence Law — what's *below* him |
| Motion | 3 speed-lines behind (lower-left), field-line arcs around the magnet head | Vector Law |

### 1.4.2 The eye specification (the most important 20 pixels in the game)

The single eye is MAGNO's face, brand, and emotion engine. On this card it is engineered, not incidental:

- Eye ring diameter = **34% of head width** (up from ambient ~26%) — oversized on purpose.
- **Pupil dilated to 22% of eye diameter, offset 15% toward the destination** (looking where he's flying — gaze direction sells the vector even at 128 px).
- Lid raised: surprise posture, rendered as a **10° lid-rotation**, eye-white luminance ≥ 0.90.
- Mouth: agape "O" at 60% of eye diameter, dark fill — the panic read is two-shape simple (wide eye + open mouth), which is exactly what survives downscale.
- Specular highlight: one 2-px bright dot at 10 o'clock on the eye.
- **At 128 px, the eye must occupy ≥ 12 px of tile width (≈9%)** — this is an auditable number, not a vibe.

### 1.4.3 Palette specification (saturated, engineered, mint-proof)

| Role | Hex | Notes |
|---|---|---|
| Sky zenith | `#1B2A4A` deep indigo | Darkest band frames the white body → Contrast Law |
| Sky mid | `#17B8E6` **blue-biased** electric cyan | Biased away from mint (#83FFE7); ΔE-audited |
| Horizon glow | `#FF4757` hot coral | Complementary punch against cyan/indigo |
| Energy accent (rings, glint, streaks) | `#FFD32A` saturated amber-yellow | Single accent family |
| MAGNO body | `#F8F9FA` near-white + `#FFB830` warm rim light | Luminance ≥ 0.92 vs sky ≤ 0.18 → ~3.5:1+ |
| Magnet head | `#E63946` clear red | Brand constant across all cards |
| Falling junk | `#6C7A89` / `#4A5568` desaturated cool grays | Junk must *not* compete with the subject |
| Gap wedge | `#0E1320` near-black navy | The Consequence Law's dark floor |

Card sky grade extends the existing `CARD_SKY` structure (dusk amber→teal) toward this punchier ramp; the module's own comment — that the sky shader reads deeper than the biome numbers suggest — is honored by *raising input saturation* ~20% relative to current values rather than replacing the shader.

### 1.4.4 Animated ident re-spec (same variant, 3.0 s loop)

| Time | Beat |
|---|---|
| 0–0.5 s | **Hook:** a fridge tumbles past the frame edge; the eye snaps wide (pupil dilation animated) — the existing `IDENT_HOOK_MS = 500` law |
| 0.5–2.0 s | The launch: robot streaks up the 38° vector, streaks and field lines trailing |
| 2.0 s | **The catch flash** on the destination beam (`IDENT_CATCH_MS` unchanged) |
| 2.0–2.7 s | Settle squash + one blink |
| 2.7–3.0 s | Loop-clean hold (junk layer resumes falling) |

Budgets: WebM ≤ 300 KB (current 245 KB — hold the line), WebP/GIF siblings regenerated; loop point verified frame-exact by the existing capture tooling.

---

## 1.5 SPEC: HERO-B — "The Fall Blooper" (the comedy card)

The game's own thesis is *falls are half the fun* — the second card sells exactly that, and it is the strongest differentiator against the shelf of grim rage-games.

- Same framing family: `visibleHeight` **4.6 m**, subject at **(0.62, 0.40)** (upper-right thirds point — *falling* vector reads top-right → bottom-left, mirroring HERO-A for family symmetry).
- Pose: upside-down windmill, arms in a 4-frame tumble cycle, the **panic eye** spec from §1.4.2 with the pupil offset *down* (looking at the long drop below).
- Comedy layer below: the scrapyard stack far below rendered tiny (height cue) + 3 scattering props flying off him (bucket, wrench, soda can) on exaggerated arcs + optional startled pigeons — a blooper, not gore.
- Palette: HERO-A's ramp with the horizon glow shifted to **violet-dusk** (`#6C4BD8` upper band) so the pair is instantly siblings-but-different.
- The grade card's deadpan comedy (letter grade, metres, junk-moved) is *not* on the thumbnail — no text, Law 9 — but its typography of numbers-as-comedy informs the ending-screen family (Volume IV).

## 1.6 SPEC: HERO-C — "Summit Glow" (the aspiration card, revision of `tower-scale`)

Keep the existing wide ambience card's idea (the whole shaft, MAGNO small on his beam, summit beacon lit) — *wide* is a legitimate third voice in the family — but tighten it to the Twelve Laws:

- Crop in ~30% (the shaft reads at 128 px as a *shape*, not mush): `visibleHeight` from current wide framing down to the tower occupying 70% of card height, summit beacon in the upper-right glint zone.
- Steal HERO-A's sky ramp and rim treatment so the family lockup is unmistakable.
- Add the launch vector *in miniature*: MAGNO + one streak mid-hop, small but sharp — the card says "you climb *this*."

## 1.7 In-engine implementation (the surgical diff)

All changes live in **one module** — `src/render/thumbnail-scene.ts` — plus two small supports:

1. **`SPECS['panic-launch']`** (new `VariantSpec`): `level: 'scrapyard-01'`, `framing: { center, visibleHeight: 4.2 }`, `view: stagedView({ position, velocity along the 38° vector, angle: -18°, polarity: 'repel', charge01: 1 })`, `subjectMargin: 1.05`, `dress: [gap wedge, fridge, bicycle, TV, destination beam glint]`, `altitude: 0.55`, `ambientSky: false`. HERO-B/C parallel entries.
2. **Eye pose plumbing**: `src/render/magno-rig.ts` gains a card-only `eyePose: 'ambient' | 'panic'` render parameter (default `ambient`; no simulation, gameplay, or physics path touched — the sim never learns the card exists, preserving the codebase's cardinal rule).
3. **Motion streaks**: reuse `src/render/wind-streaks.ts` with a card-local density/scale block; falling-junk streaks are the same renderer rotated.
4. **Regenerate**: `npm run dev` + `npm run thumbnails` (existing flow), then `python tools/check-thumbnail.py --report thumbnails` — the audit already enforces OCR-empty, legibility-128, contrast, and ΔE-mint rules; §1.9 adds the emotion audit.
5. **Dossier**: `thumbnails/report.json`, `docs/SUBMISSION.md` §3, and the five-point pre-flight re-render (`npm run docs` is byte-stable by design).

## 1.8 Why the card must be re-rendered in-engine (and the concepts are only references)

The AI-generated concept renders in §1.10 are **target references for composition and palette — not shippable assets.** The codebase's law is correct and stays: the shipped card renders through the same rig, field lines, and post pass as gameplay, in `thumbnail-scene.ts`, so the store frame can never drift from the game (Truth Law, and the module's own header). The builder's job is to *steer the real engine toward the validated reference* — same shot, same palette ramp, same eye — not to paste an image into `public/`.

## 1.9 The validation protocol (five machine gates + two human panels)

| Gate | Test | Pass line |
|---|---|---|
| G1 — Story at 128 | Downscale (LANCZOS) to 128×128; independent vision-model review: *who is the subject, what is happening, what's the peril?* | All three answered correctly; character "clearly visible and recognizable" |
| G2 — Emotion at 128 | Same 128 px crop, subject box only | Expression category (panic/joy) correctly named; eye ≥ 12 px |
| G3 — Contrast | Existing `audits.contrast` + luminance ratio subject-vs-backdrop | ≥ 3:1 subject/backdrop; 1.6:1 tonal separation in 128-crop (existing rule) |
| G4 — Mint | Existing `audits.hueCollision` vs #83FFE7 | False (no pixel ΔE ≤ 10) |
| G5 — OCR | Existing `audits.ocrEmpty` | True (zero glyphs at conf ≥ 65) |
| P1 — Forced choice | 10 naive viewers, 200 ms exposure, "which would you click?" against current card and 2 shelf competitors | **≥ 9/10 prefer the new card** (existing R-TH-07 protocol) |
| P2 — Card-size read | 5/5 viewers name the game's premise from the 628 card alone | 5/5 |

## 1.10 PROOF — the spec was validated before it was written [Q]

Two concept renders were generated to this exact specification and run through Gate G1/G2 at 128 px (full transcripts in Appendix D):

- **HERO-A "Panic Launch"** (`download/thumbnail-HERO-A-panic-launch.png`): character "clearly visible and recognizable… very clear excited/urgent expression… falling debris suggesting action and danger… extremely vibrant… a kid would almost certainly stop and click." **9/10** versus the current card's 3/10.
- **HERO-B "Fall Blooper"** (`download/thumbnail-HERO-B-fall-blooper.png`): "distinct silhouette… single large eye looking at the viewer… chaotic fall… slapstick humor… highly likely to be clicked." **9/10.**

The delta — **3/10 → 9/10 on the same test, same judge, same day** — is the highest-leverage number in this entire document. It was bought with: subject scale 3×, one engineered panic eye, a visible consequence layer, and a saturated mint-proof palette. Nothing else in the rebuild moves the funnel's first gate this far.

## Volume I requirements

| ID | Requirement | Acceptance | Verification |
|---|---|---|---|
| **P-TH-01** | Ship the `panic-launch` variant per §1.4 (framing, pose, eye, palette, danger layer, destination hint) | All Twelve Laws green | G1–G5 + review |
| **P-TH-02** | Eye spec: ring 34% head width, pupil 22% offset 15%, ≥12 px at 128 | Measured on render | G2 |
| **P-TH-03** | Palette per §1.4.3; saturation +20% vs current ramp; no mint collision | ΔE audit false | G4 |
| **P-TH-04** | HERO-B blooper card per §1.5 | G1–G5 green | audit |
| **P-TH-05** | HERO-C tightened tower card per §1.6 | G1–G5 green | audit |
| **P-TH-06** | Family lockup: shared sky ramp family, rim treatment, red magnet constant across all three cards | Side-by-side panel 5/5 "same game" | P2 |
| **P-TH-07** | Animated ident re-spec per §1.4.4; hook ≤ 500 ms; catch flash at 2.0 s; loop-clean 3.0 s; WebM ≤ 300 KB | Frame-exact loop; byte budget | capture tooling |
| **P-TH-08** | 628 and 1256 sharp copies regenerated for all three variants | Existing pipeline | `npm run thumbnails` |
| **P-TH-09** | Machine gates G1–G5 wired into `tools/check-thumbnail.py` (add G2 emotion check) | Non-zero exit on any failure | CI |
| **P-TH-10** | Forced-choice panel ≥ 9/10 vs current card + 2 competitors | Panel record in `report.json` | P1 (human leg) |
| **P-TH-11** | Card-size premise read 5/5 | Panel record | P2 (human leg) |
| **P-TH-12** | Concept renders archived as references; shipped assets rendered in-engine only | `thumbnail-scene.ts` is the only source of shipped cards | code review |

---

---

# VOLUME II — FIRST IMPRESSION & THE FIRST 90 SECONDS
## Session-0 doctrine: the only session that carries most of the weight

> *"Web players have shorter sessions and return less often than mobile players… the first session carries most weight. Quick, satisfying, repeatable loops of around 3 minutes perform best."* — Poki Engagement guide [S]

> *"Players should be interacting with core gameplay within fifteen seconds of launching the game. Not watching cutscenes, not configuring settings."* — FTUE practice consensus [S]

---

## 2.1 The doctrine, assembled from research

**Poki's own position [S]** (Engagement guide): session 0 carries most of the weight; ~3-minute loops win; **"make the first minutes brilliant before making the tenth hour deep"**; celebrate every milestone with confetti, praise, and happy sounds (their cited exemplars: *Puffy Cat*'s victory screen; *Stickman Hook* dangling a new character at the end of every level; *Level Devil* scaling difficulty "bit by bit"); "stuck" is a difficulty problem, "drifting away" means it's time for a reward or a new challenge.

**The FTUE canon [S/C]:** onboarding exists to deliver one thing — **time-to-fun**. The practical rules that survive every study and post-mortem: core gameplay inside 15 seconds [S: Onboarding Paradox]; teach by doing, not by reading (Poki's own "visual and intuitive rather than text-heavy" [S]); classify what must be learned by difficulty×importance and teach *only* the critical path first [S: Acagamic onboarding techniques]; the first session predicts lifetime behavior, so instrument its funnel step by step [C: Lean Analytics, Croll & Yoskovitz; the repo's own KPI doc already encodes this correctly].

**The emotional target [C]:** Lazzaro's *Four Keys to Fun* — MAGNETOPE's session-0 cocktail should be **Easy Fun first** (curiosity, surprise, the toy-joy of the first fling) feeding **Hard Fun second** (the snap challenge, the par chase). The first fall is engineered *delight* (Easy Fun), not punishment — which is exactly the game's declared design DNA (falls as comedy, à la *Getting Over It* [C] — failure as spectacle, never shame).

**The QA truth [Q]:** in the live session, a competent adult QA player with the controls *explained in advance* did not clear level 1 in ~90 seconds of play — the launch/snap rhythm has a learning cliff where the game needs a slide. The repo's own planner corroborates: the first two levels do not yield a one-thumb clear, and their hops "lean on the release-instant aim a single thumb cannot give" [S: SUBMISSION.md §8]. This is the single biggest session-0 risk after the thumbnail.

---

## 2.2 SPEC: The opener (seconds 0–5)

| Beat | Current | New spec | Law |
|---|---|---|---|
| Cold load → playable | ~1.3 s desktop, 4–5 s mid phone [Q] | Keep (already inside the 10 s Poki red line); target ≤ 3 s p75 on real mid-tier (Vol VIII) | — |
| First frame | Opener cinematic | Opener **is** level 1 staged at its most beautiful angle — the game world visible and *live* behind the wordmark | 15-second rule |
| Skip affordance | Skip button; **keyboard dead until clicked** [Q: F-07] | **Any input skips** (key, tap, click); Skip chip also visible ≤ 1 s | Streamlined entry |
| From skip → first flip | ~2–3 s | **≤ 1.5 s**: skip lands directly on the perch with the coach arrow already pulsing | 15-second rule |
| Autoplay audio | Muted until gesture | Keep (autoplay law, Volume V); the first flip's "thunk" is the audio unlock moment | MDN autoplay [S] |

**The wordless teaching sequence (seconds 5–45):** the existing ghost-hand coach stays — it is genuinely good — but its pacing is re-anchored: *hold to charge* is taught by the charge ring filling on the *first* press (not by the player discovering hold-vs-tap), and the first hop is engineered to overshoot (§2.3) so the very first action produces a *big visible win*.

## 2.3 SPEC: The guaranteed first clear (levels 1–3)

The on-ramp machinery already exists (`src/config/onramp.ts`: `catchWindow ×1.25`, `assist ×1.5`, full through level 5, taper through 10). The rebuild sharpens its numbers and its *levels*:

| Parameter | Current | New (levels 1–3) | Rationale |
|---|---|---|---|
| `catchWindow` | 1.25 | **1.6** (taper to 1.25 by L5) | A sloppy flip must *still stick* — first-clear ≥ 85% is the gate |
| `assist` | 1.5 | **2.2** (taper to 1.5 by L5) | Aim generosity: the catch happens even with late/wrong aim |
| Level 1 layout | ~14.6 m climb | **≤ 9 m, 2 hops, one surface material** | One lesson: charge → fly → stick. Nothing else in frame one |
| First hop distance | planner tops out 7.0/14.6 m one-thumb [S] | **4.5 m at full charge** — overshoot margin ≥ 60% | The first action must *win*, visibly |
| Launch-aim assist | none | **Velocity-curve magnetism on hops 1–2 of L1–L3**: during on-ramp only, a launched MAGNO inside ±25° of the target normal gets a 15% steering nudge toward it | Closes the one-thumb gap; sim-level assist, testable, tapers away |
| First clear time | unbounded | **≤ 45 s target, ≤ 75 s hard ceiling** for a naive player | Poki's 3-minute loop needs a *clear* inside its first loop |
| Celebration | clear card | Clear card + confetti burst + praise chirp (Puffy Cat pattern [S]) + the level-2 dangle ("a ghost is watching") | Session-0 second hook |

**Verification is already built:** the repo's erratic one-action-at-a-time fuzz harness and the planner bot *replay levels under constraint* — the acceptance test is "planner clears L1–L3 one-thumb" (it currently cannot [S]), plus the human five-tester rehearsal (Vol XIII).

## 2.4 SPEC: The first fall — engineered delight at second ~60

The game's own law says the on-ramp catches every drop (R-ON-03) — correct for levels 1–2, wrong for the *show*. The fall-grade comedy is MAGNETOPE's signature and it currently debuts too late (deep in the scrapyard).

**New: "The Practice Fall."** Level 2 ends with a scripted, *unloseable* descent — a soft ball-pit drop of ~18 m with the slow-mo trigger, the grade card ("SPLAT: B+"), and the share-card offer. The player cannot fail it, is not punished by it, and has now *felt* the game's best moment inside the first two minutes. Falls graduate from terror to toy.

- Placement: end of level 2 (post-clear), not mid-level — never interrupts the first-clear win.
- The grade card copy runs the deadpan register already specified by the repo's feel bible; the share card's social surface stays closed-to-codes (existing R-CM posture).
- Instrumented: `measure('fall', 'first', 'graded')` rides the SdkBus — the session-0 funnel gains its delight checkpoint (Vol XI).

## 2.5 The three-minute loop (session-0 shape)

Poki's loop law [S] gives session 0 its skeleton; MAGNETOPE fills it:

```
0:00 load        0:03 first flip (big overshoot win)
0:45 level 1 clear + confetti + dangle
1:15 level 2 clear
1:45 THE PRACTICE FALL (slow-mo, grade card, share offer)
2:15 level 3 clear → star chase teased, par ghost intro'd
3:00 "one more level" — the session's open loop
```

Target session-0 median: **≥ 3.5 minutes** (floor: Poki's 3-minute healthy line), with ≥ 25% of plays over 3 minutes by construction (the 70-level campaign guarantees content; the dangle cadence guarantees desire).

## Volume II requirements

| ID | Requirement | Acceptance | Verification |
|---|---|---|---|
| **P-FT-01** | Any input skips the opener; skip→first-flip ≤ 1.5 s; no dead-input window | Timed in-browser session test | existing session harness + new timing assert |
| **P-FT-02** | Opener staged on live level-1 geometry, world visible behind wordmark | Visual review | capture |
| **P-FT-03** | On-ramp retune: catchWindow 1.6 / assist 2.2 on L1–L3, tapered by L5 | Planner clears L1–L3 one-thumb | planner + fuzz harness (existing tooling) |
| **P-FT-04** | L1 relaid: ≤ 9 m, 2 hops, first hop 4.5 m at full charge (≥ 60% overshoot margin) | Route replay test | `npm run solve` + levels suite |
| **P-FT-05** | Launch-aim assist on L1–L3 hops 1–2 (±25° cone, 15% nudge, on-ramp only) | New unit test pins the nudge envelope; sim determinism preserved | magno suite |
| **P-FT-06** | First clear ≤ 45 s target / ≤ 75 s ceiling for naive players | Five-tester rehearsal: 5/5 clear L1 inside ceiling | human leg (Vol XIII) |
| **P-FT-07** | "The Practice Fall" at end of L2: unloseable, slow-mo, grade card, share offer | New scripted-descent test; `measure('fall','first','graded')` fires once | fall + telemetry suites |
| **P-FT-08** | Celebration stack on every clear: confetti + praise chirp + next dangle | Cue-table row per element | feel/cue suites |
| **P-FT-09** | Session-0 median ≥ 3.5 min; ≥ 25% plays > 3 min | Player fit test | Poki dashboard |
| **P-FT-10** | No text tutorial in the critical path — coach arrows and staged wins only | Surface audit | a11y/compliance suite |

---

---

# VOLUME III — GAME FEEL & JUICE
## The tactile truth of a magnet

> *"Game feel is the tactile, kinesthetic sense of manipulating a virtual object… the sensation of control."* — Steve Swink, *Game Feel: A Game Designer's Guide to Virtual Sensation* [C]

The codebase already believes in feel (coyote windows, buffer windows, hit-stop, shake grammar, squash-and-stretch rig, particle ceilings, a feel table). This volume does not rebuild that machinery — it **escalates the moments the player remembers** and locks the latency law that all feel rests on.

## 3.1 The latency law [S/C]

RAIL's response budget — **user input → visible response under 100 ms** [S: Google RAIL model] — is the floor of "responsive." The sim's fixed 60 Hz deterministic tick is an asset most web games lack. The law to pin:

- **P-GF-01:** Input event → simulated effect on the very next tick; tick → rendered frame the same frame. Instrumented ceiling: **≤ 34 ms median, ≤ 50 ms p99** from `keydown`/`pointerdown` to first affected rendered frame. (New browser test: timestamp injection at the input layer, high-frequency sampling of the render state.)
- The existing input-merge design (keyboard/mouse/touch → fixed-tick frames) already satisfies this structurally; the requirement makes it *regression-proof*.

## 3.2 The five moments of magnetism — escalated [C: Swink; C: Johnston & Thomas, *The Illusion of Life*; C: Lasseter 1987]

The twelve classical principles apply to real-time 3D exactly as Lasseter argued in 1987 [C]. Each moment below gets **anticipation → action → follow-through** coverage and the two-senses rule the cue table already enforces:

| Moment | Anticipation | Action | Follow-through | New juice |
|---|---|---|---|---|
| **Charge** | Field lines converge on the perch; hum pitch ramps; body compresses 8% over full charge (squash) | Release: 2-frame launch squash → stretch along vector | Arms trail; ring flash | **Vibration cue** on touch: `navigator.vibrate(10)` at full charge (Android; no-op elsewhere) |
| **Flight** | — | Wind streaks scale with speed; FOV eases +2° | Trail ribbon fades | Speed-dependent streak *density* ramp (reuse `wind-streaks.ts`) |
| **Snap catch** | Target ring pulses when inside assist window (telegraphs the generosity — teaching, Vol II) | Attach: squash 12%, ring burst, "thunk" | Camera micro-dip 0.4°; magnet hum settles to lock | The **catch flash** is the game's signature — keep it, add 1-frame white rim pass on the caught surface |
| **Weak metal give-way** | Creak + surface tint pulse 300 ms before | Detach wobble | Junk sag | — |
| **The big fall** | Streaks reverse; music thins | Slow-mo depth per magnitude; wind roar | Grade card slam-in; share offer | — |

**P-GF-02/03/04** pin the three new behaviors (vibration, streak density ramp, assist-window telegraph) with unit tests at the sim/render boundary, preserving determinism (visual-only paths).

## 3.3 Shake, stop, flash — the grammar, budgeted

The repo's grammar is already disciplined (shake table, hit-stop refusal under reduced motion, flash-guard at 3 beats/rolling second). Escalations, all inside existing ceilings:

- **Launch kick:** amplitude +25% *only on full-charge releases* (earned shake, not constant shake — shake that means nothing teaches players to ignore it [S: GameMaker screenshake practice]).
- **Landing weight:** dust burst radius scales with impact speed; two dust colorways per biome (grade-integrated).
- **Hit-stop stays refused** (reduced-motion stance is correct and stays law).

## 3.4 The junk orchestra — audio-visual synchrony

Every physical event in the world already speaks through material voices (the repo's audio engine synthesizes everything — zero audio bytes shipped). The rebuild adds one law: **the orchestra plays the *card* too.** The HERO-A ident (§1.4.4) and the opener must run the same event→voice mapping as gameplay, so the store frame and the first five seconds are one continuous sensory promise.

---

# VOLUME IV — ART DIRECTION: FROM GENERIC TO OWNABLE
## "The art style itself is the identity"

The QA session's harshest visual verdict — *"muted, beige, placeholder-adjacent"* — was about *card and first-frame impact*, not about craft. The world is authored (code-generated kits, no asset packs). The premium move is **saturation, silhouette, and story discipline**, biome by biome.

## 4.1 The color script — five biomes, one warm-to-cool arc [C: the Pixar color-script practice]

The game already carries a "warm-to-cool story across five biomes" [S: SUBMISSION.md]. The rebuild makes it *loud* and *legible*:

| Biome | Grade story | Saturation target | Signature hue pair |
|---|---|---|---|
| Scrapyard | Dusk amber → teal shadow (hero palette, §1.4.3) | +15% vs current | `#FFB830` / `#1B2A4A` |
| Suburbia | Morning optimism — laundry-line pastels over green | +10% | `#7ED957` / `#FFF3E2` |
| Metropolis | Neon night — cyan signage vs warm windows | +25% (the loudest biome) | `#17B8E6` / `#FF4757` |
| Playground of Giants | Bright noon toy-plastic | +20% | `#FFD32A` / `#FF6B9D` |
| Stratosphere | Thin-air pastel, gravity giving up | 0% sat *drop* — silence by desaturation | `#E8F1FF` / `#9BB8E8` |

Laws: **one accent per screen** (the energy family `#FFD32A` is reserved for magnetism everywhere — a consistent semantic color is itself a brand); **mint exclusion** extends from cards into gameplay HUD bands (ΔE audit); biome intro levels stage their signature pair in the first camera frame (the "vocabulary lesson," Vol VI).

## 4.2 Silhouette and shape language

- **MAGNO's silhouette test [P-AR-02]:** the capsule+horseshoe profile must be nameable at 128 px silhouette-only (panel 5/5 — the plush-tile protocol already owed in the repo, now specified with a number).
- **Appliance architecture** stays — fridges, lockers, washing machines as the load-bearing visual rhyme (it is the game's most ownable motif, per the M4 review pack's own language [S]).
- **BotW-scale lessons [C: Nintendo's open-air composition talks, GDC 2017]:** landmark silhouettes on the horizon of every biome teach scale and destination — the summit beacon, the ferris wheel, the tower crane — visible from level 1 of each biome.

## 4.3 Post-stack discipline

Bloom carries the energy family only (rings, glints, beacon); everything else stays under the flash-guard's 3-beats law; **rim light becomes a character law** (MAGNO always carries a warm rim — he is the brightest object on screen by contract); fog depth-per-biome (metropolis fog glows neon; stratosphere fog is absence).

## 4.4 The five signature shots (extend the M4 pack)

1. **The Panic Launch** (new; the card shot, live in-game: a scrapyard ledge staged so the player *experiences* the thumbnail — store window truth, Law 12)
2. The junk orchestra flight
3. The biome color-script arrival
4. The fall-grade comedy card
5. The wordless ending

**P-AR-05** re-shoots the pack through `scripts/qa-signature-capture.mjs` after the grade retune; the panel leg (5/5 "names the game from the frame") is the human verification.

## 4.5 Anti-generic checklist (the "default three.js" audit) [P-AR-06]

No default-gray PBR • no stock skybox • no ungraded post chain • no default font UI (Fredoka stays, self-hosted) • no prop without an authored kit • no screen whose palette lacks its biome signature pair • no accent outside the semantic families. Audited by the grade tests and a new one-frame-per-biome review gate.

## Volumes III–IV requirements

| ID | Requirement | Acceptance | Verification |
|---|---|---|---|
| **P-GF-01** | Input→render ≤ 34 ms median / 50 ms p99 | New timing browser test | CI |
| **P-GF-02** | Vibration cue at full charge (touch only, no-op safe) | Unit + device matrix row | device leg |
| **P-GF-03** | Wind-streak density scales with airspeed (visual only) | Render test pins ramp | CI |
| **P-GF-04** | Assist-window telegraph ring pulses inside on-ramp catch windows | Cue-table row + test | CI |
| **P-GF-05** | Launch kick +25% amplitude only on full-charge releases | Shake-grammar test update | CI |
| **P-GF-06** | Ident and opener run the gameplay event→voice map | Audio mapping test | CI |
| **P-AR-01** | Biome saturation targets per §4.1 in `grade.ts` | Grade suite re-baselined | CI |
| **P-AR-02** | MAGNO silhouette nameable at 128 px | Panel 5/5 | human leg |
| **P-AR-03** | Horizon landmark per biome visible from its level 1 | Frame review | capture |
| **P-AR-04** | Warm rim light on MAGNO in every biome | Render test | CI |
| **P-AR-05** | Signature pack re-shot post-retune; panel 5/5 | capture + panel | human leg |
| **P-AR-06** | Anti-generic checklist green | Review gate | checklist |

---

---

# VOLUME V — AUDIO: THE ZERO-BYTE ORCHESTRA
## An audio identity with no audio files

The synthesized-everything audio engine (material voices, adaptive music, biome ambience — zero shipped bytes) is already a competitive weapon: it keeps the payload at 1.50 MB and makes the game's sound *unclonable by stock libraries*. The rebuild polishes its laws:

## 5.1 The autoplay law [S]

Browsers suspend `AudioContext` until a user gesture [S: MDN Autoplay guide; Chrome autoplay policy]. The game already treats the first flip as the unlock moment — the law is made explicit: **the first input resumes the context and plays the launch thunk as the audio handshake** (the player's first action is answered in sound — a feel event, Vol III). Mute/music toggles stay reachable one input from pause (existing a11y law).

## 5.2 The mix laws [C/S]

- **Loudness discipline:** hold the existing loudness suite; the web ceiling stays conservative (no stinger stacking; sidechain ducks music under every cue; peak-normalized voices so a commercial break's handoff is never a jump scare — which is also Poki's "mute game audio during advertisement playback" hard requirement, already honored through the SDK bus) [S].
- **Ad-break duck:** on `commercialBreak()`/`rewardedBreak()` resolve, music re-fades over 600 ms — never snaps back.
- **Two senses per cue** (existing cue-table law) gains the new cues from Vol III (vibration is a third sense on touch, not a replacement).

## 5.3 Sonic identity — the chirp [P-AU-01]

MAGNO's voice: a two-note metallic chirp that must survive the 4/5 recognition panel and 4/5 hummability probe already owed in the repo's final-gate table. The rebuild schedules them as *one sitting with the five-tester rehearsal* (Vol XIII) — ears are cheap to borrow for an hour.

---

# VOLUME VI — LEVEL DESIGN & DIFFICULTY ARCHITECTURE
## Seventy levels, one flow channel, zero cheap walls

> *"Start easy, ramp gradually… avoid sudden walls of difficulty… introduce new mechanics gradually."* — Poki Engagement guide [S]
> *"Sufficiency: the balance between challenge and skill… the flow channel."* — Csikszentmihalyi, *Flow* [C]

## 6.1 The campaign grammar

- **The 3-attempt law [P-LD-01]:** every level from 6 on must be clearable by a par-skill player in ≤ 3 attempts. The repo's own stuck-line — *four restarts in a row at one level joins the weekly review queue* — becomes a shipping gate, not just a telemetry flag: no level in the release build carries a known > 3-attempt par-skill clear (route replay + verdict rows).
- **Kishōtenketsu per biome [C]:** each 14-level biome runs introduction (1–4: vocabulary), development (5–10: combinations), twist (11–13: the biome's mechanic inverted), conclusion (14: the set-piece). The twist inversion *is* the biome's signature shot (Vol IV).
- **Vocabulary lessons [P-LD-02]:** each biome's level 1 stages its new material in the first camera frame with a guaranteed-success first use (weak metal in suburbia, wind in metropolis, low-gravity in stratosphere) — one new noun per level, never two [S: Poki "introduce new mechanics gradually"; S: onboarding's difficulty×importance classification].
- **The dangle cadence [S]:** *Stickman Hook*'s pattern (Poki's own exemplar) — every clear card dangles the next thing: a star chase, the ghost, the cosmetic shelf, the biome twist. The existing celebrate/dangle stacks stay; the law is that **no clear card is ever terminal** — there is always a visible next want.

## 6.2 Adaptive mercy, invisible and honest [C: Hunicke, "The Case for Dynamic Difficulty Adjustment," 2005]

Hunicke's case for DDA is adopted in the narrowest, most honest form: **within the on-ramp only (levels 1–10), a second consecutive failed attempt widens the catch window +0.1 (cap +0.3) and strengthens assist +10% (cap ×2.6)** — and the widening *tapers back* on the next clear, so mercy never becomes the norm. Beyond level 10, difficulty is fixed and par-honest; the game respects the player who chose to climb. Every mercy step rides the run clock and the telemetry, so the Friday report can see whether mercy fires at all (a level where it fires constantly is a mis-authored level and joins the retune queue).

## 6.3 The 71 verdicts — the human playthrough protocol [P-LD-04]

The single most important *human* leg in the entire program (QA finding F-05: **71/71 rows empty — nobody, including the developer, has played the campaign**):

1. One sitting per biome (five sittings, ~20–40 min each).
2. Per level: **fair** (was the fail my fault? yes/no), **fun** (1–5), **flow** (where the rhythm broke), **verdict** (keep / retune / re-lay + what to do).
3. `npm run verdicts` audits the form (71 rows); every retune/re-lay row enters the weekly Friday cycle; the gate is **71/71 filled, zero open rows, no level below fun 3/5** at submission.
4. "A dull level is a bug, not a taste" — the repo's own sentence — is the governing standard [S].

## 6.4 Par honesty and the ghosts

Par = author's time + 20% (existing law, kept). Ghost adoption is the M4 identity metric; the ghost-exchange codes stay the second-session hook (Vol X). Level relayouts re-run `npm run solve` + route replay (existing discipline — the suite fails until routes refresh, which is exactly right).

## 6.5 Scope check [S]

70 levels × 30–90 s = **35–105 minutes of content** against Poki's "~1 hour of content is usually the right scope" [S]. The campaign is *already* the right size for the platform — the craft budget goes to the verdict pass and the twist levels, not to more levels.

## Volumes V–VI requirements

| ID | Requirement | Acceptance | Verification |
|---|---|---|---|
| **P-AU-01** | First-input audio handshake; chirp panels 4/5 + 4/5 | Panels pass | human leg (one sitting) |
| **P-AU-02** | Ad-break music re-fade 600 ms; no snap-back | Mix test | CI |
| **P-AU-03** | New cues registered in the two-senses cue table | Table complete | cue suite |
| **P-LD-01** | 3-attempt law: no shipped level exceeds it at par skill | Route replays + verdicts | planner + human |
| **P-LD-02** | One new mechanic noun per level; biome L1 frames its signature material | Level audit | levels suite |
| **P-LD-03** | Kishōtenketsu arc per biome; twist levels carry signature shots | Verdict pass | review |
| **P-LD-04** | 71/71 verdict rows filled; zero open; no fun < 3/5 | `npm run verdicts` reads clean | human leg |
| **P-LD-05** | On-ramp adaptive mercy per §6.2 (caps, taper-back, telemetry) | New unit tests | CI |
| **P-LD-06** | Every clear card dangles the next want | UI audit | screens suite |
| **P-LD-07** | Friday retune cycle runs on the export every week pre-submission | Ritual log | runbook |

---

---

# VOLUME VII — MOBILE & CROSS-DEVICE: THE PORTRAIT CLIMB
## Turning the game's worst review into its natural orientation

> *"On mobile, cover the full screen in portrait or landscape, or both for the best experience."* — Poki Requirements (hard requirement) [S]

> *"Their audience is majority mobile. Desktop-only games are at a disadvantage."* — Poki, What We Look For [S]

## 7.1 Diagnosis [Q]

| Orientation | Score | Finding |
|---|---|---|
| Desktop 1280×720 | 8/10 | Playable, clean HUD, mouse-aim excellent |
| Mobile landscape 844×390 | 8/10 | "Competent mobile web game" — screen used well |
| **Mobile portrait 390×844** | **4/10** | **Robot reads at ~8–10% of screen width; large dead sky/ground bands; no orientation guidance; a climbing game rendering itself like a letterboxed desktop game** |

The irony that makes this volume easy to sell: **MAGNETOPE is a vertical climb. Portrait is its natural orientation.** The fix is not a "rotate your device" apology — it is a portrait *camera doctrine*. (A blocking rotate prompt is also hostile to Poki's full-screen-coverage requirement; it is specified below only as a never-blocking, one-time chip for genuinely wide levels.)

## 7.2 The research floor for touch [S/C]

- **Target size:** WCAG 2.5.5 (AAA) sets 44×44 CSS px; WCAG 2.2's 2.5.8 sets a 24×24 AA floor with ≥ 24 px offset between adjacent targets [S]; Apple HIG's 44 pt and Material's 48 dp converge on the same physics [C]; accessibility tooling guidance recommends visual bounds and hit areas *align* [S: Deque]. Fitts's law (1954) is the underlying math: acquisition time grows with distance and shrinks with size [C].
- **Poki's hard rules:** force touch control schemes on tablets (already law in `device.ts`); consistent experience across screen sizes and input methods [S].

## 7.3 SPEC: The portrait climbing camera [P-MO-01]

All changes live in `src/render/stage.ts` (`WORLD_FRAME`) and the camera rig's follow logic — the portrait machinery already exists (`portraitWidth` is a first-class field; it is simply *set too wide*):

| Parameter | Current | Portrait spec | Effect |
|---|---|---|---|
| `portraitWidth` | 7.6 m | **5.0 m** | MAGNO's apparent width ~**+52%**; upcoming perches read at interactive scale |
| Camera vertical bias (portrait) | ~50/50 | **62% of frame above MAGNO** | Two-thirds of the screen shows where you are *going* — dead sky becomes anticipation space, the Poki QA complaint dissolves |
| Goal visibility law | — | **The next perch or biome landmark is always inside the upper third** (camera clamps to keep it) | The climb always has a visible destination [C: landmark composition, Nintendo GDC 2017] |
| Opener in portrait | letterboxed cinematic | **Reframed per orientation** (the cinematic camera gets a portrait variant: closer, tilted up the shaft) | First impression fixed in the orientation most players arrive in |
| Safe areas | — | Touch controls inset by `env(safe-area-inset-*)` | Notch/home-bar clearance |

**Resulting geometry, verified against the QA math:** at 5.0 m visible width on a 390 px screen, the robot renders ≈ 70 px wide (≈ 18% of width) — Crossy-Road-class character scale [C], with the balance of the frame carrying the climb. The camera bias law converts the former "dead bands" into lookahead — the exact property a fall-anticipation game wants.

## 7.4 SPEC: Touch ergonomics [P-MO-02..05]

- **Primary targets:** flip button and every control ≥ **48 dp visual and hit area** (current flip button 96 px — passes; audit all secondary chips).
- **Spacing:** ≥ 24 px between any two interactive targets (WCAG 2.2 offset) — new layout-matrix assert.
- **Thumb arc:** flip button bottom-right quadrant, steering drag-zone the left half (current layout — correct); the `input.ts` merge design stays the single source of truth.
- **One-thumb law:** the launch-aim assist (Vol II, P-FT-05) closes the planner-proven gap; **the acceptance test is the planner clearing L1–L3 with the one-thumb constraint** (harness exists) [S: SUBMISSION.md §8's open question, closed].
- **The optional chip [P-MO-06]:** in *wide* metropolis levels only, portrait orientation, after **two consecutive failed attempts** and **once per session**: a dismissible "Landscape makes this climb easier" chip — never blocks, never auto-repeats, honors reduced-motion. Everything else in the game must be fully playable in portrait without ever seeing it.

## 7.5 The device matrix — physical evidence [P-MO-07]

The machine legs are done (tier map, layout battery, watchdog, filmstrips [S: SUBMISSION.md §13]); the physical legs are the developer's, one afternoon:

| Device | Orientation | Browser | Captures | Tier floor |
|---|---|---|---|---|
| Phone | portrait + landscape | Chrome | boot, first launch, fall card, clear, pause panel, portrait camera read | mid: 60 fps |
| Phone | as above | 2nd installed browser | same five | — |
| Tablet | portrait + landscape | Chrome | same five + stick reach at size | mid: 60 fps |
| Low-end laptop | landscape | Chrome | boot + mid-biome level, watchdog step | low: ≥ 30 fps on 2021 budget-Android class (Mali-G52) [S: PERF_BUDGET] |

Every cell: photo or short screen recording + the tier the probe read. The matrix is *done* when every row says so — this is the same table `docs/SUBMISSION.md` §13 already owes; the PRD's only addition is that **portrait cells must now pass the §7.3 camera doctrine**, not merely render.

## Volume VII requirements

| ID | Requirement | Acceptance | Verification |
|---|---|---|---|
| **P-MO-01** | Portrait camera: `portraitWidth` 5.0 m, 62% upward bias, goal-in-upper-third clamp, orientation-reframed opener | Portrait VLM/panel read ≥ 8/10 (from 4/10) | re-run QA protocol [Q] |
| **P-MO-02** | All interactive targets ≥ 48 dp visual + hit; ≥ 24 px spacing | Layout-matrix assert, all surfaces, all 7 locales | CI |
| **P-MO-03** | Safe-area insets honored for touch chrome | Device photos show clearance | device leg |
| **P-MO-04** | One-thumb planner clear of L1–L3 | Route replay under constraint | planner harness |
| **P-MO-05** | Tablet forcing + adaptive controls re-verified | Inspector QA module | Poki Inspector |
| **P-MO-06** | Optional landscape chip: trigger rules per §7.4, never blocking, ≤ 1×/session | UI test | CI |
| **P-MO-07** | Device matrix complete per §7.5 incl. portrait doctrine pass | All rows filled with evidence | human leg |
| **P-MO-08** | Full-screen coverage in both orientations (Poki hard req) | No letterbox bars at 640×360 / 836×470 / 1031×580 and native portrait/landscape geometries | Inspector scaling tests |

---

---

# VOLUME VIII — PERFORMANCE ENGINEERING
## The 10-second law and the 60fps floor

> *"Players tend to move to another game if loading takes more than 10 seconds, and they load from everywhere in the world."* — Poki Requirements [S]

The codebase is already in the top fraction of web-game engineering: **1.50 MB gzipped initial payload (budget ≤ 4 MB), ~1.3 s cold load on desktop, per-level route chunks of 350–500 B, 2,499 behavioral tests, soak tests, a quality-stepping watchdog** [Q]. This volume's job is to *bank* that lead and close the one evidence gap (real devices).

## 8.1 The load law [P-PE-01]

- Desktop: ≤ **1.5 s** cold (currently ~1.3 s [Q] — hold).
- Mid-tier phone on 4G, real device: **≤ 3 s p75** to first playable frame (current software-rendered estimate is 4–5 s [Q]; hardware decoding and a real GPU should land under 3 — the device matrix is the evidence leg).
- Hard ceiling everywhere: 10 s (Poki's abandonment line [S]).
- Progressive loading [S: Poki guidance]: the per-level route chunks already deliver this; the law is restated so no future change centralizes level data back into the entry chunk (a `build.test.ts` budget assert on the entry chunk size).

## 8.2 The frame law [P-PE-02]

- **60 fps on tier-mid (2020-class reference), ≥ 30 fps on tier-low (2021 budget Android, Mali-G52 class)** [S: PERF_BUDGET's own floors].
- The watchdog steps quality *at perches* (never mid-flight — the smart existing design) — keep.
- RAIL animation law: main-thread work per frame stays inside the 16.7 ms budget; the fixed 60 Hz sim + render decoupling already satisfies this structurally [S: RAIL].

## 8.3 The memory law [P-PE-03]

Ten minutes on the busiest level without growth, drift, or NaN (existing soak suite — keep); add the same soak on the device matrix's low-end phone. WASM (Rapier) compiles via streaming instantiation; the 1.12 MB wasm slice is the payload's bulk and is already cached aggressively by CDNs.

## 8.4 The evidence pack [P-PE-04]

`npm run loadtime`, the C2P filmstrips on three profiles, and the tier census are re-run on submission day and filed as the dossier's performance chapter — numbers, not adjectives.

---

# VOLUME IX — MONETIZATION & AD MANNERS
## The compliance bug that is also a revenue leak

> *"Timing control: do not implement internal ad timers, rely on Poki's system to manage ad frequency."* — Poki Requirements [S]

> *"Commercial break: fire at natural stops… Not every call triggers an ad; our system decides when a player is ready, so **signal as many opportunities as possible**."* — Poki SDK overview [S]

## 9.1 THE FINDING: the game's own politeness is a rules violation [Q]

`src/platform/ad-placement.ts` gates its `commercialBreak()` **calls** behind self-imposed floors — `breakFloorMs` (90 s since last break), `retryFloorMs` (×2), `firstBreakMinMs` (60 s of session first) — with test-pinned laws and generated-documentation fanfare. Intent was player-first; effect is twofold:

1. **Compliance:** Poki's published requirement says *do not implement internal ad timers* — theirs is the frequency brain. [S]
2. **Revenue:** every suppressed call is an unsignaled opportunity. Poki's model only monetizes the stops you *declare*; their system then decides what actually shows. The current code silently declines most of them — leaving impressions (and the 50/50 share) unclaimed at exactly the moments Poki's own docs bless: **death-and-restart, next-level** [S: SDK "Order of events"].

## 9.2 SPEC: The re-authored placement layer [P-MZ-01]

The *architecture* stays (one policy layer, closed placement vocabulary, SdkBus as the only SDK touchpoint — genuinely good design). The *laws* change:

| Call | Current | New law | Authority |
|---|---|---|---|
| `resumeBreak()` (pause→play) | always | **always** (unchanged — host contract) | Poki [S] |
| `advanceBreak()` (next level) | only past 90 s floor | **always at the natural stop** | Poki: "signal as many opportunities as possible" [S] |
| `retryBreak()` (restart) | only past 180 s floor | **always** — death-and-restart is Poki's canonical placement [S: SDK order-of-events table] | Poki |
| `firstBreakMinMs` | 60 s session guard | **removed** (session-0's first natural stop — the ~45 s first clear — is legitimate; Poki's system decides the rest) | Poki |
| Rewarded **prompt UI** gap (`promptGapMs`, placement caps) | 2-min shared window | **kept** — this is UI pushiness discipline, squarely the developer's responsibility ("pushy prompts lower engagement" [S]) | Poki |
| Rewarded **value** caps (doubler ≤ 200 Scrap/day, 1/day, run ≥ 25 s) | kept | **kept** — value hygiene, not ad timing | repo law |

The rewarded surfaces stay the three the game owns: **scrap-doubler** (earned), **locker-unlock** (walked-to, views uncapped, value-capped), **second-wind** — with second-wind re-scoped to *the Practice Fall tier* only if verdict play shows players want the save; falls-as-comedy never becomes falls-as-hostage ("reward-walling core gameplay… won't pass review" [S]).

## 9.3 The rewarded psychology, respected [S/C]

Opt-in rewarded formats earn ~**64% opt-in and >90% completion** in industry research [S: Coinis 2026; AppSamurai 2026; Adjust] precisely because the player trades attention for want — and Poki's platform rules encode the same respect. The UI laws (all Poki hard requirements [S]):

- Standard continue button **always present, equal or larger, adjacent or above** the rewarded option; both appear simultaneously.
- Rewarded buttons: prominent 🎬 icon, **never green**, never trick-positioned.
- On reward: confirmation animation + sound; **auto-apply** where possible; no double-rewarding.
- Ad-block detected: no reward, no message, silent (Poki handles the conversation).
- A `rewardedBreak()` resets the commercial timer [S: SDK] — placement map notes it.

## 9.4 The economy's one currency [S]

Poki is explicit: dual economies exist to drive IAP; on Poki there is no IAP, so a second currency is *only* confusion and grind — *"grind is one of the fastest ways to lose a web player"* [S]. MAGNETOPE's single Scrap currency, cosmetics-only sink, star-gated campaign, and ≤ 2% over-accumulation law (existing sim) are already exactly the platform-native shape. The dossier simply states it.

## 9.5 The honest money paragraph (carried from §0.9)

Ad revenue = engaged minutes × signaled opportunities × eCPM, split 50/50 on Poki-sourced traffic, 100% on direct traffic [S]. Web eCPMs sit below the ~$24 mobile-mediated rewarded benchmarks [S: Coinis] — but the platform's contribution is distribution (5M+ monthly players per high-performing game [S]). Plan year one as audience-building with modest revenue and a compounding asset; the live-ops cadence (Vol X) is where the curve bends.

## Volumes VIII–IX requirements

| ID | Requirement | Acceptance | Verification |
|---|---|---|---|
| **P-PE-01** | Load law: ≤1.5 s desktop / ≤3 s p75 mid-phone real device / 10 s hard ceiling | Device matrix + filmstrips | evidence pack |
| **P-PE-02** | Frame law: 60 fps tier-mid, ≥30 fps tier-low; watchdog steps at perches only | Tier census on devices | device leg |
| **P-PE-03** | Soak: no growth/drift/NaN, 10 min, busiest level, incl. low-end device | Soak suite + device soak | CI + device |
| **P-PE-04** | Performance evidence pack filed on submission day | Dossier chapter | runbook |
| **P-MZ-01** | **Remove all internal ad timers** (floors + first-minute guard); signal every natural stop | Placement suite re-authored; Inspector event log shows calls at every stop | CI + Poki Inspector |
| **P-MZ-02** | Rewarded UI: hierarchy, size, 🎬, never-green, simultaneous, confirmation, auto-apply, no double-reward, silent ad-block | UI audit per requirement | CI + Inspector |
| **P-MZ-03** | Three placement kinds only; doubler value caps kept; locker walked-to | Placement map regenerated | docs drift test |
| **P-MZ-04** | No reward-walling anywhere in the campaign | Progression suite | CI |
| **P-MZ-05** | Rewarded prompts: 2-min shared window kept as UI discipline (not ad timing) | Offer-gap test | CI |
| **P-MZ-06** | Ad-block visit: boots, plays, declines, buys with Scrap, zero page errors, no custom messaging | Existing adblock-browser suite, re-run post-change | CI |

---

---

# VOLUME X — RETENTION & LIVE OPERATIONS
## Room to grow is a criterion, not a bonus

> *"Built with room to expand for long-term investment… content hooks, systems that support updates… roadmap/update plan shared at submission."* — Poki, What We Look For [S]

Poki's engagement doctrine sets the frame: web sessions are short, session 0 rules, ~3-minute loops win, ~1 hour of content is the right scope [S]. MAGNETOPE's 70-level campaign is the right size at launch. What the platform rewards next is **cadence** — and the game already owns the machinery for it (the `friday` tooling, the weekly retune ritual, the ghost/par systems).

## 10.1 The second-session hooks [P-RT-01]

Web portals do not own D1 the way app stores do — the return currency is the *bookmark* and the *code*. MAGNETOPE's native hooks:

- **Ghost exchange codes** — a two-player reason to return: "beat my time, here's my code." Closed, opaque, child-safe (existing design); surfaced on the fall share-card and the clear card (existing surfaces).
- **The daily doubler** — one earned rewarded double per day (existing law, kept within Vol IX's caps).
- **The Friday drop [P-RT-02]** — a standing weekly beat: *new content every Friday* (a bonus level, a cosmetic pack, a ghost-season leaderboard theme). Named, predictable, ownable — the ritual the repo's own `friday.ts` tooling was clearly born for. Eight weeks of drops are authored pre-submission and held in reserve.
- **The ending's open loop** — the wordless ending credits card closes the campaign and immediately dangles the star-chase completion screen and ghost-season — the end is a door, not a wall.

## 10.2 The submission's roadmap chapter [P-RT-03]

Poki asks for the plan at submission [S]. The dossier ships a one-page live-ops map: the Friday cadence, the first eight drops named, the second-month biome-twist event, and the standing offer that game #2 enters playtesting the same quarter (Poki's own "start game #2 the same week" doctrine [S: SUBMISSION runbook] — portfolio logic, and the strongest possible signal of a developer worth a five-year exclusive).

## 10.3 Direct traffic is the profit margin [S]

Everything a player generates arriving directly — bookmarks, search, social, community — is **100% the developer's** revenue [S: revenue-deal-types]. Every hook above is also a direct-traffic engine: a shared fall card with a game URL is a bookmark with a joke attached. The share-card surface stays closed-to-codes (child safety, existing law) but carries the project-page URL in its meta layer where the platform permits.

---

# VOLUME XI — ANALYTICS & TELEMETRY
## The funnel is the flight recorder

The repo's KPI contract is already professional-grade (session-0 funnel, Friday report's six sections, one-metric-per-milestone discipline, every number split by locale × device — citing Croll and Kaushik by name [S: docs/KPI.md]). The rebuild *retargets* it, adds four events, and wires the iteration loop to Poki's own diagnostics.

## 11.1 The retargeted benchmarks [P-AN-01]

| KPI | Poki floor | Current target | Premium target |
|---|---|---|---|
| Conversion to play | 65% | 75% | **≥ 75% overall, ≥ 70% touch** (unchanged — already right) |
| Average playtime | 5 min (avg game ~6) | 7 min | **≥ 7 min** |
| Session-0 median | — | 7 min | **≥ 3.5 min** (P-FT-09) |
| First-clear conversion | — | on-ramp promise | **≥ 85%** |
| Time to first touch | 3 s desktop / 6 s touch ceilings | load-law ceilings | unchanged |

## 11.2 Four new events [P-AN-02] (all inside the measure() alphabet and its two-numeric budget [S])

1. `measure('fall', 'first', 'graded')` — the Practice Fall's delight checkpoint (P-FT-07).
2. `measure('orientation', 'portrait'|'landscape', 'session')` — the portrait doctrine's proof of adoption (P-MO-01).
3. `measure('assist', 'launch'|'catch', 'fired')` — mercy telemetry (P-LD-05's review queue input).
4. `measure('dangle', id, 'taken')` — want-conversion per dangle (existing dangle reader extended).

## 11.3 The iteration loop [S]

Poki's own diagnostics map 1:1 onto the funnel: weak **CTR** → thumbnail variants (Vol I panels); weak **C2P** → load law + opener (Vols II/VIII); weak **playtime** → the stuck/drift read (the Friday report's own sections) → retune queue (Vol VI). One focused change per test; every test repeatable and free [S: how-testing-works]. The runbook (Vol XIII) sequences this exactly.

---

# VOLUME XII — CONTENT SAFETY, COMPLIANCE & LOCALIZATION
## Nothing even slightly shocking

The existing safety audit is complete and green across violence, shock, gambling, language, themes, data, ad adjacency, sound, failure-tone, and exit-safety [S: SUBMISSION.md §9] — the rebuild keeps it and re-runs it at every milestone (it is a *table with evidence*, which is exactly how Poki's content moderation wants to be answered).

- **Child-data posture [P-CM-01]:** no PII, no free text, no fingerprinting beyond the SDK's surface; saves in localStorage with graceful degradation; every telemetry payload enumerated and child-safe-vocabulary-tested (existing laws, re-verified after Vol XI's additions). GDPR-K/COPPA-shaped by construction: the game collects nothing, asks nothing, and exports nothing the platform does not already own [C].
- **External links [S]:** the game opens none — so the in-game privacy-policy UI requirement is N/A by design (noted in the dossier with the reasoning, per Poki's requirements page).
- **Localization [P-CM-02]:** seven locales ship with full key coverage and layout matrices [S]; the owed native review of the six non-English locales is batched into the Vol XIII human-leg sittings; the pseudo-locale fit law and font sweep stay as regression gates.

## Volumes X–XII requirements

| ID | Requirement | Acceptance | Verification |
|---|---|---|---|
| **P-RT-01** | Second-session hooks live: ghost codes on share surfaces, daily doubler, ending open-loop | UI audit | screens suite |
| **P-RT-02** | Friday drop cadence: 8 drops authored pre-submission, named in roadmap | Content exists + roadmap chapter | dossier |
| **P-RT-03** | Live-ops roadmap page in the dossier (incl. game-#2 posture) | Section ships | dossier |
| **P-AN-01** | Retargeted benchmarks wired into the KPI contract | Docs re-render byte-stable | drift battery |
| **P-AN-02** | Four new events inside the measure() alphabet + numeric budget | doc-spine test | CI |
| **P-AN-03** | Iteration loop followed for every platform test (one change per test) | Runbook log | ritual |
| **P-CM-01** | Safety audit re-run green at every milestone incl. new events | Table refreshed | compliance suite |
| **P-CM-02** | Native review of 6 locales, batched sitting | Sign-off rows | human leg |

---

---

# VOLUME XIII — SUBMISSION READINESS & THE EVIDENCE PACK
## Fix the dead link, then fix the story you tell

## 13.1 THE LIVE PAGE — the credibility hole [F-04, Q]

The dossier claims the game "stays playable at the project page" at `https://manoj46-boos.github.io/magnetope/` — the page returns **"Site not found"** because the `gh-pages` branch was never pushed; `scripts/deploy-pages.mjs` exists, is correct, and was simply never run [Q].

- **P-SR-01:** `node scripts/deploy-pages.mjs` runs clean; GitHub Pages enabled with `gh-pages` as source; `curl -s -o /dev/null -w "%{http_code}" https://manoj46-boos.github.io/magnetope/` returns **200**; the runbook re-verifies it on submission day.
- The page ships the SDK-free production bundle (correct — the host SDK objects to unapproved domains; the game is SDK-optional by design [S: SUBMISSION §12]) while the tagged Poki bundle (`npm run build:poki`) is what uploads. The distinction stays documented.

## 13.2 The dossier refresh [P-SR-02]

`docs/SUBMISSION.md` re-renders against the rebuild: thumbnail section (three new variants + panel results), Poki-requirements table (the ad-timing row flips from *violation* to *compliant by design*, citing P-MZ-01), portrait row (device-matrix evidence), the AI ledger gains one honest row per executed volume (the ledger discipline — every AI session logged with the human decision that shaped it — is itself a credibility asset with a review team).

## 13.3 The four-week sprint (leverage-ordered) [P-SR-03]

| Week | Program | Gate at week's end |
|---|---|---|
| 1 | **Vol I** (thumbnail variants + ident) · **Vol II** (on-ramp retune, opener, Practice Fall) · **Vol IX** (ad-timer removal) | G1–G5 audits green; planner clears L1–L3 one-thumb; placement suite re-authored |
| 2 | **Vol VII** (portrait camera + ergonomics) · **Vol III** (feel escalations) · **Vol IV** (grade retune, signature shots) | Portrait QA re-run ≥ 8/10; cue/feel suites green; grade suite re-baselined |
| 3 | **Vol VI** (the 71 verdicts — human playthrough, one biome per sitting) + retunes · **Vol V** panels (chirp, blind-listen) | 71/71 filled; retune queue closed; audio panels pass |
| 4 | Device matrix · five-tester rehearsal · thumbnail forced-choice + card-read panels · `npm run preflight` · dossier · `deploy-pages` · **submit** | All P-IDs green or their human legs scheduled; runbook executed |

## 13.4 The submission-day runbook [P-SR-04]

1. `npm run build:poki` fresh; `git tag v2.0.0` on the exact uploaded build.
2. Thumbnail pre-flight five points green (four machine + panel ≥ 9/10 on file).
3. `npm run docs` no-op (byte-stable); dossier current; ledger signed and dated.
4. Live page **200** (P-SR-01 re-verified).
5. Upload via the Poki dashboard; **request the first playtest the same hour**; watch all ten recordings twice, logging confusions to the roadmap.
6. Player fit test only when entry conditions hold; read device-split; one focused change per iteration; retest until ≥ 3 min / 25% / then push higher (P-AM-01 targets).
7. Web fit test; final review request with the evidence pack attached.

## 13.5 The final gate [P-SR-05]

The repo's own Final Gate scorecard (ten sections, machine evidence 91.5/100 today, human legs worth 8.5) crosses **≥ 95** with: device matrix evidence, 71 verdicts, five-tester rehearsal artifacts, thumbnail panels, chirp/blind-listen panels, the ledger signature, and the runbook log. Every human leg is batched into Week 3–4 sittings — five focused sittings, not five open-ended chores.

## 13.6 The human-leg sitting plan [P-SR-06]

| Sitting | Legs closed | Time |
|---|---|---|
| 1–5 | The 71 verdicts (one biome each) | 5 × ~35 min |
| 6 | Five-tester rehearsal (first 90 s, first fall, first ad moment ×5) + panels: thumbnail forced-choice, card-size read, plush/silhouette 5/5, chirp 4/5, hummability 4/5, blind-listen 4/5 | ~2 h with recruits |
| 7 | Device matrix (phone/tablet/laptop, both orientations, two browsers) | ~1.5 h |

---

# VOLUME XIV — THE ZERO-REJECT RISK REGISTER
## Every way Poki can say no, and what was done about it

| # | Rejection vector | Driver | Mitigation | Residual risk | Evidence at submission |
|---|---|---|---|---|---|
| 1 | Hard-requirement violation | Internal ad timers [F-06] | **P-MZ-01 removes them** | ~None | Inspector event log |
| 2 | Thumbnail fails the grid | Muted card [F-01] | Vol I: validated 9/10 spec, family, panels P1/P2 | Low (stranger vote, de-risked) | Panel records + report.json |
| 3 | C2P below floor | Load/opener friction | Vols II/VIII; 1.3 s desktop [Q]; skip-any-input | Low | Filmstrips + opener test |
| 4 | Playtime below 3 min | Session-0 learning cliff [F-03] | Vol II on-ramp + Practice Fall + dangles; Vol VI 3-attempt law | **Medium — the main stranger vote** | Player fit test history |
| 5 | Final review: "not fun enough" | Nobody played it [F-05] | 71 verdicts + five-tester + craft volumes | Medium, dropping with each test | Verdicts + rehearsal log |
| 6 | Originality doubt | Generic first impression | Ownable mechanic (polarity sling) + Vol IV identity | Low | Signature pack |
| 7 | Mobile/portrait fail | Portrait 4/10 [F-02] | Vol VII camera doctrine + matrix | Low | Device matrix portrait rows |
| 8 | SDK event errors | — | 10,000-input trace + doc-spine + Inspector | ~None | Event log |
| 9 | Content moderation | — | Green audit table, child-safe laws | ~None | §9 table |
| 10 | Broken live page | Dead link [F-04] | P-SR-01 | ~None | HTTP 200 receipt |
| 11 | Credibility ("AI-slop" suspicion) | 71/99 commits by agent [Q] | Honest ledger + human verdicts + panels | Low | Signed ledger |
| 12 | Technical instability | — | 2,499 tests, soak, watchdog [Q] | ~None | Suite run + evidence pack |

**The two votes money cannot buy:** the click and the minute. This program's entire shape — validated thumbnail spec, session-0 doctrine, 3-attempt law, mercy telemetry, iteration runbook — exists to load those two votes with every advantage knowable in advance. That is the honest meaning of "zero rejection chance": **no controllable vector remains, and the uncontrollable ones arrive with the strongest evidence pack the reviewer sees that week.**

---

# APPENDIX A — Master requirement summary

**81 requirements across 14 volumes** (full statements, acceptance criteria, and verification methods are in each volume's requirements table):

| Volume | IDs | Count | Theme |
|---|---|---|---|
| 0 | P-AM-01..05 | 5 | The machine's contract |
| I | P-TH-01..12 | 12 | The thumbnail codex |
| II | P-FT-01..10 | 10 | First impression & FTUE |
| III | P-GF-01..06 | 6 | Game feel |
| IV | P-AR-01..06 | 6 | Art direction |
| V | P-AU-01..03 | 3 | Audio |
| VI | P-LD-01..07 | 7 | Levels & difficulty |
| VII | P-MO-01..08 | 8 | Mobile & portrait |
| VIII | P-PE-01..04 | 4 | Performance |
| IX | P-MZ-01..06 | 6 | Monetization compliance |
| X | P-RT-01..03 | 3 | Retention & live-ops |
| XI | P-AN-01..03 | 3 | Analytics |
| XII | P-CM-01..02 | 2 | Safety & localization |
| XIII | P-SR-01..06 | 6 | Submission readiness |

Execution order (leverage): **I → IX → II → VII → III/IV → VI → V → VIII/X/XI/XII → XIII.**

---

# APPENDIX B — THE FACULTY: 100 SOURCES

**Legend:** [S] fetched and read during this program · [C] canonical published work · [Q] project-internal evidence

## B1 · The platform's own word [S]
1. Poki — Requirements & Quality Guidelines (developers.poki.com/guide/requirements-quality)
2. Poki — Game Thumbnail (developers.poki.com/guide/game-thumbnail)
3. Poki — How Testing Works (the five-stage journey)
4. Poki — What We Look For
5. Poki — Final Review
6. Poki — How We Partner With You (revenue deal types)
7. Poki — Adding Your Game
8. Poki — SDK Overview & Events
9. Poki — Game Events (measure() patterns)
10. Poki — Engagement
11. Poki — Poki Inspector
12. Poki — Monetization Tips
13. Poki — Working with Poki (developers.poki.com)

## B2 · Thumbnails, icons & the half-second decision
14. [S] Cao, X. et al. (2021) — *How Character-Centric Game Icon Design Affects the Perception of Gameplay*, Applied Sciences 11(21):9911, MDPI
15. [S] UX Planet — *10 case studies that show how an application's new icon increased downloads* (2018)
16. [S] CrazyLabs — *5 Tips for a Perfect Mobile Game Icon* (2024)
17. [S] Netflix Tech Blog — *Artwork Personalization in Netflix Recommendations* (2017)
18. [S] Fast Company — *Netflix Is Even Personalizing Its Graphic Design To You Now* (2017)
19. [C] Gomez-Uribe, C. & Hunt, N. (2015) — *The Netflix Recommender System*, ACM TMIS 6(4)
20. [S] Vanity Fair — Netflix artwork-personalization coverage (2018)
21. [S] YouTube Creator Academy — thumbnail & title guidance
22. [S] C&I Studios — *Thumbnail Optimization: How to Boost Video CTR*
23. [S] Futuristic Marketing Services — *YouTube Thumbnail CTR: 6 Design Principles That Increase Clicks* (2026)
24. [S] CreativeTrnd — *First Impressions Count: The Science Behind Effective Thumbnails* (2023)
25. [S] Vidito — *What Is Click Through Rate and How to Actually Improve It* (2026)
26. [C] Itti, L. & Koch, C. (2001) — *Computational Modelling of Visual Attention*, Nature Reviews Neuroscience
27. [C] Kahneman, D. — *Thinking, Fast and Slow* (System-1 judgment)
28. [C] Ware, C. — *Information Visualization: Perception for Design*
29. [C] Block, B. — *The Visual Story* (cinematic composition)
30. [C] McCloud, S. — *Understanding Comics* (silhouette & visual storytelling)

## B3 · First-time user experience & retention
31. [S] LinkedIn (Singman) — *The Onboarding Paradox* (the 15-second rule)
32. [S] The Acagamic — *Unveiling 5 Proven Game Onboarding Techniques*
33. [S] King, D. (Medium) — *First Time User Experiences in Games: A Practical Guide*
34. [S] Mistplay — *Mobile game player retention strategies* (FTUE as lever #1)
35. [S] devtodev/Slashcev — FTUE tips compilation
36. [S] GameAnalytics — *Benchmarks in Mobile Games Q1'24* (median session 4m45s)
37. [S] AppFollow — *Mobile Game Metrics Benchmark* (top-quartile ~7 min)
38. [C] Eyal, N. — *Hooked: How to Build Habit-Forming Products*
39. [C] Ebbinghaus, H. (1885) — *Über das Gedächtnis* (spacing of returns)
40. [C] Krug, S. — *Don't Make Me Think*
41. [C] Weinschenk, S. — *100 Things Every Designer Needs to Know About People*

## B4 · Game feel, animation & fun
42. [C] Swink, S. — *Game Feel: A Game Designer's Guide to Virtual Sensation*
43. [C] Johnston, O. & Thomas, F. — *The Illusion of Life: Disney Animation*
44. [C] Lasseter, J. (1987) — *Principles of Traditional Animation Applied to 3D Computer Animation*, SIGGRAPH '87
45. [S] GameMaker — *Coffee-Break Tutorials: Juicy Screenshake* (2020)
46. [S] Bugnet — *Animation Principles Every Game Developer Should Know* (2026)
47. [C] Lazzaro, N. — *Why We Play Games: Four Keys to More Emotion Without Story* (XEO Design)
48. [C] Csikszentmihalyi, M. — *Flow: The Psychology of Optimal Experience*
49. [C] Chen, J. (2006) — *Flow in Games* (MFA thesis, thatgamecompany)
50. [C] Koster, R. — *A Theory of Fun for Game Design*
51. [C] Juul, J. — *The Art of Failure* (failure as enjoyment)
52. [C] Foddy, B. — *Getting Over It* (2017) — failure-as-spectacle design stance
53. [C] Salen, K. & Zimmerman, E. — *Rules of Play*
54. [C] Schell, J. — *The Art of Game Design: A Book of Lenses*
55. [C] Fullerton, T. — *Game Design Workshop*
56. [C] Trefry, G. — *Casual Game Design: Designing Play for the Casual Gamer*
57. [C] Isbister, K. — *How Games Move Us*
58. [C] Costikyan, G. — *Uncertainty in Games*

## B5 · Difficulty & systems design
59. [C] Hunicke, R. (2005) — *The Case for Dynamic Difficulty Adjustment in Games*, ACM SIGCHI
60. [C] Hunicke, R. & Chapman, V. (2004) — *AI for Dynamic Difficulty Adjustment in Games*, AAAI WS
61. [C] Fitts, P. (1954) — *The Information Capacity of the Human Motor System…*, J. Exp. Psychology
62. [C] Nintendo, GDC 2017 — *Change and Constant* (Breath of the Wild landmark composition)

## B6 · Touch, accessibility & interface standards
63. [S] W3C — WCAG 2.2 (SC 2.5.8 Target Size Minimum; SC 2.5.5 guidance)
64. [S] Deque — Axe DevTools: Touch Target Size rule (44 pt)
65. [S] 216digital — *Why Touch Targets Impact Accessibility*
66. [S] BOIA — *Understanding Target Size Under WCAG 2.2*
67. [C] Apple — Human Interface Guidelines (44 pt targets)
68. [C] Google — Material Design (48 dp targets)
69. [C] Nielsen Norman Group — touch-target & mobile usability research
70. [S] WebAIM — contrast & WCAG evaluation guidance

## B7 · Web performance & engineering
71. [S] Google — RAIL performance model (web.dev)
72. [S] MDN — Autoplay policy & AudioContext user-gesture requirements
73. [S] Vite — build & code-splitting documentation
74. [S] three.js — documentation
75. [S] Rapier (dimforge) — deterministic physics documentation
76. [S] Playwright — browser automation documentation

## B8 · Monetization research
77. [S] Coinis — *Rewarded Video Ads: How They Work & 2026 eCPMs* (64% opt-in; ~$24 eCPM)
78. [S] AppSamurai — *Rewarded Ads in Mobile Games* (>90% completion; 60% of top games)
79. [S] Adjust — *10 best practices for rewarded video ads*
80. [S] Yango Ads — *Rewarded video ads for mobile apps* (95% vs 60–70% forced completion)
81. [S] Google AdMob — *Rewarded Ads: a Win for Users, Developers, and Advertisers*
82. [S] MagicBid — *Interstitial vs Banner Ads* (2025)
83. [S] VentureBeat — interstitial performance research (2013)
84. [C] Anderson, C. — *Free: The Future of a Radical Price*

## B9 · Playtesting & QA practice
85. [S] Getgud — *10 Best Practices for Effective Game Playtesting* (2024)
86. [S] GDC Vault — *Building Games That Can Be Understood at a Glance*
87. [S] ReitGames — *Test Your Game Early* (documented Poki rejection: 1m12s vs the 3-minute floor)
88. [C] Croll, A. & Yoskovitz, B. — *Lean Analytics* (one metric that matters)
89. [C] Kaushik, A. — *Web Analytics 2.0*

## B10 · The project's own record [Q]
90. magnetope — `docs/SUBMISSION.md` (the dossier, incl. §7 open items)
91. magnetope — `docs/KPI.md` (the KPI contract)
92. magnetope — `docs/VERDICTS.md` (71 empty rows — the human-leg evidence)
93. magnetope — `docs/PERF_BUDGET.md` (tier floors)
94. magnetope — `README.md` (architecture & the verification table)
95. magnetope — `src/platform/{sdk,ad-placement,device}.ts`, `src/input/input.ts`, `src/render/stage.ts`, `src/render/thumbnail-scene.ts`, `src/config/onramp.ts` (line-level review)
96. magnetope — `thumbnails/static/*` + `report.json` (current card artifacts)
97. magnetope — full suite run: 105 files, 2,499 tests, 125 s, zero failures
98. QA session — `download/poki-qa-01..28` exhibits + VLM review transcripts (Oct 2026)
99. Concept validation — `download/thumbnail-HERO-A-panic-launch.png`, `thumbnail-HERO-B-fall-blooper.png` + 128 px variants + G1/G2 transcripts (9/10, 9/10 vs 3/10 baseline)
100. Poki.com — the live playground itself (the shelf every card competes on)

---
# APPENDIX C — Glossary

| Term | Meaning |
|---|---|
| **C2P** | Conversion to play — share of game-page visitors who actually start playing; Poki web-fit metric; healthy floor 65%, average ~70% |
| **CTR** | Click-through rate — share of impressions that become game-page visits; owned primarily by the thumbnail |
| **Session 0** | The player's first session; per Poki's own doctrine it carries most of the weight on the web |
| **Player fit test** | Poki's 500-real-player playtime test; healthy line: ≥ 3 min average, ≥ 25% of plays over 3 min |
| **Web fit test** | Poki's ~7-day live placement on real category pages measuring CTR, time-on-page, C2P |
| **Final review** | The 1–2 week human gate where the Poki team plays the game and reads its test history |
| **FTUE** | First-time user experience; the 15-second rule: core gameplay inside fifteen seconds |
| **DDA** | Dynamic difficulty adjustment (Hunicke, 2005); this PRD adopts it only as invisible on-ramp mercy |
| **Flow channel** | Csikszentmihalyi's corridor between anxiety (challenge too high) and boredom (skill too high) |
| **Par** | A level's reference clear time (author's time + 20%); the ghost's pace |
| **Ghost** | A recorded replay raced against the player; exchangeable as opaque codes |
| **Dangle** | A visible next-wart placed on a celebration surface ("one more level" psychology) |
| **SdkBus** | The repository's only module permitted to touch the Poki SDK; makes event-rule violations impossible by construction |
| **Ident** | The animated thumbnail loop (hook ≤ 0.5 s, catch flash at 2.0 s, loop-clean at 3.0 s) |
| **Mint law** | No pixel within ΔE 10 of Poki's playground background #83FFE7 |
| **The 128px law** | A card is designed at 128 px first: who + what + peril readable at tile size |
| **The Practice Fall** | The scripted, unloseable end-of-level-2 descent that debuts the fall-grade comedy inside session 0 |
| **Friday drop** | The standing weekly content beat shipped under the live-ops cadence |
| **RAIL** | Google's response–animation–idle–load performance model; response < 100 ms, animation at 60 fps |
| **LUFS** | Loudness Units relative to Full Scale — the web-audio loudness discipline the mix suites hold |
| **Tier-mid / tier-low** | The performance reference classes: 2020 mid-range (60 fps floor) and 2021 budget Android (≥ 30 fps floor) |
| **Watchdog** | The runtime that steps render quality down at perches when the frame budget is threatened |
| **P-ID** | This PRD's requirement identifier format (P-XX-nn); 81 requirements across 14 volumes |
| **The Faculty** | The 100 published sources standing behind this document's claims (Appendix B) |
| **The click / the minute** | The two stranger-votes no engineering can buy: the thumbnail's CTR and the player's minutes |

---

# APPENDIX D — Concept validation report [Q]

**Method.** Two concept renders were produced to the Volume I specification (composition, subject scale 3×, engineered panic eye, consequence layer, saturated mint-proof palette) and independently reviewed at **128×128 px** — the scroll-test condition — by a vision model instructed as a strict portal QA reviewer. The current shipped hero card was reviewed under the identical protocol earlier the same day.

**HERO-A "Panic Launch"** (`download/thumbnail-HERO-A-panic-launch.png`, 128 px variant alongside):
- Character "clearly visible and recognizable" ✓ · expression "very clear… excited/urgent" ✓ · danger "falling rocks/debris suggesting action and danger" ✓ · "colors extremely vibrant… high-contrast" ✓ · "a kid would almost certainly stop and click this" ✓
- **Rating: 9/10** — "stands out aggressively in a grid of games."

**HERO-B "Fall Blooper"** (`download/thumbnail-HERO-B-fall-blooper.png`, 128 px variant alongside):
- "Distinct silhouette… single large eye looking directly at the viewer… chaotic fall… slapstick humor… highly likely to be clicked."
- **Rating: 9/10.**

**Baseline for comparison:** current shipped hero card, same protocol: **3/10** — "a kid scrolling a grid of tiles does not stop on this."

**Delta: +6 points on the identical test, same day, same judge.** These renders are *target references* for the in-engine rebuild (§1.8); the 128 px variants are the G1 gate's calibration sample.

---

# COLOPHON

Produced from: a full instrumented QA session on the production build (28 screenshot exhibits); direct reads of Poki's developer documentation (13 pages); platform and academic research (§Appendix B); and a line-level review of the repository's own code and documents. The "faculty of 100" stands in for the 100 consultants the commission implied: **one hundred published sources, each real, each cited where it earned its claim.** The two votes that remain — the click and the minute — are, as ever, cast by strangers; this document's job was to make sure they are the only ones left with anything to decide.

**MAGNETOPE — Operation Zero-Reject. Build it. Play it. Ship it.**

---
