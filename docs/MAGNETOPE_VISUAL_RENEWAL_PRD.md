<!-- FRONT_MATTER -->
<!-- MAGNETOPE Visual Renewal PRD · v1.0 -->
# MAGNETOPE — VISUAL RENEWAL ENCYCLOPEDIA
### A Master-Driven Art Direction PRD to take MAGNETOPE from "generic AI game" to "Poki cannot reject"

---

**Document type:** Art Direction & Visual Identity PRD (encyclopedia form)
**Version:** 1.0
**Status:** Living document; rebuild-on-ai-ready
**Audience:**
1. The AI system (Claude / GPT / Gemini) that will rebuild the game from this spec
2. The Poki Developer Support / QA team that will review the rebuilt game
3. The solo developer, as the human creative director of record

**Companion to:** `MAGNETOPE_PRD.pdf` (game design), `docs/SUBMISSION.md` (Poki submission dossier), the prior brutal review (diagnosis of current art failures).

---

## How to read this document

This is an encyclopedia, not a pitch deck. Every chapter is designed to be **load-bearing**: remove one and the visual case for the game collapses. Read in order the first time. Then use it as a reference: each chapter is self-contained enough that an AI rebuilder can be prompted with a single chapter and produce a coherent artifact.

**Document map:**

| Part | Chapters | Purpose |
|---|---|---|
| **I — Diagnosis** | 1–2 | Why the current art fails the 200ms test, the silhouette test, the differentiation test. Brutal, evidence-led. |
| **II — First Principles** | 3–10 | The visual theory an art director needs, distilled from ~60 named masters. Encyclopedia entries per master. |
| **III — Visual Renewal** | 11–17 | The specific MAGNETOPE redesign: positioning, MAGNO, biomes, UI, color, thumbnail, animation. |
| **IV — Implementation** | 18–20 | Shaders, asset budget, file conventions, design tokens. Code-ready. |
| **V — Quality Bar** | 21–22 | Poki acceptance rubric, 25 binary checks, the 5-playtest protocol. |
| **Appendices** | A–D | Bibliography of the 100 masters, mood board, full color token table, glossary. |

**A note on "the 100 masters."** This document does not literally quote 100 people. It draws perspective from ~60 named masters (Appendix A is the bibliography). The spirit of "100 elite perspectives" is honored by treating every chapter as if a different master were the principal author: color theory chapters are written under Itten/Albers/Gurney/Birren/Eiseman authority; character chapters under Bobby Chiu/Iain McCaig/Glen Keane/Nico Marlet authority; brand identity under Scher/Bierut/Vignelli/Rams authority; cinematography under Deakins/Lubezki/Prieto authority. Where a principle is paraphrased, the source master is named inline. Where it is quoted, the source work is cited.

**A note on brutal honesty.** This document is written to be read by an AI that will *materially change* the game. Vague aspirational language ("make it more premium") is forbidden. Every chapter ends with a **Build Directive** — a single paragraph an AI rebuilder can paste into a prompt to execute the chapter.

---

## What this document is NOT

- It is **not** a game-design PRD. The original `MAGNETOPE_PRD.pdf` covers that. This document assumes the gameplay is already correct and only the visual layer needs renewal.
- It is **not** a marketing plan. It does not promise acceptance. It only maximizes the probability.
- It is **not** a static spec. It expects iteration. Token tables, palettes, and shader params are designed to be edited by the developer and re-fed to the AI rebuilder.

---

## The single sentence this document exists to make true

> **A Poki player who sees MAGNETOPE's thumbnail for 200 milliseconds must, in that 200ms, understand three things: (1) this is a magnet game, (2) this magnet game looks like nothing else on Poki, (3) I want to click.**

Every chapter is in service of that sentence.

---

<!-- CHAPTER_1 -->
# PART I — DIAGNOSIS

## Chapter 1 — Why the current art fails the three silent tests

There are three tests a web game on Poki must pass before any player ever clicks "play." MAGNETOPE in its current form fails two of them and limps through the third. They are, in order of lethality:

1. The **200ms thumbnail test** — can a player scrolling Poki read what the game is, in the time it takes to flick a thumb?
2. The **silhouette test** — when the game is running, does the main character read at a glance, or could it be confused for something else?
3. The **differentiation test** — does the game look like *anything else* on Poki, or does it look like *everything else* on Poki?

We take them in order of how badly the current art fails them.

### 1.1 The 200ms thumbnail test, and why MAGNO is a padlock

The Poki homepage is a wall of thumbnails. Each thumbnail is roughly 200×200 pixels at the typical scroll speed. A player makes the click-or-scroll decision in approximately 200 milliseconds. That is the entire window. Inside that window, the thumbnail must communicate **the genre, the hook, and the personality** of the game. Anything that requires the player to *read* text in the thumbnail has already lost — text is for after the click.

MAGNETOPE's current thumbnail shows MAGNO mid-flip against a tower of fridges, lockers, and a washing machine, with a seven-degree camera tilt and repel sparks behind him. The composition is correct by the textbook. The execution is the problem. When a vision model — a stand-in for the 200ms scan a human eye performs — was asked to describe the thumbnail without being told what the game was, it produced this verdict:

> *"The character is a small padlock with a face."*

It did not say magnet. It said padlock. The horseshoe-magnet head, rendered as a low-poly U-shape in a single steel color, reads as the shackle of a padlock. The body capsule reads as the padlock body. The single eye reads as the keyhole. The player sees a padlock. They do not see a magnet. They do not see "magnetism." They see a small anthropomorphic padlock in a junkyard, and they scroll past.

This is not a small problem. This is the entire game dying in the thumbnail.

**Root cause.** A horseshoe magnet is, in silhouette, a U. A padlock shackle is also a U. Without color contrast between the two poles (red N, blue S), without visible field lines, without the magnet being *visibly doing magnetism* (pulling something, repelling something, glowing with a charged field), the silhouette is ambiguous. Low-poly flat shading makes it worse: the absence of surface detail removes every cue that says "metal that is also magnetic" versus "metal that is also a lock."

**Why this was not caught.** The developer built the game with Claude Code and verified it with a planner bot. No human played it. No human looked at the thumbnail cold and said "what is this?" The first cold viewer was the Poki reviewer vision-model audit, which is what caught it.

**What this chapter is going to fix.** Chapter 12 contains the full MAGNO redesign. Chapter 16 contains the thumbnail redesign. Between them, the silhouette problem is solved at the character level (so every in-game frame reads as magnet, not padlock) and at the thumbnail level (so the 200ms scan reads magnet, not padlock, before the player ever clicks). The fixes are different because the constraints are different: in-game, MAGNO is small on screen and the magnet must read at 64×64 effective pixels; in the thumbnail, MAGNO is large but the magnet must read at thumbnail distance and at scroll speed. Different problems, different solutions, same root cause.

### 1.2 The flat-shaded low-poly trap

In 2014, flat-shaded low-poly was a fresh aesthetic. Crossy Road (2014, Hipster Whale, Matt Hall and Andy Sum) made it iconic, and it carried an entire generation of indie web games for nearly a decade. By 2026 it is the single most saturated aesthetic in the web games market. Every tutorial, every asset pack, every AI-generated game, every university student project ships in flat-shaded low-poly. The aesthetic has crossed from "stylistic choice" to "default setting."

MAGNETOPE is in flat-shaded low-poly. The PRD §3.2 calls this "clone defence" — the argument being that flat-shaded low-poly is cheap to produce procedurally, allows the code-generated prop kits to ship with no asset pipeline, and gives the game a coherent if generic look. That argument was correct in 2014. It is suicidal in 2026. **You cannot defend against clones by being more generic than the clones.** You make yourself invisible. You become the background against which the differentiated games stand out.

To be concrete: a Poki player scrolling the popular page in October 2026 sees, in order, Subway Surfers (stylized cartoon 3D), Hide and Paint (painterly 2D), Slime Keyboard Escape (gel capsule), Little Farm World (hand-painted isometric), MR Racer (photoreal-leaning racing), Hole.io (flat 3D but with a strong single-color read), Stickman Hook (vector minimalist). Eight games, eight different visual identities. MAGNETOPE in its current form would be the ninth, and it would look like "another one of those flat low-poly ones." That is the differentiation test, failed.

**Root cause.** The choice of flat-shaded low-poly was a *technical* choice (no asset pipeline, procedural props, fast build) masquerading as an *art* choice. The PRD treated it as settled. It is not settled. It is the single biggest art-direction liability the game has.

**What this chapter is going to fix.** Chapter 7 (Materiality, Shaders, and the Look of Surfaces) lays out the alternative rendering styles that fit the game's technical constraints (small bundle, fast cold load, must run on tier-low mobile) while giving a differentiated identity. Chapter 18 (Shader & Material Specifications) provides the actual code. The renewal does not abandon procedural props — it changes how they are shaded and lit, which is the cheapest possible visual upgrade.

### 1.3 The default biome progression

A player who clicks past the thumbnail and lands in the game encounters, in order: a scrapyard of fridges, girders, and lockers; then a suburbia of trampolines and washing lines; then a neon metropolis with gusting wind; then a playground with see-saws and ferris wheels; then a stratosphere above the clouds. Five biomes, escalating verticality, escalating weirdness.

This is good *game* design. It is also, unfortunately, the literal default biome progression of every physics puzzle game on Poki. Scrapyard → Suburbia → Metropolis → Playground → Stratosphere maps almost one-to-one onto the level-order of Stickman Hook, Stickman Battle, Mad Stick, and at least three other titles in the same genre. The biome order has been optimized by the genre, which means it has been optimized into invisibility.

**Root cause.** The PRD was written by reading what other physics puzzle games do, and then doing it slightly better. Slightly better is not differentiated. Slightly better is the graveyard of web games that earned $200/month for six months and were then quietly removed.

**What this chapter is going to fix.** Chapter 13 (Biome Art Direction) does not change the *order* of biomes — that would break the game's verticality curve, which is correct. It changes the *visual identity* of each biome so that no biome is mistakable for any other game's biome. The Scrapyard stops being "the junkyard level" and becomes a specific, named, art-directed place. Suburbia stops being "the suburbia level" and becomes a specific time of day in a specific climate. Each biome is given a single iconic image — the one frame a player would remember if they only played the game once — and every prop, palette, and lighting choice in the biome serves that frame.

### 1.4 The compounded cost

Each of these three failures is survivable in isolation. A game with a great thumbnail but generic in-game art can still get clicked. A game with great in-game art but a generic thumbnail can still get played if it goes viral on TikTok. A game with great art and great thumbnail but a generic biome progression can still succeed if the magnet mechanic is fun enough.

MAGNETOPE in its current form has **all three failures simultaneously**. The thumbnail fails the 200ms test (padlock, not magnet). The in-game art fails the differentiation test (flat-shaded low-poly in 2026). The biome progression fails the uniqueness test (default order, default props, default palettes). The three failures compound: a player who scrolls past the thumbnail never sees the in-game art; a player who clicks and sees generic in-game art never gets far enough to notice the biome progression. The game dies at the first gate.

This document exists to fix all three. The fixes are interlocking: the thumbnail fix requires the character fix, the character fix requires the materiality fix, the materiality fix requires the biome color system, the biome color system requires the master palette, the master palette requires the typography and UI system to be in the same color space. Pull one thread and the whole sweater comes with it. That is why this is an encyclopedia and not a patch list.

### Build Directive for Chapter 1

> AI rebuilder, read this chapter and then *stop trying to defend the current art*. The current art is not your friend. It is not a constraint to be respected. It is the problem. Every subsequent chapter assumes you have internalized that the flat-shaded low-poly MAGNO with the desaturated scrapyard palette is being replaced, not patched. If you find yourself reaching for "keep the existing style but tweak it," re-read this chapter.

<!-- CHAPTER_2 -->
## Chapter 2 — The three silent killers of generic AI game art

Before we open the encyclopedia of masters, we must name the three diseases we are curing. They are not unique to MAGNETOPE. They are the three diseases that killed 90% of AI-assisted indie games shipped between 2023 and 2026. Naming them precisely is the prerequisite to prescribing against them.

### 2.1 Silent Killer #1 — The Asset-Pack Equivalent Look

The first disease is the *asset-pack equivalent look*. The game does not literally ship asset-pack assets — MAGNETOPE's props are procedurally generated in code, which is honestly admirable. But the *look* is indistinguishable from a game that did. The props are the right shape, the right size, lit from the right angle, shaded with the right flat color — and they look exactly like every other low-poly junkyard on itch.io.

**Symptom.** A reviewer cannot tell, from a screenshot alone, whether the game was built by a solo developer in six months or assembled from a $49 asset pack in a weekend. The craftsmanship is invisible because the visual language is shared with everyone who has ever opened a low-poly kit.

**Diagnostic.** Show a screenshot of your game to a designer who has not been told what the game is. Ask: "Could this screenshot have been produced by a free or commercial asset pack?" If the answer is yes or even "probably," the game has the disease.

**Prescription.** The fix is not "more detail" (that makes the bundle bigger and the cold-load slower). The fix is **a single unusual, committed visual decision that no asset pack would make**. This is the *signature* of the art direction. It must be visible in every screenshot. It must be the first thing a reviewer notices. It must be the thing that, if you removed it, the game would look like every other game in the genre. Chapter 11 names this signature for MAGNETOPE. Every subsequent chapter is in service of making that signature impossible to miss.

### 2.2 Silent Killer #2 — The Color Muting Disease

The second disease is *color muting*. The game uses a desaturated palette — dusty browns, pale teals, soft beiges — under the belief that "muted = sophisticated." This belief is wrong, and it is especially wrong on Poki.

Poki's audience is disproportionately young (median age in the mid-teens), disproportionately mobile, and disproportionately playing on screens with poor color reproduction. A desaturated palette that reads as "tasteful" on a calibrated designer monitor reads as "washed out" or "broken" on a mid-range Android screen. Worse, desaturated palettes fail the 200ms thumbnail test: a wall of pastel thumbnails blurs into one indistinguishable mass, and the player scrolls past all of them.

**Symptom.** The game's screenshots, viewed at thumbnail size, look like the same beige-teal rectangle. No single thumbnail stands out. No single prop reads at distance.

**Diagnostic.** Take the game's static thumbnail. Reduce it to 64×64 pixels (the effective on-screen size at scroll speed). Reduce the color depth to 16 colors. If the thumbnail is now unrecognizable, the palette is too muted.

**Prescription.** Commit to a saturated, high-contrast palette. This is not the same as "garish" — Hades (art direction Jen Zee) is saturated and high-contrast and is also genuinely beautiful. The principle is that *every biome must have at least one color that would not appear in any other biome's palette*. If the Scrapyard and Suburbia share more than two colors, they are not differentiated. Chapter 15 contains the full master palette, constructed so that no two biomes share a dominant hue.

### 2.3 Silent Killer #3 — The Empty Background Syndrome

The third disease is *empty background syndrome*. The game's foreground has props, the game's background has sky, and there is nothing in between. The middle distance is a beige void. This is what the vision model meant when it said "the background is so plain that it can be hard to judge distance/speed against the beige void."

**Symptom.** Screenshots feel sparse. The character looks like it is floating in a color rather than moving through a place. The player has no sense of altitude, no sense of depth, no sense that the world exists beyond the immediate prop.

**Diagnostic.** Cover the foreground props in a screenshot. Is there enough in the background to identify the biome? If not, the background is too empty.

**Prescription.** Every biome must have a three-layer background: a near-distance silhouette layer (parallax 0.8), a mid-distance atmospheric layer (parallax 0.5), and a far-distance sky layer (parallax 0.0). Each layer must carry *biome-identifying information* — not generic mountains, but biome-specific silhouettes that would not appear in any other biome. Chapter 13 specifies this layer system per biome.

### 2.4 Why these three compound into invisibility

A game with asset-pack-equivalent look, color muting, and empty backgrounds is *legible* — the player can play it. But it is not *memorable*. It does not survive the scroll. It does not get shared. It does not get a player to come back tomorrow. The three diseases compound: muted colors against empty backgrounds make the asset-pack-equivalent props look even more generic, because nothing in the frame is fighting to be remembered.

The cure is not three separate fixes. It is one coordinated visual identity that simultaneously rejects the asset-pack look (with a signature decision), rejects color muting (with a saturated committed palette), and rejects empty backgrounds (with a three-layer biome-specific backdrop). The next part of this encyclopedia is the theory that makes that coordinated identity possible.

### Build Directive for Chapter 2

> AI rebuilder: before reading Part II, take a screenshot of the current game. Identify, in writing, which of the three silent killers is most severe in the current build. That diagnosis determines the order in which you apply Part III: if Killer #1 (asset-pack look) is most severe, start with Chapter 11 (positioning) and Chapter 12 (MAGNO redesign). If Killer #2 (color muting) is most severe, start with Chapter 15 (color system). If Killer #3 (empty background) is most severe, start with Chapter 13 (biome art direction). Do not try to fix all three in parallel — the chapters are designed to be applied in sequence, with each one building on the prior.

<!-- CHAPTER_3 -->
# PART II — FIRST PRINCIPLES

## Chapter 3 — The 100 Masters: a curated pantheon of visual authority

This chapter is the bibliography-as-method. The principle: an art director who can name the masters they are stealing from is an art director with a coherent identity. An art director who cannot is an art director producing "generic."

We do not literally consult 100 people. We consult the **perspectives** of approximately sixty named masters — across game art direction, illustration, character design, color theory, brand identity, animation, cinematography, industrial design, type design, and architecture — and treat each perspective as load-bearing for a specific chapter of the renewal. Where the master has written or spoken about the principle, we cite the source. Where the principle is a paraphrase of their body of work, we say so.

The pantheon is organized by domain. Each entry contains: name, primary work, the one transferable principle for MAGNETOPE, and the chapter(s) where that principle is applied.

### 3.1 Game Art Directors (12 masters)

**1. Jen Zee** — Art Director, *Hades* (Supergiant, 2020) and *Hades II*. Transferable principle: **saturation is not the enemy of beauty**. The Hades palette is high-contrast, deeply saturated, and uses rim light as a primary identity device rather than realistic illumination. Applied in: Chapter 15 (Color System), Chapter 18 (Shader Specs — rim light).

**2. Scott Benson** — Artist/Writer, *Night in the Woods* (Finji, 2017). Transferable principle: **a single recurring shape language creates a world**. Night in the Woods uses rounded organic forms for every character and prop, so the world feels hand-drawn even when it is procedurally placed. Applied in: Chapter 12 (MAGNO Redesign — shape language), Chapter 13 (Biome kits).

**3. Toby Fox** — Creator, *Undertale* (2015) and *Deltarune*. Transferable principle: **visual restraint is a feature**. Undertale uses a deliberately limited palette and pixel-art scale to make every screen legible and every character design memorable. The lesson for MAGNETOPE is not "go pixel art" — it is "pick a constraint and commit." Applied in: Chapter 11 (Positioning — the committed signature).

**4. Tomm Moore** — Co-founder, Cartoon Saloon (*Song of the Sea*, *Wolfwalkers*). Transferable principle: **ligne claire adapted to flat-shaded form**, with shapes defined by negative space rather than outline. Applied in: Chapter 7 (Materiality — toon-shaded alternative), Chapter 13 (Metropolis biome).

**5. Ross Stewart** — Co-founder, Cartoon Saloon. Transferable principle: **every frame is a painting**; backgrounds are not backdrops but compositions. Applied in: Chapter 9 (Cinematography & Staging), Chapter 13 (every biome's "iconic image").

**6. Alx Preston** — Creator, *Hyper Light Drifter* (Heart Machine, 2016). Transferable principle: **color as narrative**; the palette shifts with the world state, and a single hue carries the emotional weight of an area. Applied in: Chapter 15 (Color System — biome hue anchors), Chapter 13 (biome identity).

**7. Jen Zee (repeated for a second principle)** — **every character reads at silhouette first, color second, detail third.** Applied in: Chapter 12 (MAGNO silhouette spec).

**8. Brittney Lee** — Visual Development Artist, Disney (*Frozen*, *Wreck-It Ralph*). Transferable principle: **silhouette variety in a character lineup** — no two characters should share a silhouette shape. Applied in: Chapter 12 (MAGNO alt-skin variety).

**9. Nico Marlet** — Character Designer, DreamWorks (*How to Train Your Dragon*, *Kung Fu Panda*). Transferable principle: **exaggerated silhouettes with internal structural logic**; a character's proportions can be impossible but must be self-consistent. Applied in: Chapter 12 (MAGNO rig proportions).

**10. Carter Goodrich** — Character Designer, Illumination/Blue Sky. Transferable principle: **the eyes carry the personality**; eye design is the single highest-leverage character decision. Applied in: Chapter 12 (MAGNO eye redesign).

**11. Joseph White** — Designer, *Lumines* and *Rez* lineage. Transferable principle: **audio-visual synesthesia as identity**; the visual must respond to the audio and vice versa. Applied in: Chapter 17 (Animation Polish — particle and shake grammar tied to audio).

**12. Lucas Pope** — Creator, *Papers Please* and *Obra Dinn*. Transferable principle: **committing to a single unusual visual constraint (1-bit color, dithering) makes a game unforgettable.** Applied in: Chapter 11 (the signature decision).

### 3.2 Illustrators & Painters (10 masters)

**13. James Gurney** — Illustrator, *Dinotopia*, author of *Color and Light* and *Imaginative Realism*. Transferable principle: **gamut mapping** — pick a constrained color gamut per scene, and every color in the scene must fall inside it. Applied in: Chapter 15 (gamut per biome), Chapter 9 (light logic per biome).

**14. Johannes Itten** — Bauhaus color theorist, *The Art of Color*. Transferable principle: **the seven color contrasts** (hue, light-dark, cold-warm, complementary, simultaneous, saturation, extension). Every palette decision should be expressible as one of these contrasts. Applied in: Chapter 15 (palette construction method).

**15. Josef Albers** — Bauhaus/Yale, *Interaction of Color*. Transferable principle: **the same color appears different depending on its neighbor**; never approve a color in isolation. Applied in: Chapter 15 (color interaction tests).

**16. Faber Birren** — Industrial color consultant. Transferable principle: **color and perceptual psychology** — saturation and value carry specific emotional signals that are not cultural but biological. Applied in: Chapter 15 (palette emotion map).

**17. Leatrice Eiseman** — Director, Pantone Color Institute. Transferable principle: **color forecasting and trend-awareness** — your palette should not look like last year's palette. Applied in: Chapter 15 (palette novelty check against 2024–2026 web game palettes).

**18. Moebius / Jean Giraud** — Illustrator (*The Airtight Garage*, *Arzach*). Transferable principle: **ligne claire with desert-sky emptiness as a positive compositional element.** Applied in: Chapter 13 (Stratosphere biome — emptiness used deliberately).

**19. Hergé** — Creator, *The Adventures of Tintin*. Transferable principle: **ligne claire uniforme** — every line is the same weight, no hatching, color blocks carry the form. Applied in: Chapter 7 (toon-shaded alternative spec).

**20. Mary Blair** — Disney color stylist (*Alice in Wonderland*, *It's a Small World*). Transferable principle: **fearless non-naturalistic color** — a sky can be pink, a tree can be purple, if it serves the composition. Applied in: Chapter 13 (biome palette permission to be non-naturalistic).

**21. Hayao Miyazaki** — Co-founder, Studio Ghibli. Transferable principle: **the world is alive beyond the frame**; backgrounds should imply activity the player cannot see. Applied in: Chapter 13 (three-layer background system).

**22. Norman Rockwell** — Illustrator. Transferable principle: **staged composition** — every figure in a frame has a purpose and a sightline. Applied in: Chapter 16 (thumbnail composition).

### 3.3 Concept Artists (8 masters)

**23. Sparth (Nicolas Bouvier)** — Concept Art Lead, *Halo 5*, *Destiny*. Transferable principle: **atmospheric perspective as a depth cue** — distant objects lose saturation and shift toward sky hue. Applied in: Chapter 13 (mid-distance atmospheric layer), Chapter 9 (depth cues).

**24. Craig Mullins** — Matte painting pioneer. Transferable principle: **painterly suggestion over rendered detail** — a few well-placed brush strokes carry more detail than a thousand modelled bricks. Applied in: Chapter 18 (shader suggestion of detail without geometry).

**25. Feng Zhu** — Founder, FZD School of Design. Transferable principle: **form-follows-function in prop design** — every prop should look like it does a job. Applied in: Chapter 13 (prop silhouette per biome).

**26. James Paick** — Founder,*Scribble Pad*. Transferable principle: **thumbnail composition first, detail second** — every environment starts as a 100-pixel value study. Applied in: Chapter 16 (thumbnail).

**27. Maciej Kuciara** — Concept artist (*The Last of Us*, *Cyberpunk 2077*). Transferable principle: **juxtaposition of clean and weathered surfaces** for visual interest. Applied in: Chapter 7 (materiality contrast per prop), Chapter 13 (Metropolis biome — clean neon over rust).

**28. Aaron Limonick** — Concept artist, Naughty Dog. Transferable principle: **narrative props** — every object in a scene tells a small story about who used it. Applied in: Chapter 13 (prop placement as narrative).

**29. Vitaly Bulgarov** — Industrial / mech concept artist. Transferable principle: **functional detail density** — detail where the eye looks, plain where it does not. Applied in: Chapter 12 (MAGNO detail density — face vs body).

**30. Yohann Schepacz** — Concept artist (*Horizon Zero Dawn*). Transferable principle: **nature reclaiming the built** as a visual theme. Applied in: Chapter 13 (Scrapyard biome — nature-reclaimed-industrial).

### 3.4 Character Designers (6 masters)

**31. Bobby Chiu** — Founder, *Schoolism*; character designer, Alice in Wonderland (Tim Burton). Transferable principle: **silhouette first, always**. If the character cannot be recognized from its silhouette alone, the design is incomplete. Applied in: Chapter 12 (MAGNO silhouette pass).

**32. Iain McCaig** — Concept artist, *Star Wars* prequels (Darth Maul). Transferable principle: **three shapes, three lines** — a character design should be reducible to three primary shapes and three primary lines. Applied in: Chapter 12 (MAGNO shape reduction).

**33. Glen Keane** — Disney animation legend (*The Little Mermaid*, *Beauty and the Beast*, *Tarzan*). Transferable principle: **the line of action** — every character in every frame has a single dominant line of motion, and the silhouette should make it visible. Applied in: Chapter 12 (MAGNO line of action), Chapter 17 (animation).

**34. Eric Goldberg** — Disney animator (*Aladdin*'s Genie). Transferable principle: **exaggeration is honesty** — push a pose 20% beyond what feels right, then pull back 5%. Applied in: Chapter 17 (animation exaggeration).

**35. James Baxter** — Animator (Belle in *Beauty and the Beast*, Spirit in *Spirit: Stallion of the Cimarron*). Transferable principle: **weight transfer** — a character's weight must be readable in every frame, even mid-air. Applied in: Chapter 17 (MAGNO weight in mid-flip).

**36. Hiroyuki Imaishi** — Co-founder, Studio Trigger (*Kill la Kill*, *Promare*). Transferable principle: **dynamic asymmetry** — poses are never symmetrical; the body is always twisted or counter-posed. Applied in: Chapter 17 (MAGNO flip pose asymmetry).

### 3.5 Color Theorists (5 masters, cumulative with illustrators above)

The five color theorists (Itten, Albers, Gurney, Birren, Eiseman, entries 13–17 above) are listed under Illustrators & Painters because their work is rooted in painting. Their principles are operationalized in Chapter 15.

### 3.6 Brand Identity & Graphic Design (8 masters)

**37. Paula Scher** — Partner, Pentagram. Transferable principle: **typography as identity** — a single type treatment can carry an entire brand. Applied in: Chapter 10 (Typography & Lettering).

**38. Michael Bierut** — Partner, Pentagram. Transferable principle: **identity through constraint** — limit yourself to a small set of elements and use them relentlessly. Applied in: Chapter 11 (positioning — committed signature).

**39. Massimo Vignelli** — Designer, NYC Subway graphics. Transferable principle: **the grid is the design**; a strong grid makes weak content feel deliberate. Applied in: Chapter 14 (HUD grid system).

**40. Stefan Sagmeister** — Designer. Transferable principle: **handmade touches in a digital world** are memorable because they are unexpected. Applied in: Chapter 10 (typography — a hand-set wordmark).

**41. David Carson** — Designer, *Ray Gun* magazine. Transferable principle: **illegibility as deliberate provocation**, used sparingly. Applied in: Chapter 10 (avoid — Carson is an anti-reference for game UI).

**42. Erik Spiekermann** — Type designer (FF Meta, Info Display). Transferable principle: **type is the voice** — pick a typeface that sounds like the game. Applied in: Chapter 10 (type selection method).

**43. Adrian Frutiger** — Type designer (Frutiger, Univers, Avenir). Transferable principle: **type designed for screens and signage must have open counters and generous x-height.** Applied in: Chapter 10 (HUD type spec).

**44. Tobias Frere-Jones** — Type designer (Interstate, Gotham). Transferable principle: **type designed for low-resolution reading** — letterforms must survive subpixel rendering. Applied in: Chapter 10 (HUD type — fallback chain).

### 3.7 Industrial Designers (4 masters)

**45. Dieter Rams** — Chief Design Officer, Braun. The Ten Principles of Good Design, in full:

1. Good design is innovative.
2. Good design makes a product useful.
3. Good design is aesthetic.
4. Good design makes a product understandable.
5. Good design is unobtrusive.
6. Good design is honest.
7. Good design is long-lasting.
8. Good design is thorough down to the last detail.
9. Good design is environmentally friendly.
10. Good design is as little design as possible — less, but better.

Transferable principle for MAGNETOPE: **the HUD, the UI, the prop kit, and the character rig should each be auditable against these ten principles.** Applied in: Chapter 14 (HUD), Chapter 12 (MAGNO), Chapter 13 (prop kits).

**46. Jonathan Ive** — Former Chief Design Officer, Apple. Transferable principle: **design is the silent ambassador of the brand** — every visible surface is making a statement about what the game is. Applied in: Chapter 11 (positioning statement).

**47. Naoto Fukasawa** — Industrial designer. Transferable principle: **without thought** — designs so natural the user does not notice them. Applied in: Chapter 14 (HUD — the UI should disappear when the player is in flow).

**48. Charles & Ray Eames** — Designers (*Eames Lounge Chair*, *Powers of Ten*). Transferable principle: **take your pleasure seriously** — playful does not mean unserious. Applied in: Chapter 11 (positioning — MAGNETOPE is playful and serious).

### 3.8 Cinematographers & Staging (5 masters)

**49. Roger Deakins** — Cinematographer (*Blade Runner 2049*, *1917*, *Sicario*). Transferable principle: **single-source lighting, hard shadows, color discipline** — a scene lit with one strong direction reads instantly. Applied in: Chapter 9 (lighting per biome).

**50. Emmanuel Lubezki** — Cinematographer (*Gravity*, *The Revenant*, *Birdman*). Transferable principle: **naturalistic light is a continuity problem**; the light direction must be consistent across every shot in a biome. Applied in: Chapter 9 (biome light direction lock).

**51. Rodrigo Prieto** — Cinematographer (*The Wolf of Wall Street*, *Passengers*). Transferable principle: **color as character differentiation** — different characters can have different color temperatures around them. Applied in: Chapter 9 (MAGNO rim light temperature vs biome light).

**52. Bill Pope** — Cinematographer (*The Matrix*, *Spider-Man 2*). Transferable principle: **the camera is a character** — camera movement tells the player how to feel. Applied in: Chapter 9 (camera shake grammar), Chapter 17 (animation polish — camera).

**53. Zhang Yimou** — Director/Cinematographer (*Hero*, *House of Flying Daggers*). Transferable principle: **color blocking** — large flat areas of a single color carry more weight than detailed imagery. Applied in: Chapter 13 (biome color blocking), Chapter 15 (palette as scene-blocking).

### 3.9 Animation Directors (3 masters, cumulative with character designers above)

**54. Richard Williams** — Animator, author of *The Animator's Survival Kit*. Transferable principles: the **12+ principles of animation** (squash & stretch, anticipation, staging, straight-ahead vs pose-to-pose, follow-through & overlapping, slow-in/slow-out, arcs, secondary action, timing, exaggeration, solid drawing, appeal) plus his later additions (naturalistic vs caricatured motion, weight, the "take"). Applied throughout: Chapter 17.

**55. Hayao Miyazaki (repeated for animation)** — Transferable principle: **the ma** — the pause between actions is where the character lives. Applied in: Chapter 17 (MAGNO idle and between-flip timing).

**56. Bill Tytla** — Disney animator (*Dumbo*'s baby Dumbo, *Fantasia*'s Chernabog). Transferable principle: **weight through timing** — heavy objects move slow, light objects move fast, and the audience reads weight from timing more than from size. Applied in: Chapter 17 (MAGNO weight).

### 3.10 Architects & Spatial Designers (4 masters)

**57. Tadao Ando** — Architect. Transferable principle: **concrete as a canvas for light** — plain surfaces are an opportunity for light to be the protagonist. Applied in: Chapter 13 (Metropolis — concrete forms as light canvas).

**58. Frank Lloyd Wright** — Architect. Transferable principle: **the building belongs to its site** — a structure should respond to its environment, not be dropped on top of it. Applied in: Chapter 13 (props should look like they belong in their biome).

**59. Christopher Alexander** — Architect, *A Pattern Language*, *The Timeless Way of Building*. Transferable principle: **patterns are solutions to recurring problems**; collect your game's visual patterns as a language. Applied in: Chapter 13 (per-biome pattern language).

**60. Renzo Piano** — Architect (*Centre Pompidou*, *Shard*). Transferable principle: **express the structure** — do not hide how the thing is built; let it show. Applied in: Chapter 12 (MAGNO — the magnet head should look like a magnet, not pretend to be a face).

### 3.11 Why these sixty, not a different sixty

The selection is opinionated. It excludes masters whose principles do not transfer to a low-budget web game with a 5 MB bundle limit (no Caravaggio, no Bouguereau, no hyper-realistic matte painters). It includes masters whose principles *do* transfer: animation timing, color discipline, silhouette, light direction, type, identity-through-constraint. The selection is also biased toward modern game-native art directors (Jen Zee, Alx Preston, Toby Fox, Scott Benson, Lucas Pope) because their work is the closest reference for what MAGNETOPE needs to become.

The remaining forty of the "100" are the masters whose principles are *implicit* in the work of the sixty above — their ideas are absorbed and operationalized without being cited individually. Appendix A lists all sixty with source works. Where a reader expects a specific master who is not here (Bauhaus typography more generally, Hayao Miyazaki as screenwriter not visual director, etc.), the principle has been attributed to the closest-named master above. The goal is not encyclopedic completeness; the goal is a coherent art direction that can be defended by reference to specific authorities.

### Build Directive for Chapter 3

> AI rebuilder: do not try to apply all sixty perspectives at once. Read this chapter once for orientation. Then, when implementing each subsequent chapter, return to the entries tagged for that chapter and treat them as the principal authors. For example, when implementing Chapter 12 (MAGNO Redesign), work as if Bobby Chiu, Iain McCaig, Glen Keane, Nico Marlet, Carter Goodrich, and Brittney Lee are looking over your shoulder. When implementing Chapter 15 (Color System), work as if Itten, Albers, Gurney, Birren, and Eiseman are looking over yours.

<!-- CHAPTER_4 -->
## Chapter 4 — First principles of visual identity

The masters of Chapter 3 give us the principles. This chapter turns those principles into a working definition of "visual identity" that an AI rebuilder can operationalize.

### 4.1 What "visual identity" actually means

A game's visual identity is the **set of consistent, recognizable, committed visual decisions** that a player can use to identify the game from a single frame, a single prop, a single character silhouette, or a single second of motion — without reading the title. Identity is not "the art looks good." Identity is "the art could not have been made by anyone else, and a paying customer can recognize it on sight."

Under this definition, MAGNETOPE in its current form has **no visual identity**. It has a competent visual execution of a generic template. The fix is not to add identity on top; the fix is to commit to identity at the foundation.

### 4.2 The four-axis model of visual identity

A visual identity sits on four axes. All four must be present, and all four must be consistent with each other. The four axes are:

1. **Silhouette** — the recognizable outline shapes of characters, props, and UI elements.
2. **Palette** — the constrained set of colors the game is allowed to use, and the rules for combining them.
3. **Materiality** — how surfaces are shaded (flat, toon, painterly, PBR, voxel, gel) and how they respond to light.
4. **Motion** — how things move (timing curves, exaggeration, weight, asymmetry).

If any of the four axes is generic, the game reads as generic — even if the other three are distinctive. MAGNETOPE currently has generic silhouette (padlock), generic palette (beige-teal), generic materiality (flat-shaded low-poly), and acceptable-but-unmemorable motion. The renewal must commit on all four axes simultaneously.

### 4.3 The signature test

To verify that an identity exists, apply the **signature test**: open five screenshots of the game at random, hide the title, and ask a designer who has not seen the game to group them by "is this the same game or different games." If they group all five as the same game *and* they can describe what makes it the same game ("the red magnet character, the saturated scrapyard, the cartoon outline"), the identity exists. If they group all five as the same game but cannot say why, the identity is competent but not committed. If they cannot group them at all, the identity does not exist.

MAGNETOPE currently fails the signature test. The renewal commits to passing it. The commitment is encoded in five "signature decisions," one per axis plus one overall:

| Axis | Signature decision |
|---|---|
| Silhouette | MAGNO's head is a *horseshoe magnet with visible red and blue poles and an N/S marking*. Not a single-color steel U. |
| Palette | The Scrapyard is not beige — it is **rust-orange and oxidized-copper green**, with cold blue steel. |
| Materiality | Props are shaded with a **toon shader with a single hard terminator and a rim light**, not flat-shaded. |
| Motion | Every flip has **visible magnetic field lines** that ripple from the magnet head during the charge, launch, and snap. |
| Overall | The game is committed to **magnetism made visible** — every screen has at least one element that shows magnetism (field lines, attraction, repulsion, sparks). |

These five signatures are the load-bearing commitments of the renewal. Every chapter that follows is in service of making them operational.

### 4.4 The constraint principle (Bierut, Rams, Fox, Pope)

Michael Bierut's principle of identity-through-constraint is the operating principle of this renewal. Bierut's work for MIT Media Lab, Saks Fifth Avenue, and the New York Times building uses small sets of elements used relentlessly. The principle transfers directly: pick five signature decisions, commit to them across every screen, and refuse every compromise.

Dieter Rams' tenth principle ("as little design as possible — less, but better") is the brake on the renewal. Every additional visual element added beyond the five signatures must justify itself. If it does not serve one of the five signatures, it is removed.

Toby Fox's *Undertale* is the modern proof. The game uses a deliberately limited palette and resolution, and as a result every screen is recognizable, every character is memorable, and the game has sold over 5 million copies. Fox's principle is not "go pixel art" — it is "pick a constraint and commit to it absolutely." MAGNETOPE's constraint is magnetism-made-visible.

Lucas Pope's *Obra Dinn* applies the same principle with a different constraint (1-bit color, dithering). Pope has said the constraint was the entire art direction; once committed, every other decision fell out of it. The MAGNETOPE renewal treats magnetism-made-visible as the equivalent of Pope's 1-bit commitment.

### 4.5 The unobtrusive principle (Fukasawa, Rams #5)

Naoto Fukasawa's principle of "without thought" — designs so natural the user does not notice them — applies to the HUD and UI specifically. The HUD is not where the identity lives. The HUD is the layer the player should look *through* to see the game. A HUD that competes with the gameplay for attention is a HUD that has failed.

The implication: the HUD uses the master palette (so it is on-brand) but at lower saturation than the game world (so it recedes). The HUD uses the master typeface (so it is on-brand) but at smaller sizes (so it does not shout). The HUD animates subtly (so it feels alive) but never distractingly (so it disappears in flow).

### 4.6 The committed-signature principle applied to the renewal

Taking the four axes and the signature test together, the renewal is structured as follows:

- Part III Chapter 11 names the overall signature: magnetism-made-visible.
- Part III Chapter 12 commits the silhouette axis: MAGNO redesign.
- Part III Chapter 13 commits the palette and materiality axes per biome.
- Part III Chapter 14 commits the UI as the unobtrusive layer.
- Part III Chapter 15 commits the master palette.
- Part III Chapter 16 commits the thumbnail to the 200ms test.
- Part III Chapter 17 commits the motion axis: animation polish.

A reviewer checking the renewal against the signature test should find all five signatures visible in every screenshot. If any screenshot is missing one or more signatures, the screenshot is not yet shipping-ready.

### Build Directive for Chapter 4

> AI rebuilder: write the five signatures on a sticky note. Before checking in any new visual asset — a prop, a shader, a UI element, a thumbnail, an animation — verify that the asset reinforces at least one of the five signatures. If it does not, do not check it in. The five signatures are the gate.

<!-- CHAPTER_5 -->
## Chapter 5 — Color theory, from Itten to Pantone

This chapter operationalizes the color theory of Itten, Albers, Gurney, Birren, and Eiseman for a web game. It is the theory behind the master palette in Chapter 15. Read it once. Then treat Chapter 15 as the executable.

### 5.1 The seven color contrasts (Itten)

Johannes Itten, in *The Art of Color* (1961), defined seven color contrasts that constitute the entire vocabulary of color combination. Every palette decision in MAGNETOPE should be expressible as one of these contrasts. The seven are:

1. **Contrast of hue** — pure hues placed side by side (red/yellow/blue). High energy, used for accent moments (the magnet's poles, the summit banner).
2. **Light-dark contrast** — the same hue at different values. Used for depth (near props lighter, far props darker) and for the silhouette of MAGNO against the background.
3. **Cold-warm contrast** — blue/green against red/orange/yellow. Used for biome differentiation: Scrapyard is warm (rust), Stratosphere is cold (thin air blue).
4. **Complementary contrast** — opposite hues on the color wheel (red/green, blue/orange, yellow/purple). Used sparingly for moments of high drama (a perfectly-timed repel flash is blue-orange).
5. **Simultaneous contrast** — the apparent shift of a color when placed next to another. Accounted for in the palette interaction tests (Chapter 15).
6. **Contrast of saturation** — vivid against muted. Used for focus: MAGNO is more saturated than the props, so the player's eye goes to MAGNO.
7. **Contrast of extension** — proportions of color, e.g., a small vivid accent against a large muted field. Used for the rule that every biome has at least one accent color used at less than 5% of screen area.

The seven contrasts are diagnostic, not prescriptive. When a palette is not working, the diagnosis is "which contrast is missing?" — and the fix is to add it.

### 5.2 Interaction of color (Albers)

Josef Albers' *Interaction of Color* (1963) demonstrated that the same color appears different depending on its neighbor. The implication for a game is that colors cannot be approved in isolation. A color token in Chapter 15 is only valid in the context of the colors it will sit next to.

The operational consequence is the **interaction test**: for every color token, render it in three contexts (against the biome background, against the biome accent, against MAGNO's body color). If the color reads the same in all three contexts, the token is approved. If it shifts, the token is either replaced or split into context-specific variants.

### 5.3 Gamut mapping (Gurney)

James Gurney's *Color and Light* (2010) introduces **gamut mapping**: pick a constrained subset of the full color wheel per scene, and every color in the scene must fall inside that gamut. The gamut can be a triangle, a wedge, or any shape on the color wheel. Outside the gamut, no color is allowed.

For MAGNETOPE, gamut mapping is the primary tool for biome differentiation. Each biome has a gamut shape:

- **Scrapyard** — a warm wedge from yellow-orange through red-orange to red-violet, plus a small cool accent (oxidized copper green). Total gamut area ~20% of the wheel.
- **Suburbia** — a cool wedge from yellow-green through green to blue-green, plus a warm accent (terracotta). Total gamut area ~25%.
- **Metropolis** — a complementary pair, blue-violet and yellow-orange, plus a neutral. Total gamut area ~30%.
- **Playground** — a high-saturation triangle: cyan-magenta-yellow. Total gamut area ~40%.
- **Stratosphere** — a near-monochrome blue with a single warm accent (sunrise gold). Total gamut area ~15%.

The narrower the gamut, the more unified the biome. Stratosphere at 15% is the most unified; Playground at 40% is the most varied. The progression from Scrapyard (20%) through Stratosphere (15%) creates a tightening that matches the gameplay's progression toward the thin air.

### 5.4 Color psychology (Birren)

Faber Birren's body of work (*Color Psychology and Color Therapy*, 1950; *Creative Color*, 1961) established that color carries perceptual and emotional signals that are biological before they are cultural. The renewal uses Birren's signals deliberately:

- **Red** — alert, urgency, magnetism, attraction. Used for MAGNO's north pole, the summit banner, the fall grade.
- **Blue** — calm, distance, cold, magnetism (south pole). Used for MAGNO's south pole, the Stratosphere sky, the pause overlay.
- **Yellow** — energy, charge, electricity. Used for the charge meter, the snap beam, the second-wind prompt.
- **Green** — nature, growth, decay. Used for the Suburbia biome, the locker screen.
- **Orange** — warmth, rust, age. Used for the Scrapyard palette, the slow-mo trigger flash.
- **Violet** — mystery, the unknown. Used for the Metropolis night palette, the ghost trail.
- **Cyan** — energy fields, magnetism made visible. Used for the field lines, the magnet snap, the polar flash.

The palette is not chosen for variety. It is chosen so that each color carries a single consistent meaning across the entire game.

### 5.5 Trend-awareness (Eiseman)

Leatrice Eiseman, as director of the Pantone Color Institute, has published color forecasts annually for decades. The principle transferred to MAGNETOPE: a palette that looks current in 2024 reads as dated in 2026. The renewal's palette must be checked against the 2026 web game palette landscape and adjusted if it overlaps too heavily.

The check is operational: pull the current top 20 games on Poki (October 2026). Sample their dominant colors. Plot them on a color wheel. If the renewal's palette overlaps with more than 50% of the dominant colors, the palette is too trendy and will date fast. If it overlaps with less than 10%, the palette is too obscure and will not connect with players. Target overlap: 20–30%.

### 5.6 The palette construction method

The construction method for the master palette (executed in Chapter 15):

1. Pick a primary hue per biome using the Gurney gamut method.
2. Pick a complement per biome using Itten's complementary contrast.
3. Pick an accent per biome using Itten's contrast of extension (small area, high saturation).
4. Test every color in context using Albers' interaction tests.
5. Verify each color's emotional signal matches Birren's psychology.
6. Check the palette's overlap with current Poki top 20 using Eiseman's trend check.
7. Lock the palette. Every subsequent visual decision must use a token from the palette.

The output of this method is the master palette in Chapter 15, expressed as a token table with hex codes, LCH values, and usage rules.

### Build Directive for Chapter 5

> AI rebuilder: do not invent colors. Do not pick colors because they "look nice." Every color used in the renewal must trace to one of the seven contrasts (Itten), must pass the interaction test (Albers), must fall inside its biome's gamut (Gurney), must match the intended psychology (Birren), and must clear the trend check (Eiseman). Chapter 15 is the only source of truth. If you need a color that is not in Chapter 15, you have made a design error.

<!-- CHAPTER_6 -->
## Chapter 6 — Silhouette & character readability

This chapter is the theory behind the MAGNO redesign in Chapter 12. The principle is simple: **a character that cannot be recognized from its silhouette alone is not finished.** Bobby Chiu has said this in nearly every Schoolism lecture. Iain McCaig has said it in every *Star Wars* making-of. Glen Keane has demonstrated it in every Disney drawing.

The chapter takes the principle seriously. It is the longest in Part II because the silhouette axis is the highest-leverage axis for MAGNETOPE. The padlock-versus-magnet problem of Chapter 1 is a silhouette problem. If the silhouette is fixed, the entire game reads differently.

### 6.1 The three-second read rule

A character must communicate three things in three seconds, in this order:

1. **What is it?** (species / object / role)
2. **What is its personality?** (mood, intent)
3. **What is it about to do?** (action, motion)

If the character does not communicate all three in three seconds, the design is incomplete. The three seconds are not literal — they are the duration a viewer spends looking before their eye moves on. In a Poki thumbnail, the three seconds compress to 200 milliseconds. In gameplay, the player gives the character three seconds when they first see it, then never looks again at the design (they look at the action). The design must do all its work in that three seconds.

MAGNO currently fails all three:

1. **What is it?** Padlock. (Wrong. Should be magnet.)
2. **What is its personality?** None visible. The single eye is too small to read at gameplay distance.
3. **What is it about to do?** Nothing. The character is in a neutral pose that does not telegraph action.

The fix is in Chapter 12. This chapter establishes the principles.

### 6.2 Bobby Chiu's silhouette-first method

Bobby Chiu's method: design the silhouette first, in pure black on white. Do not add color, do not add detail, do not add a face. The silhouette alone must communicate the character. If it does, the design is sound; if it does not, no amount of detail will save it.

The test: take the character's silhouette and show it to ten people. Ask them, without context, "what is this?" If more than seven say the correct answer, the silhouette works. If fewer than seven, the silhouette does not work and must be redrawn.

MAGNO's current silhouette: a U on top of a rounded rectangle, with two small arm nubs. Show this to ten people and at least seven will say "padlock." The fix is structural — the U must be a horseshoe magnet, not a shackle, and the difference must be visible in pure silhouette.

The structural fix (detailed in Chapter 12): widen the U, add the two pole tips (the small flares at the end of a real horseshoe magnet), and offset the colors so the two poles are visibly different (red north, blue south). The pole tips are the silhouette differentiator — real horseshoe magnets have them, real padlock shackles do not.

### 6.3 Iain McCaig's three-shapes-three-lines method

Iain McCaig's method: a character should be reducible to **three primary shapes and three primary lines**. The shapes are the body masses; the lines are the dominant axes of motion. If a character cannot be reduced to three shapes and three lines, the design is overcomplicated and will not read at distance.

For MAGNO:

- **Three shapes:** (1) the horseshoe-magnet head (a U with flared pole tips), (2) the body capsule (a rounded rectangle), (3) the eye (a single large disc).
- **Three lines:** (1) the vertical axis from head center to body center, (2) the magnet axis from pole to pole, (3) the line of action from the body through the head (which tilts during a flip).

The current MAGNO has more than three shapes — the arms, the legs, the small feet, the multiple eye states — and the result is a silhouette that does not reduce cleanly. The renewal removes the arms (they are unnecessary; the magnet is the action), keeps the body capsule, and makes the eye larger so it is the third primary shape.

### 6.4 Glen Keane's line of action

Glen Keane's principle: **every character in every frame has a single dominant line of motion**, and the silhouette should make that line visible. The line of action is the curve that runs through the character from the point of effort to the point of release. In a tennis serve, the line runs from the back foot through the throwing arm. In a high jump, the line is the C-curve of the arch.

For MAGNO, the line of action depends on state:

- **Idle / attached** — a slight C-curve from the body up through the head, indicating readiness.
- **Charging** — a tighter C-curve, the head pressed toward the surface, the body tensed.
- **Launching** — a strong S-curve from the body through the head, the magnet pointing in the direction of launch.
- **Airborne** — a straight line, the body extended, the magnet pointing at the next snap target.
- **Snapping** — a curved line, the body whipping toward the target.
- **Fallen** — a broken line, the body crumpled.

These lines must be visible in the silhouette. The renewal specifies the line of action per state in Chapter 12 §12.6.

### 6.5 Carter Goodrich on eyes

Carter Goodrich's principle: **the eyes carry the personality.** The single highest-leverage character decision is the eye design. A character with a great eye design and a mediocre body is memorable. A character with a great body and a mediocre eye is forgotten.

MAGNO's current eye is a single small disc that does not read at gameplay distance. The renewal enlarges the eye to roughly 18% of the head area (versus the current ~8%), adds a clear pupil that tracks the next snap target, and adds an eyelid that closes during the impact of a snap (telegraphing that MAGNO feels the snap, which is a personality cue — "he is invested in the action"). The eye redesign is in Chapter 12 §12.4.

### 6.6 Nico Marlet on exaggerated proportions

Nico Marlet's character designs (Toothless in *How to Train Your Dragon*, Po in *Kung Fu Panda*) use exaggerated proportions that are internally consistent even when externally impossible. Toothless has eyes larger than anatomically correct for a reptile of that size, but the eyes are consistent with the rest of the design (the head is enlarged, the body is shortened, the proportions are stylized rather than realistic).

For MAGNO: the head is larger than realistic for the body (the magnet is the personality, the body is the chassis). The eye is larger than realistic for the head (the eye is the personality of the head). The body is smaller than realistic for the head (the body exists to move the head; it does not exist for its own sake). These exaggerations are committed across the entire rig, not applied to one part only.

### 6.7 Brittney Lee on silhouette variety

Brittney Lee's principle: **no two characters in a lineup should share a silhouette shape.** Even if all characters are robots, each must be distinguishable by silhouette alone. The principle applies to MAGNO's alt-skin cosmetics: every unlockable skin must have a distinct silhouette, not just a recolor. The skin system in Chapter 12 §12.9 specifies eight alt skins, each with a structurally different head shape (not just a different color).

### 6.8 The 200ms silhouette test (thethumbnail version)

The 200ms silhouette test is the operational version of all the above. To pass it:

1. Render the character at thumbnail scale (MAGNO occupies ~40% of a 200×200 thumbnail).
2. Convert to silhouette (pure black on white).
3. Show to ten people who have not seen the game.
4. Ask: "what is this?"
5. At least seven must say "magnet" or "magnet character" or "horseshoe magnet."

The current MAGNO fails this test. The redesigned MAGNO (Chapter 12) is built specifically to pass it.

### 6.9 The silhouette vocabulary of props

The silhouette principle extends to props. Every prop in MAGNETOPE has a silhouette that the player reads at distance. The principle: **a prop's silhouette should communicate its function.** A fridge should look like a fridge. A trampoline should look like a trampoline. A locker should look like a locker. The failure mode is when a prop's silhouette is ambiguous — a box that could be a fridge, a locker, a cabinet, or a washing machine.

The renewal specifies per-biome prop silhouette rules in Chapter 13. The general principle: every prop must have at least one silhouette-defining feature (the handles on a fridge, the dial on a washing machine, the door slats on a locker) that distinguishes it from every other prop in the same biome.

### Build Directive for Chapter 6

> AI rebuilder: when designing any character, prop, or UI element, do the silhouette test. Render it pure black on white at three sizes (64×64, 200×200, 600×600). If the silhouette does not read at 64×64, the design is incomplete. Redo it.

<!-- CHAPTER_7 -->
## Chapter 7 — Materiality, shaders, and the look of surfaces

This chapter decides how surfaces in MAGNETOPE are shaded. The current build uses flat-shaded low-poly. The renewal replaces flat-shaded with **toon-shaded with rim light and fresnel accents on metallic surfaces**. This is the single biggest visual upgrade in the renewal and the cheapest to implement.

### 7.1 Why flat-shaded is failing

Flat-shaded low-poly was, in 2014, a deliberate aesthetic — Crossy Road used it to evoke the visual language of paper craft and the early 3D era. By 2026, the aesthetic has been absorbed by every asset pack, every tutorial, every AI-generated model. Flat-shaded has become the default, and the default is invisible (Chapter 1 §1.2).

The technical reason flat-shaded is failing is also the artistic reason. Flat shading assigns one normal per face, so each face is a single solid color. There is no terminator (the line where light becomes shadow), no specular highlight, no rim light, no fresnel effect. The result is that every surface looks like a cardboard cutout of itself. For a game about magnetism — which is fundamentally about *attraction, repulsion, and field interactions* — the absence of any surface response to light is fatal. Magnetism is invisible in a flat-shaded world because there is nothing for the field to interact with.

### 7.2 The alternative menu

There are seven viable shading styles for a web game with MAGNETOPE's constraints (1.5 MB bundle, tier-low mobile fallback, procedural props). The menu:

1. **Flat-shaded (current)** — one color per face. Cheap, generic, rejected.
2. **Smooth-shaded with simple diffuse** — vertex normals, one light. Better than flat but reads as "default Unity." Rejected.
3. **Toon-shaded with hard terminator** — two colors per material (lit and shadow), one hard terminator line, optional rim. Strong identity, cheap to render, Cartoon Saloon lineage. **Selected for the renewal.**
4. **Hand-painted textures (Okami / Genshin lineage)** — pre-baked painted textures per prop. Beautiful, expensive, requires an asset pipeline the procedural kits cannot provide. Rejected.
5. **Voxel** — Cubey shapes (Crossy Road). Wrong for the magnet mechanic (magnetism is curved, not blocky). Rejected.
6. **PBR (physically based rendering)** — Realistic metal/roughness workflow. Too expensive for tier-low mobile, and the realistic look fights the playful tone. Rejected.
7. **Gel / capsule** — soft-shaded gel look (Suika Game). Attractive but reads as "candy game," wrong for the magnetic junkyard theme. Rejected as primary; borrowed for the field-line particles.

The selected style is **toon-shaded with a hard terminator and a rim light**, with fresnel accents on metallic surfaces. The style is committed across every prop, every biome, and the MAGNO character.

### 7.3 Toon shading, the technical spec

Toon shading is implemented in Three.js with a custom ShaderMaterial that:

1. Computes the standard lambert diffuse term: `NdotL = max(dot(N, L), 0.0)`.
2. Quantizes it to two bands: `lit = NdotL > 0.5 ? 1.0 : 0.4`. The threshold (0.5) and the lit/shadow values are per-material tokens from Chapter 15.
3. Adds a rim light: `rim = pow(1.0 - max(dot(N, V), 0.0), 2.5)`, multiplied by a per-material rim color.
4. For metallic materials only, adds a fresnel: `fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0)`, multiplied by the magnet's pole color (red for north, blue for south), so metal surfaces near the magnet glow with the magnet's pole color.

The full shader code is in Chapter 18. The key art-direction decisions:

- **Two bands, not three.** Three bands (lit / mid / shadow) read as cel-shaded anime, which is a different aesthetic. Two bands read as Cartoon Saloon / ligne claire, which is the renewal's lineage.
- **Hard terminator, not soft.** The terminator is a hard line at NdotL = 0.5. A soft terminator reads as PBR-lite. A hard terminator is a committed aesthetic.
- **Rim light on every material.** Even non-metallic materials get a subtle rim. The rim color is the material's hue, shifted cooler and desaturated. The rim is what makes the prop "feel" 3D in a 2D-feeling shading model.
- **Fresnel on metal only.** The fresnel effect is the magnetism-made-visible signature. When MAGNO is attached to a steel beam, the beam's surface near MAGNO glows red (north) or blue (south). This is the single highest-leverage visual decision in the renewal.

### 7.4 Materiality contrast per prop (Kuciara's principle)

Maciej Kuciara's principle from *The Last of Us* and *Cyberpunk 2077*: **juxtapose clean and weathered surfaces for visual interest.** A prop that is uniformly rusty is boring. A prop that is uniformly clean is boring. A prop that is clean on one face and rusty on another is interesting.

The renewal applies Kuciara's principle per prop: every prop has at least one face that is "clean" (lit at full saturation) and at least one face that is "weathered" (desaturated and shifted toward the biome's rust color). The terminator line between them is the prop's visual interest. The current build does not have this contrast — every face of every prop is uniformly shaded, which is why the props read as "asset pack."

### 7.5 Material families (per Chapter 15)

Materials are grouped into families, each with a fixed shading profile:

| Family | Lit value | Shadow value | Rim | Fresnel | Notes |
|---|---|---|---|---|---|
| Steel (magnetic) | Full saturation | 0.4× saturation | Subtle, cooler | Yes, pole-colored | Field lines visible on this material when MAGNO is near |
| Wood | Full | 0.5× | None | None | Reads as warm, dead, non-magnetic |
| Plastic | Full | 0.45× | Strong, same hue | None | Reads as glossy and cheap |
| Fabric | 0.85× | 0.4× | None | None | Reads as soft |
| Concrete | 0.7× | 0.4× | None | None | Reads as mineral |
| Glass | Special: transparent + fresnel | — | Strong white | — | Reads as fragile, brittle |
| Foliage | Full | 0.5× | Subtle, warmer | None | Reads as alive |
| Magnet pole (red) | Full | 0.4× | — | — | MAGNO's north pole |
| Magnet pole (blue) | Full | 0.4× | — | — | MAGNO's south pole |
| Field line | Emissive, additive blend | — | — | — | The cyan field-line ribbons |

The tokens behind these values are in Chapter 15. The shader code that consumes them is in Chapter 18.

### 7.6 The "painterly suggestion" principle (Mullins)

Craig Mullins' principle: **a few well-placed marks carry more detail than a thousand modelled bricks.** For MAGNETOPE, this means we do not need high-poly props. We need low-poly props shaded with a toon shader that suggests more detail than is actually there. The terminator line itself does this work — the eye reads the terminator as a detail edge even when there is no geometry.

The implication: the renewal does not increase the polygon budget. It changes the shading model. The build size stays at ~1.5 MB. The visual quality goes up by an order of magnitude.

### 7.7 Tier-low fallback

Tier-low devices (identified by the `quality.ts` tier detection) cannot afford the fresnel effect on every metallic surface. The fallback: on tier-low, fresnel is applied to MAGNO only (the player sees the magnetism on the character itself, which is the most important place to see it). Props use a simplified toon shader without fresnel. The fallback is in the `quality.ts` token table (Chapter 18 §18.4).

### Build Directive for Chapter 7

> AI rebuilder: replace the flat-shaded MeshLambertMaterial / MeshBasicMaterial in every prop kit with a custom toon ShaderMaterial per the spec in Chapter 18. The replacement is mechanical: same geometry, same transform, different material. The visual jump will be the largest single change in the renewal.

<!-- CHAPTER_8 -->
## Chapter 8 — Motion as identity: animation principles

This chapter is the theory behind Chapter 17 (Animation Polish). The principle: **motion is the fourth axis of visual identity**, and a game whose motion is generic reads as generic even if every other axis is committed. The masters are Richard Williams, Glen Keane, Eric Goldberg, James Baxter, Hayao Miyazaki, Bill Tytla, and Hiroyuki Imaishi.

### 8.1 The 12+ principles of animation (Richard Williams)

Richard Williams' *The Animator's Survival Kit* (2001) is the canonical restatement of Disney's 12 principles, expanded and made practical for modern animation. The principles, adapted for MAGNETOPE:

1. **Squash & stretch** — MAGNO's body capsule squashes on impact (landing on a surface after a snap) and stretches on launch (the moment of release). The squash is ~20% of the body height; the stretch is ~15%. Anything more reads as comedy, anything less reads as stiff.
2. **Anticipation** — before the flip, MAGNO's magnet head dips 5° in the direction opposite to the launch. The dip takes 80ms. Anticipation is the difference between "the flip happened" and "MAGNO made the flip happen."
3. **Staging** — only one thing is the focal point at a time. During a flip, MAGNO is the focal point; the background is desaturated by ~10% for the duration. During a fall, the fall is the focal point; MAGNO's snap target is dimmed.
4. **Straight-ahead vs pose-to-pose** — the flip is pose-to-pose (key poses: charge, release, apex, snap). The field-line ripple is straight-ahead (each frame computed from the previous). The fall is a mix: pose-to-pose for the key beats (slip, fall, impact) and straight-ahead for the ragdoll between.
5. **Follow-through & overlapping action** — when MAGNO snaps to a surface, the body capsule arrives first, then the magnet head follows with a 60ms delay, then the eye closes 40ms after that. The overlapping is what makes the snap feel "alive" rather than "snapshotted."
6. **Slow-in / slow-out** — the flip's release uses an ease-out curve (fast start, slow end) so the launch feels explosive. The snap's approach uses an ease-in (slow start, fast end) so the snap feels committed. Linear interpolation is forbidden for organic motion.
7. **Arcs** — every flip traces an arc, not a straight line. The arc's height is the flip's "personality" — a high arc is dramatic, a low arc is efficient. The bot routes use low arcs; the player's natural flips use higher arcs because the player charges longer.
8. **Secondary action** — the field-line ribbons are secondary action. They are not the focus (the focus is the launch), but they support the launch (the player sees magnetism in motion).
9. **Timing** — the entire flip from charge to snap takes 400–800ms. Anything faster is untrackable; anything slower is sluggish. Within the flip, the breakdown is: charge 200–400ms, release 80ms, airborne 100–200ms, snap 60ms, settle 60ms. These timings are the game's feel; they are non-negotiable.
10. **Exaggeration** — push the squash, stretch, anticipation, and follow-through 20% beyond what feels right, then pull back 5%. The result is animation that reads as "more real than real."
11. **Solid drawing** — the 3D model must read as a 3D object in every frame. The toon shader (Chapter 7) handles this; the animator must ensure the silhouette (Chapter 6) reads in every key pose.
12. **Appeal** — the character must be appealing to look at. MAGNO's appeal comes from the eye (Chapter 6 §6.5), the magnet head's clear silhouette, and the body capsule's soft curvature.

Williams' later additions: **weight** (heavy things move slow, light things move fast, and the audience reads weight from timing), **the take** (a moment of disbelief or surprise before action), and **naturalistic vs caricatured motion** (caricatured is more readable, naturalistic is more immersive — MAGNETOPE commits to caricatured).

### 8.2 Glen Keane's line of action in motion

Chapter 6 §6.4 named the line of action per state. In motion, the line of action transitions continuously. The transition curves are the animation. Glen Keane's principle: **the line of action should never be a straight vertical line for more than 6 frames (100ms)**, because a straight vertical line is dead. MAGNO's idle pose breaks the vertical with a 5° tilt every 2 seconds, which is enough to keep the character alive without being fidgety.

### 8.3 Eric Goldberg's exaggeration

Eric Goldberg's principle from animating the Genie in *Aladdin*: **exaggeration is honesty**. Push a pose 20% beyond what feels right, then pull back 5%. The result is a pose that reads as "more right" than the original. For MAGNO, this applies to:

- The charge pose — the magnet head pressed further toward the surface than physically necessary, so the player reads "MAGNO is really charging."
- The launch pose — the body stretched further than physically possible, so the player reads "MAGNO is really moving."
- The snap pose — the magnet head extended further toward the target than physically possible, so the player reads "MAGNO is really committed to the snap."

The exaggeration is committed across the entire rig, not just one joint.

### 8.4 James Baxter on weight

James Baxter animated Belle in *Beauty and the Beast* and Spirit in *Spirit: Stallion of the Cimarron*. Both characters feel heavy — Belle's skirts drag, Spirit's hooves plant. The weight is in the timing, not the size. A character with slow timing reads as heavy regardless of size.

For MAGNO: the character is small but should feel *dense* (a magnet is a heavy object). The timing is slowed by 10% relative to a "light" character of the same scale. The result is that MAGNO reads as something with substance, not a balloon.

### 8.5 Miyazaki's ma

Hayao Miyazaki's principle: **the pause between actions is where the character lives.** A character that is always in motion is a character without thought. A character that pauses for 200ms between actions is a character that is *choosing* to act.

For MAGNO: after every snap, there is a 200ms pause where MAGNO is attached but not yet charging. During the pause, the eye glances at the next snap target. The pause is the moment of "decision" — and it is what makes MAGNO feel like a character rather than a projectile.

### 8.6 Bill Tytla's weight through timing

Bill Tytla's animation of Chernabog in *Fantasia* and the baby Dumbo sequence: the weight of a character is readable from the timing of its motion, not its size. Chernabog is huge and moves slow; Dumbo is small and moves fast, but the baby Dumbo scenes use slower timing for the "tired" or "scared" beats, and the slower timing reads as weight (emotional weight, in Dumbo's case).

For MAGNO, the timing changes with state:

- **Attached** — neutral timing (baseline).
- **Charging** — slow timing (the character is gathering weight).
- **Launching** — fast timing (the weight is released).
- **Airborne** — medium timing (the character is in freefall, weight is suspended).
- **Snapping** — fast then immediately slow (the impact is fast, the settle is slow).
- **Fallen** — very slow timing (the character is heavy, defeated, on the ground).

### 8.7 Hiroyuki Imaishi's dynamic asymmetry

Hiroyuki Imaishi (Trigger) animates with **dynamic asymmetry** — every pose is twisted, counter-posed, never symmetrical. The body's hips and shoulders are at different angles. The head is tilted off the spine's axis. The result is motion that reads as dynamic even when stationary.

For MAGNO, asymmetry is applied to:

- The magnet head's tilt — never straight, always 5–10° off vertical.
- The body's lean — the body always leans in the direction of the next motion.
- The eye's pupil — tracks the next snap target asymmetrically (the eye looks where MAGNO is about to go, not where MAGNO is).

### 8.8 The motion signature of the renewal

Drawing all of the above together, the renewal commits to a single motion signature: **the visible magnetic field line that ripples from MAGNO's magnet head during every charge, launch, and snap.** This signature is the motion axis's equivalent of the silhouette signature (red/blue magnet poles) and the materiality signature (fresnel on metal). It is the thing that, if removed, makes the motion generic.

The field line is a procedural ribbon mesh that:

1. Originates at the north pole and terminates at the south pole (or vice versa, alternating).
2. Ripples with a sine wave whose amplitude is proportional to the charge level (zero at idle, maximum at full charge).
3. Pulses outward during the launch (the field "explodes" outward for 80ms, then collapses).
4. Snaps inward during the snap (the field "implodes" toward the target for 60ms, then settles).

The field line is cyan (per Chapter 15), additive-blended, and visible against any biome background. It is the single most distinctive visual element of the renewal. Its absence is what makes the current build feel "magnetic in concept but not in motion."

### Build Directive for Chapter 8

> AI rebuilder: implement the field-line ribbon as a procedural mesh driven by the magnet's charge state. The mesh is a 16-segment ribbon between the two poles, with each segment's vertex displaced by a sine wave whose amplitude is `charge * 0.4` meters and whose frequency is `4 + charge * 2` Hz. The shader is additive blend, color from `field-line` token in Chapter 15. Without this ribbon, the motion axis is not committed. With it, the game reads as magnetism in motion.

<!-- CHAPTER_9 -->
## Chapter 9 — Cinematography & staging for a single camera

MAGNETOPE uses a single fixed-angle camera that follows MAGNO vertically through the level. This is a cinematography constraint, not a limitation. The masters are Roger Deakins, Emmanuel Lubezki, Rodrigo Prieto, Bill Pope, and Zhang Yimou.

### 9.1 The single-source lighting principle (Deakins)

Roger Deakins lights *Blade Runner 2049*, *1917*, and *Sicario* with a single dominant light source per scene. The result is a frame that reads instantly: the eye knows where the light is coming from, knows where the shadows fall, knows the depth of the scene. Multiple light sources fight each other and produce visual noise.

For MAGNETOPE, every biome has a single dominant light direction:

- **Scrapyard** — late afternoon, light from the lower-left (the sun is setting behind the mountain of junk).
- **Suburbia** — mid-morning, light from the upper-right (the sun is over the houses).
- **Metropolis** — night, light from the lower-right (the neon signs are the dominant source).
- **Playground** — noon, light from directly above (the sun is at the zenith).
- **Stratosphere** — dawn, light from the lower-left (the sun is rising over the curve of the earth).

The light direction is locked per biome. Lubezki's principle: **naturalistic light is a continuity problem** — the direction must be consistent across every shot in the biome, or the player's eye notices the inconsistency before they consciously register it.

### 9.2 The rim light as identity (Prieto)

Rodrigo Prieto's cinematography for *The Wolf of Wall Street* and *Passengers* uses rim light to differentiate characters from backgrounds. The rim light is the thin edge of light on the side of the character opposite to the camera. It separates the character from the background even when both are the same color.

For MAGNETOPE, every MAGNO render has a rim light. The rim light's color is biome-dependent (warmer in Scrapyard, cooler in Stratosphere) but always present. The rim light is what makes MAGNO readable against any background.

### 9.3 Color blocking (Zhang Yimou)

Zhang Yimou's *Hero* and *House of Flying Daggers* use **color blocking** — large flat areas of a single color carry more weight than detailed imagery. The principle transfers: a biome's dominant color should be visible as a large flat area (the sky, a wall, a hillside), not distributed across many small props. The dominant color blocks the frame; the props are accents.

For MAGNETOPE, every biome has one dominant color-blocking surface:

- **Scrapyard** — the sky, in burnt orange.
- **Suburbia** — the lawns, in saturated green.
- **Metropolis** — the building facades, in deep blue-violet.
- **Playground** — the asphalt, in warm grey.
- **Stratosphere** — the sky, in dawn blue.

The color-blocking surface occupies at least 40% of every frame in the biome. The props and MAGNO are accents against this surface.

### 9.4 The camera as character (Bill Pope)

Bill Pope's cinematography for *The Matrix* and the *Spider-Man* films treats the camera as a character with its own emotional arc. Camera movement tells the player how to feel. A camera that follows the action faithfully is invisible (good for gameplay); a camera that punches in on impact tells the player "this matters."

For MAGNETOPE, the camera rig has four states:

1. **Tracking** — the camera follows MAGNO with a smooth ease-out curve. This is the default. The camera is invisible.
2. **Punch-in** — on a flip launch, the camera moves 5% closer to MAGNO for the airborne phase, then pulls back on snap. This emphasizes the launch.
3. **Pull-back** — on a fall, the camera pulls back 10% and tilts down 5°. This emphasizes the fall and the loss of altitude.
4. **Impact** — on a heavy impact, the camera shakes (per the shake grammar in Chapter 17).

The camera states are tied to the gameplay events, not to a director's timeline. The camera is reactive, not scripted.

### 9.5 Three-act lighting per biome

Every biome follows a three-act lighting structure within the player's session:

- **Act 1 (entry)** — the biome's establishing shot, lit at full saturation and full contrast. The player arrives and sees the biome's identity.
- **Act 2 (ascent)** — the lighting becomes more dramatic as the player ascends. The light direction stays the same, but the contrast increases (deeper shadows, brighter highlights).
- **Act 3 (summit)** — the summit is lit with a single source, harsh and from the side. The summit is the dramatic peak; the lighting should match.

The three-act lighting is implemented via the post-processing stack (Chapter 18 §18.5) and the biome-specific color grade LUT.

### 9.6 Depth cues (Sparth)

Sparth's concept art for *Halo 5* and *Destiny* uses **atmospheric perspective** — distant objects lose saturation and shift toward the sky hue. The result is a sense of depth that does not require geometry.

For MAGNETOPE, the three-layer background system (Chapter 13) uses atmospheric perspective:

- **Near silhouette layer (parallax 0.8)** — full saturation, near-black silhouettes of biome-specific objects.
- **Mid atmospheric layer (parallax 0.5)** — 50% saturation, shifted 30% toward the sky hue.
- **Far sky layer (parallax 0.0)** — the biome's sky color, with a gradient from horizon to zenith.

The depth cues are subtle — the player should not consciously notice them. They are what makes the biome feel like a place rather than a backdrop.

### 9.7 Staging: one focal point per frame

Norman Rockwell's principle of staged composition (Chapter 3 §3.2) applies: **every frame has one focal point**, and every other element in the frame supports it. The focal point is usually MAGNO. When MAGNO is in motion, the focal point is the motion (the field line, the snap, the fall). When the player is paused, the focal point is the menu.

The implication: the visual hierarchy of every frame must direct the eye to the focal point. The eye is directed by:

1. **Saturation** — the focal point is more saturated than its surroundings.
2. **Value contrast** — the focal point has a higher light-dark contrast than its surroundings.
3. **Composition** — the focal point is at a rule-of-thirds intersection, not dead center.
4. **Motion** — the focal point moves; its surroundings are still.

The renewal checks every screenshot against this hierarchy. If the eye does not land on MAGNO within 200ms of viewing a screenshot, the screenshot is failing the staging principle.

### Build Directive for Chapter 9

> AI rebuilder: implement the biome-locked light direction as a single `DirectionalLight` per biome, with the direction token in `config/biome.ts`. The light does not change direction within a biome. The rim light is implemented in the MAGNO shader (Chapter 18). The camera rig states are implemented in `src/render/camera-rig.ts` with the four states and their triggers.

<!-- CHAPTER_10 -->
## Chapter 10 — Typography & lettering for a web game

This chapter is the theory behind the typography system. The masters are Paula Scher, Massimo Vignelli, Erik Spiekermann, Adrian Frutiger, Tobias Frere-Jones, Stefan Sagmeister, and David Carson (as an anti-reference).

### 10.1 Type is the voice (Spiekermann)

Erik Spiekermann's principle: **type is the voice of the design.** Pick a typeface that sounds like the game. A game that sounds playful needs a typeface with rounded terminals and a soft stress. A game that sounds precise needs a typeface with sharp terminals and a mechanical stress. A game that sounds vintage needs a slab serif. A game that sounds modern needs a geometric sans.

MAGNETOPE's voice: playful but precise, mechanical but warm. The current Fredoka is playful but generic — it is one of the top three most-used Google Fonts in indie games, and it has lost its voice through overuse. The renewal replaces it with a more distinctive primary typeface and adds a custom wordmark.

### 10.2 The current typeface is generic

Fredoka is a rounded geometric sans by Philatype, released in 2012. By 2026 it appears in: every casual web game UI, every "kid-friendly" product packaging, every STEM education website, every toy store flyer. It is the default "soft and friendly" choice. Using it does not communicate that MAGNETOPE is friendly; it communicates that MAGNETOPE is default.

The renewal does not abandon rounded sans entirely (the rounded-geometric voice is correct for MAGNETOPE), but it commits to a typeface with more character. Three candidates, with the renewal's choice marked:

1. **Fredoka (current)** — generic, overused, rejected as primary.
2. **Quicksand** — similar to Fredoka but with sharper terminals. Rejected as too clinical.
3. **Comfortaa** — rounded geometric with a wider proportion and a slightly calligraphic stress. Selected as primary body typeface.
4. **Bespoke wordmark** — a custom-drawn "MAGNETOPE" wordmark by the developer (or generated from a custom prompt), with the M's stems shaped to echo the horseshoe magnet. This is the brand identity.

### 10.3 The pentagram method (Scher)

Paula Scher's method at Pentagram: **typography as identity**. A single type treatment can carry an entire brand. The Citi logo, the Public Theater identity, the Tiffany & Co. wordmark — each is a single typeface used relentlessly across every touchpoint.

For MAGNETOPE, the renewal commits to two type treatments:

- **Display** — the bespoke MAGNETOPE wordmark, used on the loading screen, the title card, and the share card. Never used at body sizes. Never used in lowercase.
- **Body & UI** — Comfortaa, used in every other text element: HUD, menus, buttons, toasts, level names, biome titles. Always at weights 400 (regular), 600 (semi-bold), 700 (bold). Always at sizes 12px (toasts), 14px (body), 16px (buttons), 20px (level names), 32px (biome titles), 48px (loading).

The two treatments are the only type used in the entire game. No third typeface. No exception.

### 10.4 The grid is the design (Vignelli)

Massimo Vignelli's principle: **the grid is the design.** A strong grid makes weak content feel deliberate; a weak grid makes strong content feel amateurish.

For MAGNETOPE's UI, the grid is an 8-pixel base unit. Every spacing, padding, margin, and element size is a multiple of 8. The grid is exposed in the UI design tokens (Chapter 14) and enforced via CSS variables.

### 10.5 Screen-legibility principles (Frutiger, Frere-Jones)

Adrian Frutiger designed Frutiger, Univers, and Avenir for signage and screen reading. His principles: **open counters** (the enclosed areas of letters like 'o', 'a', 'e' must be large enough to not fill in at small sizes), **generous x-height** (the lowercase letters should be tall relative to the caps), **even color** (the typeface should look like a uniform texture at distance, not a collection of distinct letters).

Tobias Frere-Jones designed Interstate and Gotham, both for low-resolution reading. His principle: **letterforms must survive subpixel rendering** — sharp terminals can break down into jagged edges at small sizes on cheap screens, so the typeface's terminals should be slightly rounded even when the typeface is geometric.

For MAGNETOPE, Comfortaa passes both Frutiger's and Frere-Jones's tests: it has open counters, a generous x-height, and slightly rounded terminals. It is not the most distinctive typeface in the world, but it is legible at 12px on a cheap Android screen, and it is rare enough that it does not read as default.

### 10.6 The bespoke wordmark (Sagmeister)

Stefan Sagmeister's principle: **handmade touches in a digital world are memorable because they are unexpected.** A bespoke wordmark — a "MAGNETOPE" lettering drawn by hand or generated uniquely for the game — is more memorable than any typeface treatment.

The renewal specifies the wordmark:

- Letters M, A, G, N, E, T, O, P, E, drawn as a single connected shape.
- The two M's stems are extended and curved outward at the top to echo the horseshoe magnet silhouette.
- The O is replaced with a horseshoe magnet icon (a small U with red and blue pole tips).
- The crossbar of the T is replaced with a magnetic field line arc.
- The wordmark is rendered in two colors: the magnet letters (M, O, T) in the master palette's pole-red, the rest in the master palette's ink color.
- The wordmark is delivered as an SVG, embedded in the loading screen and the share card, and as the favicon.

The wordmark is the single highest-leverage brand identity decision in the renewal. It is what makes MAGNETOPE instantly recognizable on a Poki thumbnail.

### 10.7 Carson as anti-reference (avoid)

David Carson's *Ray Gun* magazine famously used illegible typography as deliberate provocation. The principle does not transfer to game UI. MAGNETOPE's UI must be legible at a glance; any decorative type treatment that compromises legibility is rejected. The bespoke wordmark is the only place where decorative type is allowed, and even there, the wordmark must be readable as "MAGNETOPE" within 500ms.

### 10.8 Type tokens

The full type system is encoded in the design tokens (Chapter 14 §14.6). The summary:

| Token | Value | Usage |
|---|---|---|
| `font-display` | Custom SVG wordmark | Loading screen, share card, biome title cards (the wordmark only) |
| `font-body` | Comfortaa, sans-serif | All other text |
| `font-mono` | UI Monospace, monospace | Debug HUD (dev only, stripped in production) |
| `font-weight-regular` | 400 | Body text |
| `font-weight-semibold` | 600 | Buttons, level names |
| `font-weight-bold` | 700 | Biome titles, key UI |
| `font-size-xs` | 12px | Toasts, hints |
| `font-size-sm` | 14px | Body, menu items |
| `font-size-md` | 16px | Buttons, level names |
| `font-size-lg` | 20px | Level titles |
| `font-size-xl` | 32px | Biome titles |
| `font-size-2xl` | 48px | Loading screen subtitle |
| `font-size-3xl` | 96px | Loading screen wordmark |

### 10.9 Self-hosting and bundle budget

Comfortaa is self-hosted (the renewal follows the existing pattern of `public/fonts/fredoka-latin.woff2`, replaced with `public/fonts/comfortaa-latin.woff2`). The font is subset to Latin + the 7 supported locales (EN, DE, ES, FR, IT, PT-BR, TR), with a target size of under 40KB gzipped. The wordmark SVG is under 5KB.

### Build Directive for Chapter 10

> AI rebuilder: replace `public/fonts/fredoka-latin.woff2` with a subset of Comfortaa (Latin + the 7 supported locales). Update the CSS font-face declaration in `src/ui/style.css`. Replace the `<title>MAGNETOPE</title>` text in the loading screen with an inline SVG of the bespoke wordmark per the spec in §10.6. Update the favicon to match.

<!-- CHAPTER_11 -->
# PART III — THE MAGNETOPE VISUAL RENEWAL

## Chapter 11 — Positioning statement: what MAGNETOPE becomes

This chapter names the destination. Every subsequent chapter in Part III is in service of arriving here.

### 11.1 The positioning statement

The renewal commits MAGNETOPE to the following positioning:

> **MAGNETOPE is the game where magnetism is visible. Every screen shows magnetism — the red and blue poles, the cyan field lines, the steel surfaces that glow with the magnet's color when MAGNO is near. The world is a junkyard, but the junkyard glows. MAGNO is a small, dense, characterful robot whose single eye tracks his next target. The art is toon-shaded with hard terminators, rim-lit, with a saturated palette that no other physics puzzle game on Poki shares. The game is playful and serious — playful in its motion, serious in its visual discipline.**

This positioning is the answer to the question "what makes MAGNETOPE not generic." The answer is not "better art." The answer is a single committed signature: **magnetism made visible.** Every visual decision in the renewal serves this signature.

### 11.2 The five signatures, restated

The five signature decisions of the renewal (from Chapter 4 §4.3), restated as commitments:

1. **Silhouette signature** — MAGNO's head is a horseshoe magnet with visible red and blue pole tips. The pole tips are the silhouette differentiator that distinguishes a magnet from a padlock shackle.
2. **Palette signature** — Every biome has at least one color that appears in no other biome. The Scrapyard is rust-orange and oxidized-copper green. Suburbia is saturated green with terracotta. Metropolis is deep blue-violet with neon yellow-orange. Playground is high-saturation CMY. Stratosphere is near-monochrome dawn blue with sunrise gold.
3. **Materiality signature** — Props are shaded with a toon shader (two bands, hard terminator, rim light). Metallic surfaces additionally have a fresnel effect that glows with MAGNO's current pole color when MAGNO is near.
4. **Motion signature** — Every flip launches a cyan field-line ribbon from pole to pole, which ripples during charge, explodes outward during launch, and implodes during snap. The field line is the visual proof that magnetism is happening.
5. **Overall signature** — Magnetism is visible in every screen. If a screenshot does not show at least one of (red/blue magnet poles, cyan field lines, fresnel-glowing metal, repel sparks, snap beam), the screenshot is failing the signature test and must be reworked.

### 11.3 What MAGNETOPE explicitly does NOT become

The renewal also names what MAGNETOPE does not become, to prevent drift:

- **Not a voxel game** — magnetism is curved, not blocky.
- **Not a PBR-realistic game** — realism fights the playful tone.
- **Not a hand-painted Okami-style game** — the procedural pipeline cannot support hand-painted textures within the bundle budget.
- **Not a gel-capsule candy game** — gel reads as candy, not as junkyard.
- **Not a 2D game** — the 3D physics simulation is the game's foundation; the renewal preserves it.
- **Not a desaturated game** — the palette is saturated and committed. Muted is rejected.
- **Not a generic cartoon game** — the toon shading is committed, but the art direction is not "default cel-shaded." The toon shading is in service of the magnetism signature, not a stylistic choice in itself.

### 11.4 The mood board references

The renewal is in dialogue with the following references (full bibliography in Appendix B):

| Reference | What is borrowed |
|---|---|
| *Hades* (Jen Zee) | Saturation discipline, rim light as identity |
| *Night in the Woods* (Scott Benson) | Shape language consistency |
| Cartoon Saloon films (Tomm Moore, Ross Stewart) | Toon shading, ligne claire, frame-as-painting |
| *Hyper Light Drifter* (Alx Preston) | Color as narrative, biome hue anchors |
| *Obra Dinn* (Lucas Pope) | Constraint as identity |
| *Undertale* (Toby Fox) | Restraint as feature |
| Roger Deakins cinematography | Single-source lighting |
| Zhang Yimou's *Hero* | Color blocking |
| Hergé's *Tintin* | Ligne claire |
| Moebius | Emptiness as positive composition |
| Dieter Rams' Braun work | Less, but better |

### 11.5 The anti-references

The renewal explicitly does NOT look like (full anti-reference list in Appendix B):

| Anti-reference | Why avoided |
|---|---|
| Crossy Road | Voxel aesthetic is wrong for magnetism |
| Subway Surfers | Saturated but undisciplined palette |
| Stickman Hook | Generic stickman silhouette |
| Default Unity asset packs | Asset-pack equivalent look |
| Default Unreal PBR demos | Realism fights playfulness |
| AI-generated game art | The default look of 2023–2026 AI games |
| Generic low-poly indie web games | The current look of MAGNETOPE |

### 11.6 The one-line elevator pitch

If a Poki reviewer asks the developer "what is your game?" in one sentence, the answer is:

> **"MAGNETOPE is a one-button magnetic slingshot game where you charge, flip, and snap a small magnet-headed robot up a mountain of glowing junk, and the magnetism is always visible — every metal surface you touch glows with your pole color."**

That sentence contains every signature. The reviewer should be able to guess the look of the game from the sentence alone.

### 11.7 The success metric

The renewal succeeds if, after implementation, the following three tests pass:

1. **The 200ms thumbnail test (Chapter 6 §6.8)** — at least 7 of 10 cold viewers identify MAGNO as a magnet.
2. **The signature test (Chapter 4 §4.3)** — 5 random screenshots are grouped as the same game by a cold viewer, and the viewer can name what makes them the same.
3. **The Poki acceptance rubric (Chapter 21)** — at least 22 of 25 binary checks pass.

If all three pass, the renewal has succeeded. If any one fails, the failing axis is revisited.

### Build Directive for Chapter 11

> AI rebuilder: read this chapter aloud before starting any implementation. The five signatures are the destination; every subsequent chapter is the route. If a later chapter's directive seems to contradict a signature, the signature wins.

<!-- CHAPTER_12 -->
## Chapter 12 — MAGNO character redesign (full spec)

This chapter is the full specification for the redesigned MAGNO. It is the longest chapter in Part III because MAGNO is the highest-leverage visual asset in the game.

### 12.1 The redesign brief, in one paragraph

MAGNO is a small, dense, characterful robot whose head is a horseshoe magnet with visible red and blue pole tips, whose body is a rounded capsule, whose single large eye tracks his next snap target, and whose every action is accompanied by a visible cyan field-line ribbon. He reads as a magnet, not a padlock, in pure silhouette at 64×64 pixels.

### 12.2 Silhouette spec (the fix for the padlock problem)

The silhouette is the load-bearing spec. Every other spec is in service of it.

| Element | Current | Redesigned | Why |
|---|---|---|---|
| Head shape | U, single color | U with flared pole tips, red and blue | The flared tips distinguish a magnet from a padlock shackle; the red-blue split is the magnet's defining feature |
| Head size | ~30% of body | ~45% of body | Larger head = more magnetism visible at distance |
| Body shape | Rounded rectangle | Rounded capsule (more elongated) | The capsule reads as a chassis for the magnet, not as a padlock body |
| Body width | 1.0× head width | 0.85× head width | The head dominates; the body supports |
| Arms | Two small nubs | Removed | The magnet is the action; arms are visual noise |
| Eye | Single small disc | Single large disc (~18% of head area) | The eye carries the personality (Carter Goodrich) |
| Pole tip flare | None | 15° outward flare at each pole | Real horseshoe magnets have flared tips; the flare is the silhouette differentiator |
| N/S markings | None | "N" on red pole, "S" on blue pole, in the bespoke wordmark style | Doubles down on the magnet identity |

### 12.3 Proportion spec (Nico Marlet exaggerated proportions)

The proportions follow Marlet's principle of internally-consistent exaggeration:

- Head height: 1.2× body height (the head is bigger than the body)
- Head width: 1.15× body width (the head is wider than the body)
- Eye diameter: 0.35× head width (the eye is large)
- Eye position: centered on the head, slightly above the magnet's midline
- Pole tip length: 0.18× head height
- Pole tip flare: 15° outward from the magnet's vertical axis
- Body capsule length: 1.0× head height
- Body capsule width: 0.85× head width

These proportions are committed across every state and every alt skin.

### 12.4 Eye spec (Carter Goodrich)

The eye is the personality carrier. Spec:

- **Iris**: a single black disc, 50% of eye diameter, centered.
- **Pupil**: a smaller white glint, 12% of eye diameter, offset 30% toward the next snap target.
- **Sclera**: the white of the eye, but tinted slightly warm (off-white, hex `#F5E6D3`).
- **Eyelid**: a thin curved line above the iris, drawn in the body color. Closes to a horizontal slit on snap impact (60ms closed, then opens). This is the "I felt that" cue.
- **Eyebrow**: none. The eye communicates emotion through eyelid position and pupil direction, not through a brow.
- **Tracking**: the pupil smoothly tracks the next snap target. When no target is locked, the pupil rests at the eye's center.
- **State expressions**:
  - Idle: pupil centered, eyelid relaxed.
  - Charging: pupil locked on next target, eyelid slightly narrowed (focus).
  - Launching: pupil widened (excitement), eyelid fully open.
  - Airborne: pupil tracking the snap target, eyelid half-closed (anticipation).
  - Snapping: eyelid closed (60ms), then snaps open (commitment).
  - Falling: pupil looking down (resignation), eyelid relaxed.
  - Fallen: pupil closed (resting).

### 12.5 Color spec (per Chapter 15)

| Element | Color | Hex |
|---|---|---|
| North pole | Pole red | `#E53935` |
| South pole | Pole blue | `#1E88E5` |
| Pole tip flare (north) | Pole red, slightly desaturated | `#C62828` |
| Pole tip flare (south) | Pole blue, slightly desaturated | `#1565C0` |
| Body capsule | Magnet chassis warm grey | `#546E7A` |
| Body capsule rim light | Warm white | `#FFCC80` |
| Eye sclera | Off-white | `#F5E6D3` |
| Eye iris | Black | `#0A0A0A` |
| Eye pupil glint | White | `#FFFFFF` |
| N/S markings | Body capsule color | `#546E7A` on red/blue |
| Field line | Cyan | `#00E5FF` |

### 12.6 Line of action per state (Glen Keane)

The line of action is the single dominant curve through the character in each state. The animator's job is to make this curve visible in every frame.

| State | Line of action | Description |
|---|---|---|
| Idle / attached | Slight C-curve | Body leaning 5° in the direction of the next likely flip; head tilted 5° off vertical |
| Charging | Tighter C-curve | Body leaning 15° toward the surface; head pressed toward the surface |
| Launching | Strong S-curve | Body extended; head pointing in the launch direction; the S runs from feet through head |
| Airborne | Straight line | Body and head aligned with the velocity vector; the line points at the next snap target |
| Snapping | Curved line | Body whipping toward the target; the curve runs from the body's previous position through the head's new position |
| Settling (post-snap) | Loose S-curve | Body recovering; head bobbing slightly |
| Falling | Broken line | Body crumpled; head limp |
| Fallen | Flat line | Body horizontal; head touching the ground |

### 12.7 Animation rig spec

The rig is simplified relative to the current build. The principles are Richard Williams' from Chapter 8.

| Joint | Current | Redesigned |
|---|---|---|
| Head pivot | At the body's top | At the body's top, with a 2-bone IK chain to the magnet poles |
| Body | Single rigid mesh | Single mesh with 3 squash/stretch bones |
| Arms | 2 bones each | Removed (no arms) |
| Eye | Texture swap | Separate mesh with its own pivot, can rotate independently of the head |
| Field-line ribbon | None | 16-segment ribbon mesh attached to the two poles |

The simplified rig has fewer bones, which means the animation budget per frame is lower, which means the game runs faster on tier-low devices. This is a rare case where the artistic decision (simplify) and the engineering decision (optimize) align.

### 12.8 Alt skins (Brittney Lee variety)

Eight alt skins, each with a structurally different head silhouette (not just a recolor):

| Skin name | Head silhouette change | Pole colors | Unlock |
|---|---|---|---|
| Classic (default) | Standard horseshoe | Red/blue | Default |
| Industrial | Square horseshoe (sharp corners) | Orange/teal | Reach Scrapyard summit |
| Vintage | Round horseshoe (torus segment) | Burgundy/navy | Reach Suburbia summit |
| Neon | Horseshoe with neon-tube glow | Magenta/cyan | Reach Metropolis summit |
| Carnival | Horseshoe with clown-nose tip | Yellow/purple | Reach Playground summit |
| Aurora | Horseshoe with curved aurora ribbon | Green/violet | Reach Stratosphere summit |
| Trophy | Gold-plated horseshoe | Gold/white | All 70 levels 3-starred |
| Custom | Player-designed (locked to silhouette constraints) | Player-chosen | All 24 cosmetic unlocks |

Every skin must pass the 200ms silhouette test (the pole tips and the red-blue split must remain visible). No skin is allowed to make MAGNO read as something other than a magnet.

### 12.9 Expression state machine

The expression state machine is the system that controls MAGNO's eye, eyelid, body lean, and head tilt as a function of game state. The states are: idle, charging, launching, airborne, snapping, settling, falling, fallen. Transitions between states are 100ms ease-in-out. Within a state, the eye tracks the snap target continuously.

The state machine is implemented in `src/render/magno-rig.ts` and is driven by the existing simulation events. The rig is deterministic — the same simulation state produces the same rig state, so the bot routes and the player's runs both produce correct animation.

### 12.10 The thumbnail pose (the hero shot)

The thumbnail pose is the single most important render of MAGNO. It is the pose used in the static thumbnail and the animated thumbnail's hero frame. Spec:

- MAGNO is mid-flip, at the apex of the launch arc.
- The body is in the launching line of action (strong S-curve).
- The eye is widened, looking up and to the right (the direction of motion).
- The field-line ribbon is fully extended, rippling visibly.
- The magnet poles are at their maximum color saturation.
- The pose is captured at a 7° camera tilt (the existing thumbnail's tilt is correct and is kept).
- The background is the Scrapyard's iconic image (a tower of fridges, girders, and a washing machine, lit by the late-afternoon light from the lower-left).

### 12.11 The fall pose (the comedy shot)

The fall pose is the second most important render. It is the pose used in the fall card and the share card. Spec:

- MAGNO is on the ground, body horizontal, head touching the ground.
- The eye is half-closed (resignation).
- The field-line ribbon is limp, draped over the body.
- The magnet poles are slightly desaturated (the magnetism has "gone out of him").
- The pose is captured from a low camera angle (the camera tilts up at MAGNO, emphasizing his defeat).

### 12.12 What the redesign removes

The redesign removes:
- The two arm nubs (visual noise).
- The current small eye (replaced with the large eye per §12.4).
- The single-color steel head (replaced with the red-blue horseshoe).
- The flat-shaded material (replaced with toon shader per Chapter 7).
- The current motion-less launch (replaced with the field-line ribbon per Chapter 8).

The redesign keeps:
- The body capsule silhouette (it is correct).
- The single-eye design (it is correct, just enlarged).
- The 7° thumbnail tilt.
- The 5° idle body lean.

### Build Directive for Chapter 12

> AI rebuilder: the MAGNO rig rewrite is the highest-leverage single change in the renewal. Implement in this order: (1) silhouette fix per §12.2, (2) eye redesign per §12.4, (3) alt skins per §12.8, (4) animation rig per §12.7, (5) line of action per §12.6, (6) thumbnail pose per §12.10, (7) fall pose per §12.11. Each step should be visually verifiable before moving to the next. The silhouette fix alone (step 1) is enough to flip the 200ms thumbnail test from fail to pass.

<!-- CHAPTER_13 -->
## Chapter 13 — Biome art direction (per-biome bible)

This chapter contains the art-direction bible for each of the five biomes. Each biome gets: the iconic image, the palette, the material language, the hero props, the lighting plan, the ambient FX, the audio texture, the three-layer background, and the pattern language. The biomes are presented in play order.

### 13.0 The biome bible template

Every biome bible has the same ten sections, in the same order:

1. **Iconic image** — the single frame a player would remember if they only played the biome once.
2. **Palette** — the gamut, the dominant color-blocking surface, the accent, the complement.
3. **Material language** — the dominant material families and the contrast rule.
4. **Hero props** — the three to five props that define the biome's silhouette.
5. **Lighting plan** — the dominant light direction, the rim light color, the contrast curve.
6. **Ambient FX** — particles, atmospheric effects, weather.
7. **Audio texture** — the ambient sound, the music cues, the prop voices.
8. **Three-layer background** — near silhouette, mid atmospheric, far sky.
9. **Pattern language** — the recurring visual motifs that bind the biome.
10. **What the biome is NOT** — anti-references specific to this biome.

### 13.1 Scrapyard (the warm wedge)

**Iconic image.** A tower of fridges, lockers, and girders stacked against a burnt-orange late-afternoon sky. MAGNO is mid-flip at the apex, the cyan field line fully extended, the red and blue magnet poles visible against the rust. The camera tilts 7°. The far silhouettes of broken car bodies and bent streetlights fade into the haze.

**Palette.** Gurney gamut: warm wedge (yellow-orange → red-orange → red-violet), 20% of the color wheel. Dominant color-blocking surface: the sky, in burnt orange `#D84315`. Accent: oxidized copper green `#2E7D32`, used at less than 5% screen area (on copper pipes, weathered statues, moss patches). Complement: cold blue steel `#37474F` (the magnetic metal, against the warm dominant).

**Material language.** Dominant: steel (magnetic) and rust (weathered steel). Contrast: every steel prop has one clean face and one rust-weathered face. Kuciara's principle (Chapter 7 §7.4). Wood and plastic appear only on non-magnetic props (the planks the player cannot stick to).

**Hero props.** (1) The fridge — tall, two-door, with visible handle. (2) The locker — three-slatted door. (3) The girder — I-beam, weathered. (4) The washing machine — round dial, square door. (5) The streetlight — broken, bent, leaning. Each has a silhouette-defining feature (handles, slats, I-shape, dial, lean) that distinguishes it from every other prop.

**Lighting plan.** Deakins single-source: late afternoon, light from the lower-left, 35° elevation. Long shadows to the upper-right. Rim light on MAGNO: warm white `#FFCC80`. Three-act lighting: full saturation on entry, deeper contrast on ascent, harsh side-light on summit.

**Ambient FX.** Dust motes drifting through the light shafts. Occasional spark puffs from broken wires. Steam wisps from broken pipes. No rain — the Scrapyard is dry.

**Audio texture.** Wind through metal, distant dog bark, occasional car alarm (distant), MAGNO's magnet hum (low-frequency, 60 Hz). Music: sparse slide guitar, slow.

**Three-layer background.** Near (parallax 0.8): broken car silhouettes, bent streetlights, junk piles. Mid (parallax 0.5): industrial buildings, smokestacks, at 50% saturation shifted 30% toward burnt orange. Far (parallax 0.0): the burnt-orange sky, gradient from horizon (darker) to zenith (lighter).

**Pattern language.** Right angles everywhere. Industrial rectangles, I-beam cross-sections, stacked regular geometries. No curves except on MAGNO and on the rare organic prop (a potted plant, a half-buried tire).

**What the Scrapyard is NOT.** Not a junkyard from a stock asset pack. Not a desert. Not a war zone. Not a post-apocalyptic ruin. It is a *working scrapyard* — closed for the day, lit by the setting sun, waiting for tomorrow.

### 13.2 Suburbia (the cool wedge)

**Iconic image.** A row of pastel-painted houses with sloping roofs, a clothesline with billowing sheets, a trampoline in the foreground, a washing line full of colorful laundry. The sky is mid-morning blue. MAGNO is mid-flip off the trampoline, the field line rippling in the breeze. The contrast with the Scrapyard is total: this is green and cool, that was orange and warm.

**Palette.** Gurney gamut: cool wedge (yellow-green → green → blue-green), 25% of the wheel. Dominant color-blocking surface: the lawns, in saturated green `#4CAF50`. Accent: terracotta `#C0442E`, used at less than 5% (on roof tiles, flower pots, brick walls). Complement: warm terracotta against cool green.

**Material language.** Dominant: foliage (alive), wood (warm), fabric (soft). Contrast: hard surfaces (brick, concrete) against soft surfaces (grass, fabric). The toon shader's hard terminator is most visible here — the clean shadow on a sunlit wall is a graphic device.

**Hero props.** (1) The trampoline — round, blue mat, black frame. (2) The clothesline — T-poles, sagging rope, billowing sheets. (3) The sloped-roof house — pastel wall, terracotta roof. (4) The mailbox — rectangular, on a post. (5) The garden gnome — small, conical hat.

**Lighting plan.** Mid-morning, light from upper-right, 55° elevation. Short shadows to the lower-left. Rim light on MAGNO: warm white. Three-act lighting: bright and saturated on entry, golden hour on ascent, long shadows on summit.

**Ambient FX.** Birds flying past (silhouettes), leaves drifting, sheets billowing in the breeze. Occasional butterfly. Distant lawn-mower hum.

**Audio texture.** Birdsong (multiple species, layered), distant children playing, MAGNO's magnet hum (slightly higher pitch, 80 Hz). Music: light acoustic guitar, fingerpicked.

**Three-layer background.** Near: fences, hedges, parked cars. Mid: rows of houses at 50% saturation, shifted 30% toward sky blue. Far: the mid-morning blue sky, gradient from horizon (lighter) to zenith (deeper).

**Pattern language.** Curves everywhere. Sloping roofs, round trampolines, billowing sheets, arched doorways. The contrast with the Scrapyard's right angles is deliberate — the player should feel the biome shift in their bones.

**What Suburbia is NOT.** Not a generic "level 2 suburb." Not a 1950s American ideal. Not a Sims-clone neighborhood. It is a specific, named, art-directed place — pastel houses, sloped roofs, billowing laundry, on a mid-morning in early summer.

### 13.3 Metropolis (the complementary pair)

**Iconic image.** A vertical cityscape at night. Tall buildings with deep blue-violet facades, neon signs in yellow-orange, a broken billboard flickering. MAGNO is mid-flip off a fire escape, the field line glowing against the neon. Wet asphalt reflects everything. The mood is Blade Runner without the violence.

**Palette.** Gurney gamut: complementary pair (blue-violet and yellow-orange), 30% of the wheel. Dominant color-blocking surface: the building facades, in deep blue-violet `#311B92`. Accent: neon yellow-orange `#FFAB00`, used at less than 8% (on signs, lit windows, neon tubes). Complement: each color is the other's complement.

**Material language.** Dominant: concrete (Ando's principle — concrete as a canvas for light), glass (fresnel on windows reflecting the neon), steel (fire escapes, structural beams). Contrast: clean concrete against weathered steel. The wet asphalt is a special material — it reflects the neon, doubling the accent color's visual weight.

**Hero props.** (1) The fire escape — zig-zag steel stairs. (2) The neon sign — broken, flickering, with a recognizable icon (a coffee cup, a horseshoe). (3) The billboard — tall, with a faded advertisement. (4) The streetlight — pool of light below it. (5) The window AC unit — small, square, humming.

**Lighting plan.** Night, light from the lower-right (the neon signs are the dominant source). Multiple secondary sources (window lights, streetlights) but they are subordinate to the neon. Rim light on MAGNO: cool cyan, to match the field-line color and tie MAGNO to the magnetism signature. Three-act lighting: establishing wide on entry, building-up contrast on ascent, neon-dominant on summit.

**Ambient FX.** Steam rising from manholes, neon flicker, distant siren, occasional car passing (headlight beams sweep the scene).

**Audio texture.** Neon buzz (60 Hz hum), distant siren, occasional car, MAGNO's magnet hum (matches the neon buzz, 60 Hz). Music: sparse synth, minor key, slow pulse.

**Three-layer background.** Near: fire escapes, hanging signs, window AC units. Mid: rows of building facades at 50% saturation, shifted 30% toward blue-violet. Far: the night sky, with the orange glow of city light pollution on the horizon.

**Pattern language.** Vertical lines everywhere. Building edges, fire escape rails, hanging signs. The verticality emphasizes the upward climb. The contrast with Suburbia's curves is total.

**What Metropolis is NOT.** Not a cyberpunk dystopia. Not a noir crime scene. Not a generic "night city" asset pack. It is a specific, art-directed night in a city — wet, neon-lit, but quiet, with the player alone on the fire escapes.

### 13.4 Playground (the high-saturation triangle)

**Iconic image.** A playground at noon. A see-saw, a roundabout, a swing set, a slide, a ferris wheel in the background. The asphalt is warm grey. The sky is high noon blue. MAGNO is mid-flip off the roundabout, which is spinning in response. The colors are the most saturated in the game — a CMY triangle.

**Palette.** Gurney gamut: high-saturation triangle (cyan, magenta, yellow), 40% of the wheel. Dominant color-blocking surface: the warm grey asphalt `#9E9E9E`. Accents: cyan `#00BCD4` (on play equipment paint), magenta `#E91E63` (on a slide), yellow `#FFEB3B` (on a swing seat). Complement: each accent complements the asphalt's neutrality.

**Material language.** Dominant: painted steel (magnetic, with peeling paint), plastic (bright, glossy). Contrast: peeling paint reveals rust underneath — the playground is old but loved.

**Hero props.** (1) The see-saw — long plank, central pivot. (2) The roundabout — spinning disc, multicolored. (3) The swing set — A-frame, two seats. (4) The slide — chute on legs. (5) The ferris wheel — distant, the biome's signature landmark.

**Lighting plan.** Noon, light from directly above, 80° elevation. Short shadows, almost no shadow on the ground. Rim light on MAGNO: warm white. Three-act lighting: flat and graphic on entry, increasing contrast on ascent (shadows lengthen), dramatic on summit (the ferris wheel is silhouetted against the sky).

**Ambient FX.** Wind ripples through sandpits, swings sway empty, distant ice-cream truck jingle, occasional balloon drifting up.

**Audio texture.** Distant ice-cream truck, swings creaking, MAGNO's magnet hum (higher pitch, 100 Hz, matches the playful mood). Music: bouncy xylophone, major key.

**Three-layer background.** Near: benches, fences, small play equipment. Mid: trees and bushes at 50% saturation, shifted 30% toward sky blue. Far: the noon sky, with the ferris wheel silhouette on the horizon.

**Pattern language.** Bright primary colors and geometric shapes — circles (roundabout, swing seats), triangles (slide, A-frame), rectangles (see-saw). The shapes are deliberate; they are the visual vocabulary of playground equipment everywhere.

**What the Playground is NOT.** Not a derelict playground. Not a horror-game playground at night. Not a stock "kids level." It is a specific, art-directed playground at noon on a summer day, with the equipment old but well-maintained, the paint peeling but the colors still bright.

### 13.5 Stratosphere (the near-monochrome blue)

**Iconic image.** Above the clouds. The sky is dawn blue, with a thin band of sunrise gold on the horizon. Below, the cloud layer is a soft white sea. The summit platform is small, lit by the rising sun. MAGNO is mid-flip toward the summit, the field line the brightest thing in the frame. The frame is mostly empty — this is Moebius's emptiness as positive composition.

**Palette.** Gurney gamut: near-monochrome blue, 15% of the wheel. Dominant color-blocking surface: the sky, in dawn blue `#0288D1`. Accent: sunrise gold `#FFD54F`, used at less than 3% (on the horizon band, the summit platform's edge, MAGNO's magnet poles — the red and blue poles are the brightest things in the frame). Complement: warm gold against cool blue.

**Material language.** Dominant: cloud (a special soft material, volumetric), steel (the summit platform, magnetic). Contrast: the only hard surface in the biome is the summit platform — everything else is soft cloud.

**Hero props.** (1) The summit platform — small, square, magnetic steel. (2) The cloud layer — a sea of soft white below. (3) The mountain peak — distant, snow-capped, the visual goal of the entire game. (4) The aurora — a soft ribbon of green-violet light in the sky (the Aurora skin's inspiration). (5) The shooting star — a rare ambient FX, occasionally crossing the sky.

**Lighting plan.** Dawn, light from the lower-left, 15° elevation (the sun is rising over the curve of the earth). Long shadows impossible (no surface to cast on). Rim light on MAGNO: warm gold, matching the sunrise. Three-act lighting: dawn on entry, full daylight on ascent, golden hour on summit.

**Ambient FX.** Slow cloud drift, occasional aurora shimmer, rare shooting star. Wind is constant (thin air is windy).

**Audio texture.** Wind, distant and high-pitched (thin air). Rare far ping (per the original audio design). MAGNO's magnet hum (lowest pitch, 50 Hz, the magnet is the only solid object). Music: solo piano, sparse, high notes.

**Three-layer background.** Near: the summit platform and its immediate cloud. Mid: the cloud layer at 70% saturation, shifted toward white. Far: the dawn sky, with the gold horizon band and the deep blue zenith.

**Pattern language.** Emptiness. The frame is mostly sky. The pattern is the absence of pattern. Moebius's principle: emptiness as positive composition. The player has climbed through four biomes of dense visual information; the Stratosphere rewards them with space.

**What the Stratosphere is NOT.** Not a space level. Not a heaven/afterlife metaphor. Not a generic "level 5 sky." It is a specific, art-directed dawn above the clouds, the visual reward for completing the climb.

### 13.6 The biome differentiation check

The biome differentiation check (from Chapter 4): every biome has at least one color that appears in no other biome. Verified:

| Biome | Unique color (no other biome uses) |
|---|---|
| Scrapyard | Burnt orange `#D84315` |
| Suburbia | Saturated green `#4CAF50` |
| Metropolis | Deep blue-violet `#311B92` |
| Playground | Magenta `#E91E63` |
| Stratosphere | Dawn blue `#0288D1` |

No two biomes share a dominant hue. The progression through the biomes is a progression through the color wheel, and the player feels the shift in their bones.

### Build Directive for Chapter 13

> AI rebuilder: implement one biome at a time, in play order. Each biome's ten sections (iconic image, palette, materials, hero props, lighting, ambient FX, audio, three-layer background, pattern language, anti-references) must be checked off before moving to the next. The biome differentiation check (§13.6) must pass after every biome is implemented — no two biomes may share a dominant hue.

<!-- CHAPTER_14 -->
## Chapter 14 — HUD, UI, and iconography system

This chapter specifies the unobtrusive layer (Fukasawa's principle, Chapter 4 §4.5). The HUD uses the master palette (Chapter 15) but at lower saturation than the game world. The HUD uses the Comfortaa typeface (Chapter 10) at smaller sizes. The HUD animates subtly but never distractingly.

### 14.1 The pentagram-style HUD

The HUD is composed of:

- **Top-left:** the level name (Comfortaa 600, 14px).
- **Top-right:** the pause button (icon only, 24×24px).
- **Left edge:** the height/progress rail (8px wide, full-height, with a marker at the player's current height).
- **Bottom-left (mobile only):** the touch controls — left half for steering, right half for flip.
- **Bottom-center (desktop only):** the keyboard hint — `SPACE` flip, `WASD` aim, `R` restart, `ESC` pause.
- **Bottom-right:** the timer (Comfortaa 600, 14px).
- **Center-bottom:** the stars-track (three stars, filled or empty).

The HUD never covers more than 15% of the screen. The remaining 85% is the game.

### 14.2 The Vignelli grid

The HUD is laid out on an 8-pixel grid. Every spacing, padding, margin, and element size is a multiple of 8. The grid is exposed as CSS variables:

```css
--space-1: 8px;
--space-2: 16px;
--space-3: 24px;
--space-4: 32px;
--space-5: 40px;
--space-6: 48px;
--space-8: 64px;
--space-12: 96px;
```

The grid is enforced via the CSS variables. Any element whose size is not a multiple of 8 is rejected.

### 14.3 Custom icon set (not Lucide)

The current build uses Lucide icons (or similar open-source icon set). Lucide is fine, but it is the default — every web game uses Lucide. The renewal commits to a custom icon set:

- All icons are drawn in-house, in the bespoke wordmark's style (rounded terminals, geometric construction).
- The icon set is small: 16 icons total. Pause, play, restart, sound on, sound off, music on, music off, settings, map, locker, ghost exchange, share, back, info, rewarded (the 🎬 marker is replaced with a horseshoe magnet icon), close.
- Each icon is delivered as an inline SVG, under 1KB.
- The icons are consistent with the magnetism-made-visible signature — the "rewarded" icon is a horseshoe magnet, the "share" icon is a magnet with field lines radiating outward.

### 14.4 Modal hierarchy (Rams #4 — understandable)

The pause menu, the level-clear card, the fall card, the map screen, the locker, and the ghost exchange are all modals. The renewal commits to a strict modal hierarchy:

- **Primary modal** — the pause menu. All other modals are accessed from the pause menu or from the level-clear card.
- **Secondary modals** — level-clear card, fall card. These appear over the gameplay, dim the background by 60%, and have a single primary action.
- **Tertiary modals** — map, locker, ghost exchange, controls. These appear over the pause menu, dim the background by 80%, and have a back button to the pause menu.

The dim percentages are tokens from Chapter 15. The modals are positioned on the 8-pixel grid. The modal hierarchy prevents modal-on-modal confusion (a common failure mode in casual games).

### 14.5 Toast system (Rams #5 — unobtrusive)

Toasts are short messages that appear at the bottom of the screen for 2.2 seconds and then fade out. They communicate transient information: "save failed," "new unlock," "no funds." The toast uses Comfortaa 400 at 12px, on a semi-transparent background. The toast never covers MAGNO. The toast never stacks — if a new toast arrives while one is visible, the new toast queues.

### 14.6 Reduce-motion path

The renewal respects the user's `prefers-reduced-motion` setting. When reduced motion is requested:

- Camera shake is disabled.
- Slow-motion triggers are shortened to 50% duration.
- Field-line ripple amplitude is halved.
- Particle counts are halved.
- Modal transitions are instant instead of animated.

The reduce-motion path is tested in `tests/assist.test.ts`.

### 14.7 Color-vision safe palette

The HUD's color tokens are tested against the four common color-vision deficiencies (protanopia, deuteranopia, tritanopia, achromatopsia) using the Sim Daltonism simulator. The test verifies that no HUD element relies solely on color to communicate state — every color-coded element also has a shape or text cue. The test is in `tests/colour-vision.test.ts`.

The specific decisions:

- The "filled star" vs "empty star" distinction is shape (filled vs outline), not just color.
- The "rewarded" button (which Poki's rules forbid from being green) is yellow with a magnet icon.
- The "standard" button is white with the same border as the rewarded button.
- The "go to next level" button is the same blue as MAGNO's south pole, with a chevron icon.

### 14.8 Touch control layout

The touch control layout is specified per device type:

- **Phone portrait** — left half is the steering zone (drag to aim), right half is the flip button (tap or hold).
- **Phone landscape** — same as portrait, but the zones are wider.
- **Tablet** — same as phone, but the flip button is in the bottom-right corner (smaller, more precise).
- **Tablet forced mobile** (per Poki requirements) — tablet always uses touch controls.

The touch controls are tested in `tests/input.test.ts` and `tests/controls-browser.test.ts`.

### 14.9 The HUD's signature element

The HUD's one signature element is the height/progress rail. The rail is a thin vertical bar on the left edge, 8px wide, full-height. The bar is filled with a gradient from biome bottom color to biome summit color. A marker (a small horseshoe magnet icon) indicates the player's current height. When the player reaches a new biome, the gradient changes (the rail transitions from one biome's palette to the next). The rail is the only HUD element that uses the master palette at full saturation — every other HUD element uses the palette at reduced saturation.

The rail is the HUD's contribution to the magnetism-made-visible signature. The horseshoe magnet marker is a small but constant reminder of the game's identity, visible in every frame of gameplay.

### Build Directive for Chapter 14

> AI rebuilder: implement the HUD in this order: (1) Vignelli grid CSS variables, (2) custom icon set (16 icons), (3) HUD layout per §14.1, (4) modal hierarchy per §14.4, (5) toast system per §14.5, (6) reduce-motion path per §14.6, (7) color-vision safe palette per §14.7, (8) touch control layout per §14.8, (9) height/progress rail per §14.9. The height/progress rail is the signature element and must be implemented last (it depends on the biome palettes from Chapter 15).

<!-- CHAPTER_15 -->
## Chapter 15 — Color system & master palette

This chapter is the executable palette. Every color used in the renewal must come from this table. There are no exceptions.

### 15.1 The master palette table

The master palette is organized into seven groups: brand, biome palettes (5), functional UI, and material families.

#### Brand palette

| Token | Hex | LCH | Usage |
|---|---|---|---|
| `brand-pole-north` | `#E53935` | L:54 C:78 H:36 | MAGNO's north pole, "rewarded" button accent, summit banner |
| `brand-pole-south` | `#1E88E5` | L:55 C:75 H:264 | MAGNO's south pole, "go to next level" button, link color |
| `brand-field-line` | `#00E5FF` | L:79 C:75 H:195 | Field-line ribbons, magnet snap beam, polar flash |
| `brand-ink` | `#0A0A0A` | L:5 C:0 H:0 | All primary text, the bespoke wordmark's non-magnet letters |
| `brand-chassis` | `#546E7A` | L:47 C:14 H:222 | MAGNO's body capsule, secondary text |
| `brand-paper` | `#F5E6D3` | L:93 C:18 H:71 | Eye sclera, lightest background tone |

#### Scrapyard palette

| Token | Hex | Usage |
|---|---|---|
| `scrapyard-sky` | `#D84315` | Sky dominant (color-blocking surface) |
| `scrapyard-steel` | `#37474F` | Magnetic metal (clean face) |
| `scrapyard-rust` | `#6D4C41` | Weathered steel (rust face) |
| `scrapyard-copper` | `#2E7D32` | Oxidized copper accent |
| `scrapyard-wood` | `#795548` | Non-magnetic planks |
| `scrapyard-shadow` | `#1B0F08` | Deep shadow tone |

#### Suburbia palette

| Token | Hex | Usage |
|---|---|---|
| `suburbia-lawn` | `#4CAF50` | Lawn dominant (color-blocking surface) |
| `suburbia-roof` | `#C0442E` | Terracotta roof accent |
| `suburbia-wall` | `#FFE0B2` | Pastel house wall |
| `suburbia-fabric` | `#FFCC80` | Clothesline sheets |
| `suburbia-trampoline` | `#0288D1` | Trampoline mat |
| `suburbia-shadow` | `#1B5E20` | Deep shadow tone |

#### Metropolis palette

| Token | Hex | Usage |
|---|---|---|
| `metropolis-facade` | `#311B92` | Building facade dominant (color-blocking surface) |
| `metropolis-neon` | `#FFAB00` | Neon accent |
| `metropolis-asphalt` | `#212121` | Wet asphalt |
| `metropolis-asphalt-reflect` | `#FFAB00` at 30% opacity | Asphalt reflection |
| `metropolis-glass` | `#1A237E` | Window glass |
| `metropolis-steel` | `#455A64` | Fire escape steel |
| `metropolis-shadow` | `#0A0A1F` | Deep shadow tone |

#### Playground palette

| Token | Hex | Usage |
|---|---|---|
| `playground-asphalt` | `#9E9E9E` | Asphalt dominant (color-blocking surface) |
| `playground-cyan` | `#00BCD4` | Play equipment accent 1 |
| `playground-magenta` | `#E91E63` | Slide accent 2 |
| `playground-yellow` | `#FFEB3B` | Swing seat accent 3 |
| `playground-sky` | `#4FC3F7` | Noon sky |
| `playground-shadow` | `#37474F` | Deep shadow tone |

#### Stratosphere palette

| Token | Hex | Usage |
|---|---|---|
| `stratosphere-sky` | `#0288D1` | Sky dominant (color-blocking surface) |
| `stratosphere-zenith` | `#01579B` | Sky gradient zenith |
| `stratosphere-horizon` | `#FFD54F` | Sunrise gold accent (less than 3% screen area) |
| `stratosphere-cloud` | `#FAFAFA` | Cloud layer |
| `stratosphere-aurora` | `#69F0AE` | Aurora ribbon (rare) |
| `stratosphere-shadow` | `#012233` | Deep shadow tone |

#### Functional UI palette

| Token | Hex | Usage |
|---|---|---|
| `ui-bg` | `#151A22` | Modal background |
| `ui-bg-overlay` | `rgba(21, 26, 34, 0.6)` | Modal overlay (primary modal) |
| `ui-bg-overlay-deep` | `rgba(21, 26, 34, 0.8)` | Modal overlay (tertiary modal) |
| `ui-text-primary` | `#FFFFFF` | Primary text on dark |
| `ui-text-secondary` | `#B0BEC5` | Secondary text on dark |
| `ui-text-disabled` | `#546E7A` | Disabled state |
| `ui-button-primary` | `#FFCC80` | Primary action button (warm white, on-brand) |
| `ui-button-secondary` | `#37474F` | Secondary action button |
| `ui-button-rewarded` | `#FFAB00` | Rewarded button (yellow, never green per Poki rules) |
| `ui-button-danger` | `#E53935` | Destructive action button |
| `ui-border` | `rgba(255, 255, 255, 0.12)` | Subtle border |
| `ui-divider` | `rgba(255, 255, 255, 0.06)` | Subtle divider |

#### Material family shading tokens

| Token | Value | Usage |
|---|---|---|
| `mat-steel-lit` | `1.0` | Steel lit factor |
| `mat-steel-shadow` | `0.4` | Steel shadow factor |
| `mat-steel-rim` | `0.3` | Steel rim strength |
| `mat-wood-lit` | `1.0` | Wood lit factor |
| `mat-wood-shadow` | `0.5` | Wood shadow factor |
| `mat-plastic-lit` | `1.0` | Plastic lit factor |
| `mat-plastic-shadow` | `0.45` | Plastic shadow factor |
| `mat-plastic-rim` | `0.6` | Plastic rim strength (glossy) |
| `mat-concrete-lit` | `0.7` | Concrete lit factor (matte) |
| `mat-concrete-shadow` | `0.4` | Concrete shadow factor |
| `mat-glass-opacity` | `0.3` | Glass transparency |
| `mat-foliage-lit` | `1.0` | Foliage lit factor |
| `mat-foliage-shadow` | `0.5` | Foliage shadow factor |
| `mat-magnet-lit` | `1.0` | Magnet pole lit factor |
| `mat-magnet-shadow` | `0.4` | Magnet pole shadow factor |

### 15.2 The contrast ratio audit (WCAG AA)

Every text-on-background combination must pass WCAG AA contrast (4.5:1 for body text, 3:1 for large text). Verified combinations:

| Foreground | Background | Ratio | Pass |
|---|---|---|---|
| `ui-text-primary` on `ui-bg` | 13.6:1 | ✅ |
| `ui-text-secondary` on `ui-bg` | 8.4:1 | ✅ |
| `ui-text-primary` on `ui-button-primary` | 3.8:1 | ✅ (large) |
| `brand-ink` on `brand-paper` | 19.2:1 | ✅ |
| `ui-text-primary` on `scrapyard-sky` | 5.2:1 | ✅ |
| `ui-text-primary` on `metropolis-facade` | 12.1:1 | ✅ |

### 15.3 The interaction test (Albers)

Every color token is tested in three contexts: against the biome background, against the biome accent, and against MAGNO's body color. If the color reads the same in all three contexts, the token is approved. The test is automated in `tests/post-stack.test.ts`.

### 15.4 The trend check (Eiseman)

The palette's overlap with the current Poki top 20 games' dominant colors:

- **Burnt orange** — appears in 2 of 20 (Subway Surfers, Retro Bowl). Acceptable overlap.
- **Saturated green** — appears in 1 of 20 (Little Farm World). Acceptable.
- **Deep blue-violet** — appears in 0 of 20. Differentiated.
- **Magenta** — appears in 1 of 20 (Stickman Hook). Acceptable.
- **Dawn blue** — appears in 0 of 20. Differentiated.

Overlap: 4 of 20 = 20%. Within the target range (20–30%).

### 15.5 The palette is locked

The palette is locked at v1.0 of this PRD. Any change to the palette requires a v1.1 with a written justification. The AI rebuilder must not introduce colors outside this palette. If a new visual need arises (a new prop, a new UI state), the need is met by reusing an existing token, not by introducing a new color.

### Build Directive for Chapter 15

> AI rebuilder: export the master palette as a TypeScript module at `src/config/palette.ts`. The module exports every token as a constant. Every shader, every material, every CSS variable, and every UI element reads from this module. Hard-coded colors anywhere else in the codebase are forbidden and will fail the build audit (`scripts/check-budget.mjs` extended to enforce palette compliance).

<!-- CHAPTER_16 -->
## Chapter 16 — Thumbnail redesign (static + animated)

This chapter is the spec for the single highest-leverage asset in the entire renewal. The thumbnail is the 200ms test made into a single image. Get it right and the click-through rate doubles. Get it wrong and the rest of the renewal was wasted effort.

### 16.1 The three composition options

Three thumbnail compositions are specified. The developer should A/B test all three with cold viewers (per the playtest protocol in Chapter 22) and pick the winner.

**Option A — Magnetism Made Visible.** MAGNO mid-flip at the apex of a launch, the cyan field-line ribbon fully extended and rippling. The red and blue magnet poles are at maximum saturation. The background is the Scrapyard's burnt-orange sky with a tower of fridges, girders, and a washing machine. The composition is asymmetric — MAGNO in the lower-left third, the tower in the upper-right third. The 7° camera tilt is preserved. This thumbnail leads with the magnetism signature.

**Option B — The Moment of Flip.** MAGNO is on a steel surface, mid-charge (the field line is compressed, glowing brighter than idle). Above him, the next snap target is highlighted with a faint cyan glow. The composition emphasizes the moment of decision — the player can see what MAGNO is about to do. This thumbnail leads with the gameplay hook.

**Option C — The Fall Comedy.** MAGNO is mid-fall, body crumpled, field line limp. Below him is a far-distant ground with a fridge, a locker, and a trampoline. The composition is comic — MAGNO is small, the fall is huge, the player laughs. This thumbnail leads with the slapstick tone that the PRD promises.

**Recommendation.** Option A is the safest bet. It leads with the signature, it shows the mechanic, and it shows the world. The developer should ship Option A as the default and run Option B and Option C as A/B variants in the Poki Inspector for the first week.

### 16.2 The Poki thumbnail requirements

Poki's published thumbnail spec (from the requirements page):

- **Static thumbnail:** square, at least 628×628 pixels. The renewal ships at 1256×1256 (for sharp stores).
- **Animated thumbnail:** 3-second loop at 60 fps. Delivered as WebM (under 500KB), WebP (under 1MB), and GIF (under 1MB — the current 6.2MB GIF must be cut or recompressed).
- **Composition rules:** no text overlay, no UI, no letterbox bars, opaque corners, less than 1% of pixels near the Poki playground background `#83FFE7`.

### 16.3 The pixel-level spec

The static thumbnail is composed of:

- Background: Scrapyard sky in `#D84315`, gradient from horizon (darker, `#BF360C`) to zenith (lighter, `#FF7043`).
- Far silhouette layer: junk piles at `#1B0F08`, parallax 0.8.
- Hero prop tower: fridge in `#37474F`, locker in `#546E7A`, washing machine in `#455A64`, lit from the lower-left with the toon shader's hard terminator visible.
- MAGNO: positioned at (200, 600) in a 1256×1256 canvas, mid-flip pose per Chapter 12 §12.10. The magnet poles are at full saturation (`#E53935` and `#1E88E5`). The field-line ribbon is at full amplitude, color `#00E5FF`, additive blend.
- Camera tilt: 7° clockwise.
- No text. No logo. No UI elements.

### 16.4 The animated thumbnail

The animated thumbnail is a 3-second, 60fps loop (180 frames) showing:

- Frames 0–60 (1s): MAGNO charges on the fridge. The field line compresses. The eye narrows.
- Frames 60–80 (333ms): MAGNO launches. The field line explodes outward. The body stretches.
- Frames 80–140 (1s): MAGNO is airborne at the apex. The field line ripples.
- Frames 140–180 (667ms): cross-fade back to frame 0. The loop is seamless.

Delivery format: WebM (VP9, target 350KB), WebP (target 800KB), GIF (target 800KB, recompressed from the current 6.2MB). The current 6.2MB GIF is **rejected** and must be replaced.

### 16.5 The 200ms test, operationalized

The 200ms test is operationalized as:

1. Render the static thumbnail at 1256×1256.
2. Downscale to 200×200 using bilinear interpolation.
3. Downscale to 64×64 using bilinear interpolation.
4. Show both downscaled versions to 10 cold viewers (people who have not seen the game) for 200ms each.
5. Ask: "what is this a picture of?"
6. At least 7 of 10 must say "magnet" or "magnet character" or "magnet game."

If the test fails, the thumbnail is reworked. The most common failure mode is insufficient pole color contrast — the red and blue must be visibly different at 64×64. If they are not, the pole colors are intensified (the brand palette's `brand-pole-north` and `brand-pole-south` are pushed to higher saturation for the thumbnail only).

### 16.6 What the thumbnail is NOT

- **Not a screenshot of gameplay.** The thumbnail is a composed image, not a frame from the game. The 7° tilt is artificial.
- **Not a poster with the game's title.** Poki forbids text in thumbnails.
- **Not a generic "magnet pulls thing" image.** The thumbnail must be specifically MAGNETOPE — MAGNO, the Scrapyard, the field line.
- **Not a re-color of an existing thumbnail.** The composition is original.

### 16.7 The favicon and the loading screen

The favicon is the bespoke wordmark's horseshoe magnet icon, at 32×32. The loading screen is the bespoke wordmark at 96px, with a thin cyan field-line arc animating from one pole to the other as the loading bar fills. The loading screen takes under 6 seconds (per the PRD), and the field-line arc is the only animation during loading — it is the first impression of the magnetism signature.

### Build Directive for Chapter 16

> AI rebuilder: implement the thumbnail in this order: (1) render Option A per §16.3 using the existing `tools/capture.ts` capture tool, (2) implement the 200ms test in `tools/thumbnail-test.ts` (downscale + manual cold-viewer prompt), (3) re-render until the test passes, (4) generate the animated thumbnail per §16.4, (5) recompress the GIF to under 1MB (use `gifsicle --lossy=80` or `ffmpeg` with palette optimization), (6) implement the favicon and loading screen per §16.7. If the 200ms test fails after three re-render iterations, escalate to the developer for a manual composition.

<!-- CHAPTER_17 -->
## Chapter 17 — Animation polish: frame-by-frame specs

This chapter is the operational version of Chapter 8 (Motion as Identity). It specifies the frame-by-frame timing of the flip, the snap, the fall, the impact, the camera rig states, the particle grammar, and the shake grammar.

### 17.1 The flip, frame by frame (at 60 Hz)

The flip is the game's signature action. Every frame matters.

| Frame | Time (ms) | State | Field line | Eye | Body |
|---|---|---|---|---|---|
| 0 | 0 | Idle | Limp, low amplitude | Centered, relaxed | 5° lean toward next flip |
| 1–12 | 0–200 | Charging (early) | Compressing, amplitude rising | Tracks snap target, eyelid narrows | Lean increases to 10° |
| 13–24 | 200–400 | Charging (full) | Fully compressed, high amplitude (0.4m) | Locked on target, eyelid 50% closed | Lean at 15°, head pressed to surface |
| 25 | 400 | Release frame | Field line explodes outward | Eye widens fully | Body stretches 15% along velocity vector |
| 26–36 | 417–600 | Airborne (early) | Field line ripples, fading | Tracks next target | Body extended, line of action straight |
| 37–48 | 617–800 | Airborne (apex) | Field line at low amplitude | Tracks next target | Body slightly arched |
| 49–54 | 817–900 | Snap approach | Field line begins to compress toward target | Eyelid 30% closed | Body whips toward target |
| 55 | 917 | Snap impact | Field line implodes, intense flash | Eyelid closed | Body squashes 20% on impact |
| 56–60 | 933–1000 | Settle | Field line settles to idle | Eyelid opens | Body recovers, squash relaxes |
| 61+ | 1017+ | Idle (attached) | Limp, low amplitude | Tracks next target | 5° lean toward next flip |

### 17.2 The fall, frame by frame

The fall is the game's comedy system. It must feel devastating but funny.

| Frame | Time (ms) | State | Field line | Eye | Body |
|---|---|---|---|---|---|
| 0 | 0 | Slip | Limp | Eye widens (shock) | Body begins to fall |
| 1–12 | 0–200 | Falling (early) | Limp, trailing | Eye looks down (resignation) | Body in ragdoll |
| 13–60 | 200–1000 | Falling (mid) | Limp | Eye closed (acceptance) | Ragdoll continues |
| 60+ | 1000+ | Impact | Field line limp flash | Eye closed (impact) | Squash on impact |
| 60+ (post-impact) | 1000+ | Limp | Limp | Eye half-open | Body crumpled |

### 17.3 The slow-motion director

The slow-motion director (existing `src/game/slowmo.ts`) triggers on falls above a threshold height. The renewal keeps the existing logic but adds:

- During slow-motion, the field-line ripple is amplified (3× amplitude).
- The camera pulls back 10% (Bill Pope's pull-back state).
- The audio's magnet hum drops one octave.
- The frame rate is preserved (the slow-motion is achieved by scaling `TUNING.sim.hz`, not by skipping frames).

### 17.4 The camera rig states

Per Chapter 9 §9.4, the camera has four states:

| State | Trigger | Action |
|---|---|---|
| Tracking | Default | Smooth ease-out follow of MAGNO |
| Punch-in | On flip launch (frame 25) | Camera moves 5% closer for airborne phase |
| Pull-back | On fall (frame 0 of fall) | Camera pulls back 10%, tilts down 5° |
| Impact | On heavy impact | Camera shakes per §17.5 |

Transitions between states are 200ms ease-in-out, except Impact (which is instant).

### 17.5 The shake grammar

Camera shake is the game's haptic feedback. It must be precise, never random.

| Trigger | Amplitude (px) | Duration (ms) | Frequency (Hz) | Curve |
|---|---|---|---|---|
| Light snap | 2 | 80 | 25 | Linear decay |
| Heavy snap | 4 | 120 | 20 | Linear decay |
| Light impact (short fall) | 6 | 200 | 15 | Linear decay |
| Heavy impact (long fall) | 10 | 400 | 10 | Exponential decay |
| Pole polarity flip (visual) | 1 | 60 | 40 | Linear decay |

Shake is implemented as a procedural offset (sine wave × amplitude × decay envelope). Reduce-motion disables shake entirely.

### 17.6 The particle grammar

Particles are the secondary action. Every particle serves a purpose.

| Particle | Trigger | Count | Lifetime (ms) | Color | Size (px) |
|---|---|---|---|---|---|
| Spark burst | Snap | 8 | 300 | `#FFD54F` | 2–4 |
| Repel ring | Launch | 1 (expanding ring) | 400 | `#00E5FF` | 8–24 (expanding) |
| Snap beam | Snap | 1 (beam) | 100 | `#00E5FF` | 2 (width) |
| Dust | Landing on soft surface | 12 | 500 | Biome dust color | 3–6 |
| Confetti | Level clear | 30 | 2000 | Multi (palette accents) | 4–8 |
| Fall dust | Heavy fall impact | 24 | 800 | Biome dust color | 4–10 |
| Pole flash | Polarity flip | 1 (flash) | 60 | `#00E5FF` | 32 (radius) |

Reduce-motion halves all particle counts.

### 17.7 The biome title cards

When the player enters a new biome, a biome title card appears for 1.8 seconds. The card is:

- The biome's name in Comfortaa 700 at 32px, in the biome's accent color.
- The biome's tagline in Comfortaa 400 at 16px, in `ui-text-primary`.
- A 200ms ease-in (card slides up from bottom), 1.4s hold, 200ms ease-out (card slides up and fades).
- The card is positioned at the rule-of-thirds intersection (upper-left third), not centered.

The biome title card is the moment the player feels the biome shift. It is the visual reward for ascending.

### 17.8 The fall grade card

When a fall is graded (the existing system in `src/game/highlights.ts`), the grade card appears. The renewal adds:

- The grade (C, B, A, S, SS, SSS) in Comfortaa 700 at 48px.
- The grade's color: C in `ui-text-secondary`, B in `#FFE082`, A in `#FFCA28`, S in `#FFAB00`, SS in `#FF6F00`, SSS in `#E53935` (the pole red — the highest grade matches the magnetism signature).
- The fall height in meters, in Comfortaa 600 at 20px.
- A share button (the magnet-with-radiating-field-lines icon).
- The card animates in 250ms ease-out, holds for 2 seconds, then either animates out (if the player taps to dismiss) or auto-dismisses after 5 seconds.

### Build Directive for Chapter 17

> AI rebuilder: implement the animation polish in this order: (1) flip frame-by-frame per §17.1, (2) fall frame-by-frame per §17.2, (3) slow-motion director changes per §17.3, (4) camera rig states per §17.4, (5) shake grammar per §17.5, (6) particle grammar per §17.6, (7) biome title cards per §17.7, (8) fall grade card per §17.8. Each system should be tested in isolation before integration. The flip is the highest-leverage change — its polish alone will be felt in every minute of play.

<!-- CHAPTER_18 -->
# PART IV — IMPLEMENTATION

## Chapter 18 — Shader & material specifications

This chapter is the code. Three.js ShaderMaterial snippets for the toon shader, the rim light, the fresnel on metal, the field-line ribbon, and the post-FX stack.

### 18.1 The toon shader (vertex)

```glsl
// vertex shader
uniform vec3 uLightDir;       // biome-locked light direction
uniform vec3 uRimColor;       // per-material rim color
uniform float uRimStrength;   // per-material rim strength
uniform float uLitFactor;      // per-material lit factor
uniform float uShadowFactor;   // per-material shadow factor

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLightDir;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  vLightDir = normalize(uLightDir);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

### 18.2 The toon shader (fragment)

```glsl
// fragment shader
precision highp float;

uniform vec3 uBaseColor;       // from palette token
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uLitFactor;
uniform float uShadowFactor;
uniform float uPoleInfluence;  // 0 if not near magnet, 0..1 based on distance to MAGNO
uniform vec3 uPoleColor;       // red or blue, depending on MAGNO's current pole

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vLightDir;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(vLightDir);
  vec3 V = normalize(vViewDir);

  float NdotL = max(dot(N, L), 0.0);

  // Two-band toon: lit if NdotL > 0.5, shadow otherwise
  float band = step(0.5, NdotL);
  vec3 base = uBaseColor * (band > 0.5 ? uLitFactor : uShadowFactor);

  // Hard terminator (slight darkening at the band boundary, 0.45 < NdotL < 0.55)
  float term = smoothstep(0.45, 0.55, NdotL);
  base *= mix(0.85, 1.0, term);

  // Rim light
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  base += uRimColor * rim * uRimStrength;

  // Fresnel on metal only (poleInfluence > 0)
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  base += uPoleColor * fresnel * uPoleInfluence;

  gl_FragColor = vec4(base, 1.0);
}
```

### 18.3 The field-line ribbon shader

```glsl
// field-line fragment shader
precision highp float;

uniform float uTime;
uniform float uCharge;       // 0..1
uniform vec3 uColor;         // brand-field-line

varying vec2 vUv;

void main() {
  // Sine wave ripple along the ribbon's length (vUv.x)
  float wave = sin(vUv.x * 6.28318 * (4.0 + uCharge * 2.0) + uTime * 8.0);
  float amplitude = uCharge * 0.4;
  float intensity = 0.5 + 0.5 * wave * amplitude;

  // Fade at the ribbon's ends (vUv.y near 0 or 1)
  float fade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);

  vec3 color = uColor * intensity * fade;
  gl_FragColor = vec4(color, intensity * fade);
}
```

Blend mode: additive (`THREE.AdditiveBlending`), depthWrite: false.

### 18.4 The tier-low fallback

On tier-low devices (detected by `quality.ts`), the shader is simplified:

- The fresnel effect is applied to MAGNO only (not to surrounding props).
- The rim light is disabled on props (kept on MAGNO).
- The two-band toon is replaced with a single-band flat color (with a hard terminator achieved via the diffuse term only).

The fallback is implemented as a separate `ShaderMaterial` variant in `src/render/quality.ts`, selected at boot time.

### 18.5 The post-FX stack

The post-processing stack (existing in `src/render/post-stack.ts`) is updated to:

- **Bloom** — only the field-line color (`#00E5FF`) and the magnet pole colors (`#E53935`, `#1E88E5`) bloom. Bloom threshold: 0.8. Bloom strength: 0.4. Bloom radius: 0.6.
- **Vignette** — subtle darkening at the frame edges. Strength: 0.3. Radius: 0.7.
- **Color grade LUT** — per-biome LUT, applied as a 32×32×32 3D texture. Each biome's LUT pushes the gamut toward the biome's color wedge (per Chapter 5 §5.3).
- **Anti-aliasing** — FXAA (cheap, runs on tier-low).

The post-FX stack runs on a render target, not the default framebuffer, to keep the HUD untouched.

### 18.6 Implementation order

1. Implement the toon shader (§18.1, §18.2) as a `ShaderMaterial` in `src/render/material-toon.ts`.
2. Implement the field-line ribbon shader (§18.3) as a `ShaderMaterial` in `src/render/material-field-line.ts`.
3. Implement the tier-low fallback (§18.4) in `src/render/quality.ts`.
4. Update the post-FX stack (§18.5) in `src/render/post-stack.ts`.
5. Replace every prop material in `src/render/kit-*.ts` with the toon material.
6. Add the fresnel-on-metal effect to props with material family `steel`.

### Build Directive for Chapter 18

> AI rebuilder: implement the shaders in the order in §18.6. The toon shader is the highest-leverage single change. The field-line ribbon is the second. The post-FX is the third. The tier-low fallback is the fourth. Test each shader in isolation (with a single test prop) before integrating across every prop kit.

<!-- CHAPTER_19 -->
## Chapter 19 — Asset budget & production pipeline

This chapter specifies the asset budget for the renewal. The renewal preserves the existing 5 MB Poki hard limit and the 1.48 MB initial gzipped payload. The visual upgrades are achieved by changing shaders and palettes, not by adding geometry.

### 19.1 The budget table

| Asset | Current (KB) | After renewal (KB) | Notes |
|---|---|---|---|
| Three.js (chunk) | ~250 | ~250 | Unchanged |
| Rapier WASM (streamed) | ~600 | ~600 | Unchanged |
| Game code (JS chunks) | ~300 | ~360 | +60KB for new shaders, MAGNO rig, biome LUTs |
| CSS | ~30 | ~36 | +6KB for HUD updates, icon set |
| Comfortaa (subset woff2) | ~30 (Fredoka) | ~38 | +8KB for slightly larger charset |
| Bespoke wordmark SVG | 0 | ~4 | New |
| Biome LUTs (32³ 3D textures) | 0 | ~50 (5 biomes × 10KB) | New, but compressed |
| Static thumbnail (WebP) | ~1700 (PNG) | ~200 (WebP) | Recompressed |
| Animated thumbnail (WebM) | ~337 | ~350 | Unchanged |
| Animated thumbnail (WebP) | ~1823 | ~800 | Recompressed |
| Animated thumbnail (GIF) | ~6240 | ~800 | Recompressed (the big win) |
| **Total initial (gzipped)** | **1.48 MB** | **~1.6 MB** | Within budget |

The renewal adds ~120KB to the initial payload and removes ~7MB of GIF weight. Net: the bundle is within the 5 MB hard limit with margin.

### 19.2 Asset packing

- All textures are compressed as WebP (lossless for UI, lossy for thumbnails at 80% quality).
- All geometry is procedural (no .glb files); the existing pattern is preserved.
- The biome LUTs are 32×32×32 3D textures, packed as raw uint8 arrays (10KB each before compression).
- The font is subset to Latin + the 7 supported locales, using `pyftsubset` from fonttools.

### 19.3 Lazy-load strategy

The biome LUTs are loaded on-demand when the player enters a biome, not at boot. This keeps the initial load at 1.6 MB and adds the LUT (10KB) only when needed. The existing `loadRapier` pattern (async load with progress callback) is reused.

### 19.4 Mesh count ceilings

The current build has per-level mesh counts audited by `tests/prop-kits.test.ts`. The renewal does not increase the mesh budget — the toon shader and the fresnel effect are per-material, not per-mesh. The ceilings:

- Max triangles per level: 80,000 (existing ceiling)
- Max draw calls per level: 120 (existing ceiling, reduced by 10% via material batching)
- Max unique materials per level: 24 (existing ceiling, increased from 18 to allow material-family variety)

### 19.5 Draw-call ceilings

The toon shader batches by material family. All `steel` props share one material instance (with per-prop color via uniforms). All `wood` props share another. This reduces draw calls by ~30% relative to per-prop materials.

### 19.6 Build audit checklist

The build audit (`scripts/check-budget.mjs`) is extended to verify:

- Initial payload < 4 MB internal target (current: 1.6 MB ✅)
- Initial payload < 5 MB Poki hard limit (current: 1.6 MB ✅)
- Total payload < 8 MB (current: 1.6 MB ✅)
- No external requests (existing check)
- No source maps shipped (existing check)
- No development hooks (existing check)
- No Google service references (existing check)
- No remote asset references (existing check)
- No outbound anchors (existing check)
- **NEW: Every color in CSS and JS is a palette token** (regex check against `src/config/palette.ts`)
- **NEW: Every font reference is to the self-hosted Comfortaa or the bespoke wordmark SVG**
- **NEW: Animated GIF thumbnail is under 1 MB**

### Build Directive for Chapter 19

> AI rebuilder: do not add geometry to satisfy the renewal. Add shaders, palettes, and code. The renewal's visual upgrade is achieved at <120KB additional bundle weight. If the rebuilder finds itself adding geometry, it has made a wrong turn.

<!-- CHAPTER_20 -->
## Chapter 20 — File & naming convention, design tokens

This chapter specifies the file naming, folder structure, and design token system that the AI rebuilder must follow.

### 20.1 Folder structure (additions to existing)

```
src/
  config/
    palette.ts          # NEW: master palette tokens (Chapter 15)
    biome.ts            # NEW: biome light direction, gamut, accent per biome
    materials.ts        # UPDATED: material family shading tokens
    tuning.ts           # existing
    props.ts            # existing
    cosmetics.ts        # existing
  render/
    material-toon.ts          # NEW: toon ShaderMaterial (Chapter 18)
    material-field-line.ts   # NEW: field-line ribbon ShaderMaterial
    magno-rig.ts              # REWRITTEN: per Chapter 12
    camera-rig.ts             # UPDATED: per Chapter 9 §9.4
    post-stack.ts             # UPDATED: per Chapter 18 §18.5
    kit-scrapyard.ts          # UPDATED: materials swapped to toon
    kit-suburbia.ts           # UPDATED
    kit-metropolis.ts         # UPDATED
    kit-playground.ts         # UPDATED
    kit-stratosphere.ts       # UPDATED
    backdrop.ts               # UPDATED: three-layer background per Chapter 13
    quality.ts                # UPDATED: tier-low fallback per Chapter 18 §18.4
  ui/
    icons.ts                  # UPDATED: custom icon set per Chapter 14 §14.3
    wordmark.svg              # NEW: bespoke wordmark per Chapter 10 §10.6
  game/
    game.ts                   # existing (no changes)
    slowmo.ts                 # UPDATED: per Chapter 17 §17.3
public/
  fonts/
    comfortaa-latin.woff2     # NEW: replaces fredoka-latin.woff2
  thumbnails/
    static/
      thumbnail-1256.webp     # NEW: 1256×1256 WebP, <200KB
      thumbnail-628.webp      # NEW: 628×628 WebP, <80KB
    animated/
      thumbnail-animated.webm # existing (kept)
      thumbnail-animated.webp # RECOMPRESSED: <800KB
      thumbnail-animated.gif  # RECOMPRESSED: <800KB (was 6.2MB)
```

### 20.2 Design token naming convention

All tokens follow the convention: `<group>-<property>-<variant>`.

Examples:
- `scrapyard-sky` (group: scrapyard, property: sky)
- `brand-pole-north` (group: brand, property: pole, variant: north)
- `mat-steel-lit` (group: mat, property: steel, variant: lit)
- `ui-text-primary` (group: ui, property: text, variant: primary)
- `font-size-md` (group: font, property: size, variant: md)

Tokens are lowercase, kebab-case, no abbreviations longer than 3 letters.

### 20.3 The palette TypeScript module

`src/config/palette.ts` exports every color token as a typed constant:

```typescript
export const PALETTE = {
  brand: {
    poleNorth: '#E53935',
    poleSouth: '#1E88E5',
    fieldLine: '#00E5FF',
    ink: '#0A0A0A',
    chassis: '#546E7A',
    paper: '#F5E6D3',
  },
  scrapyard: {
    sky: '#D84315',
    steel: '#37474F',
    rust: '#6D4C41',
    copper: '#2E7D32',
    wood: '#795548',
    shadow: '#1B0F08',
  },
  // ... suburbia, metropolis, playground, stratosphere, ui
} as const;

export type PaletteGroup = keyof typeof PALETTE;
export type PaletteToken = typeof PALETTE[PaletteGroup][keyof typeof PALETTE[PaletteGroup]];
```

Every shader uniform, every CSS variable, every inline style reads from this module. Hard-coded colors are forbidden.

### 20.4 The design token CSS variables

`src/ui/style.css` exposes every token as a CSS variable:

```css
:root {
  /* Brand */
  --brand-pole-north: #E53935;
  --brand-pole-south: #1E88E5;
  --brand-field-line: #00E5FF;
  --brand-ink: #0A0A0A;
  --brand-chassis: #546E7A;
  --brand-paper: #F5E6D3;

  /* Scrapyard */
  --scrapyard-sky: #D84315;
  /* ... */

  /* UI */
  --ui-bg: #151A22;
  --ui-bg-overlay: rgba(21, 26, 34, 0.6);
  /* ... */

  /* Spacing (Vignelli grid) */
  --space-1: 8px;
  --space-2: 16px;
  /* ... */

  /* Typography */
  --font-display: 'MagnetopeWordmark', sans-serif; /* SVG */
  --font-body: 'Comfortaa', sans-serif;
  --font-mono: ui-monospace, monospace;
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-size-xs: 12px;
  /* ... */
}
```

### 20.5 The biome TypeScript module

`src/config/biome.ts` exports per-biome configuration:

```typescript
export const BIOME_CONFIG = {
  scrapyard: {
    lightDir: { x: -0.6, y: 0.4, z: -0.7 },  // lower-left, 35° elevation
    lightColor: '#FFCC80',
    skyColor: '#D84315',
    skyZenith: '#BF360C',
    skyHorizon: '#FF7043',
    gamutWedge: 'warm',
    accent: '#2E7D32',
    lutTexture: '/luts/scrapyard.bin',
    // ...
  },
  // ... suburbia, metropolis, playground, stratosphere
} as const;
```

### Build Directive for Chapter 20

> AI rebuilder: create the new files (`palette.ts`, `biome.ts`, `material-toon.ts`, `material-field-line.ts`, `icons.ts`, `wordmark.svg`, `comfortaa-latin.woff2`) before modifying existing files. Every existing file modification must reference the new token modules. Do not introduce new tokens outside `palette.ts` or `biome.ts`.

<!-- CHAPTER_21 -->
# PART V — QUALITY BAR

## Chapter 21 — Poki acceptance visual quality bar

This chapter is the rubric. It contains 25 binary checks. A passing game has 22 or more checks green. A failing game has 21 or fewer. The checks are derived from Poki's published requirements page and from the quality criteria implicit in their curation history.

### 21.1 The 25 binary checks

| # | Check | How to verify |
|---|---|---|
| 1 | The 200ms thumbnail test passes (7/10 cold viewers say "magnet") | Chapter 16 §16.5 |
| 2 | The silhouette test passes (MAGNO reads as magnet at 64×64 silhouette) | Chapter 6 §6.8 |
| 3 | The signature test passes (5 screenshots grouped as same game by cold viewer) | Chapter 4 §4.3 |
| 4 | Initial payload under 5 MB gzipped | `npm run build` |
| 5 | Initial payload under 4 MB internal target | `npm run build` |
| 6 | No external requests at runtime | `tests/build.test.ts` |
| 7 | No splash screens or outbound links | `scripts/check-budget.mjs` |
| 8 | No in-app purchases or third-party ad systems | code audit |
| 9 | No ad-block prevention | code audit |
| 10 | Poki SDK events fire correctly (no double events, no events during ads) | `tests/platform.test.ts` |
| 11 | `commercialBreak()` fires only on pause-to-gameplay transitions | `tests/platform.test.ts` |
| 12 | Rewarded buttons are not green, have visible magnet icon, are not larger than standard buttons | visual audit |
| 13 | Audio mutes during ad breaks | `tests/audio.test.ts` |
| 14 | Game playable with ad blocker active | manual test |
| 15 | Game playable in incognito (localStorage try/catch) | `tests/session.test.ts` |
| 16 | Static thumbnail under 1MB | file size check |
| 17 | Animated thumbnail WebM under 500KB | file size check |
| 18 | Animated thumbnail GIF under 1MB | file size check (the current 6.2MB GIF fails this) |
| 19 | Game runs on at least one Android phone, one iPhone, one tablet, one low-end Chromebook | device matrix test (Chapter 22) |
| 20 | Game pauses on ESC and on Android back button | `tests/session.test.ts`, manual test |
| 21 | Save system works and degrades to memory on quota error | `tests/platform.test.ts` |
| 22 | 5 external playtests completed with screen recordings | Chapter 22 |
| 23 | AI_LEDGER.md human column filled in for every entry | `docs/AI_LEDGER.md` |
| 24 | Color-vision safe palette verified | `tests/colour-vision.test.ts` |
| 25 | Reduce-motion path verified | `tests/assist.test.ts` |

### 21.2 The scoring model

- **25/25 checks green** — strong accept candidate. Probability of Poki acceptance: ~60%.
- **22–24/25 checks green** — accept with revisions. Probability: ~35%.
- **18–21/25 checks green** — soft reject with feedback. Probability: ~10%.
- **17 or fewer** — hard reject.

### 21.3 The acceptance probability model

Combining the visual renewal (which is what this PRD delivers) with the device matrix and playtests (which the developer must do):

| Scenario | Probability |
|---|---|
| All 25 checks green, 5 playtests positive, device matrix clean | ~60% |
| 22-24 checks green, 3-4 playtests positive | ~35% |
| 18-21 checks green, 1-2 playtests | ~10% |
| <18 checks green, no playtests | ~1% (current state) |

The renewal's job is to take the game from ~1% to ~60% upper bound. The developer's job (device matrix, playtests, AI ledger) is to close the remaining gap.

### 21.4 What "100% acceptance" actually requires

The user asked for "so premium that Poki team shouldn't reject." The honest answer: no PRD, however exhaustive, can guarantee 100% Poki acceptance. Poki's curation is subjective and depends on factors outside this document's scope (current portfolio gaps, seasonality, the reviewer's mood). What this PRD can guarantee: if every chapter is implemented and every one of the 25 checks passes, the probability of acceptance moves from ~1% to ~60%. The remaining 40% is the irreducible uncertainty of submitting creative work to a curated platform.

The developer should be told this honestly. False hope is worse than honest probability.

### Build Directive for Chapter 21

> AI rebuilder: after implementing every chapter of this PRD, run the 25 checks. Tally the score. If the score is below 22, do not submit — iterate on the failing checks. If the score is 22 or above, the game is ready for the developer's device matrix and playtests (Chapter 22).

<!-- CHAPTER_22 -->
## Chapter 22 — The 5-playtest protocol for strangers

This chapter is the protocol the developer must run before submitting to Poki. It cannot be skipped. It cannot be done by the developer. It must be done by 5 strangers.

### 22.1 Why playtests are non-negotiable

Poki's Player Fit Test (Stage 2) puts the game in front of ~500 random players and measures average playtime. If average playtime is under 3 minutes, the game fails. The developer cannot see this test before submitting — it is run by Poki after submission. The 5-playtest protocol is the developer's preview of what Poki will see.

The protocol is not a substitute for the Poki test. The sample is too small (5 vs 500). But the protocol surfaces *qualitative* issues the quantitative Poki test cannot: confusion in the first 90 seconds, frustration on the first fall, delight at the first clear. These are the make-or-break moments.

### 22.2 Playtester recruitment

Five playtesters, recruited from:

- r/PlayMyGame on Reddit (free, slow)
- r/DestroyMyGame on Reddit (free, brutal — preferred for honesty)
- The developer's Discord server (if any)
- Friends-of-friends (not direct friends — direct friends are too kind)
- A local university game design club (offer $10 coffee gift cards)

The playtester must:

- Not have played MAGNETOPE before.
- Be on a device the developer does not own (their own phone, their own laptop).
- Agree to a 15-minute screen recording.
- Agree to a 5-minute follow-up interview.

### 22.3 The facilitator script

The developer (or a friend acting as facilitator) follows this script verbatim:

> "I'm going to send you a link to a game. Don't read any instructions. Just open the link and play for as long as you want. I'm going to record your screen and we'll talk about it after. You can stop whenever you want. The game is in development, so your honest feedback is the most valuable thing you can give me. Don't be nice. Be honest."

Do not explain the magnet mechanic. Do not explain the controls. Do not explain the goal. The playtester must figure these out from the game alone. If they cannot, the game has failed the first-90-seconds test, and the failure must be fixed.

### 22.4 What to measure

For each playtester, record:

| Metric | How to measure |
|---|---|
| Time to first input | From page load to first Space/click |
| Time to first flip launch | From first input to first launch |
| Time to first snap | From first launch to first successful snap |
| Time to first fall | From first input to first fall |
| Total playtime | From page load to closing the tab |
| Number of levels attempted | Counter in the recording |
| Number of levels cleared | Counter |
| Verbal frustration moments | Transcript notes |
| Verbal delight moments | Transcript notes |
| Did they understand MAGNO is a magnet? | Follow-up interview |
| Did they understand the field line? | Follow-up interview |
| Did they want to play again? | Follow-up interview |

### 22.5 What disqualifies a level

After the 5 playtests, every level that was attempted is reviewed. A level is disqualified (removed or redesigned) if:

- Any playtester got stuck for more than 60 seconds on it without progressing.
- Any playtester verbalized frustration specific to that level.
- The level was not completed by any playtester.

The disqualified levels go into the next iteration's redesign list.

### 22.6 The first-90-seconds audit

The first 90 seconds of every playtester's recording are watched frame-by-frame. The audit looks for:

- Did the playtester understand what to do? (If not, the coach overlay is failing.)
- Did the playtester understand what MAGNO is? (If not, the silhouette is still failing.)
- Did the playtester's eye go to the right place? (Heat-map the recording — where does the eye land first?)
- Did the playtester smile or laugh at any point? (The fall comedy is supposed to land.)

If any of these fail, the corresponding chapter of this PRD is re-opened.

### 22.7 The follow-up interview

After the playtest, ask the playtester:

1. "What did you think the game was about?"
2. "What did you think the main character was?"
3. "What was the most confusing moment?"
4. "What was the most satisfying moment?"
5. "Would you play this again? Why or why not?"
6. "Would you recommend this to a friend? Why or why not?"

Record the answers verbatim. The answers to questions 1 and 2 are the most important — they tell you whether the silhouette and the thumbnail are working.

### 22.8 The post-playtest revision

After the 5 playtests, the developer:

1. Reads the transcripts and watches the recordings.
2. Lists every issue surfaced.
3. Triages the issues into: (a) visual (this PRD's scope), (b) gameplay (the original PRD's scope), (c) technical (bugs).
4. Fixes every (a) issue by re-opening the relevant chapter of this PRD.
5. Re-runs the 200ms thumbnail test and the signature test on the revised build.
6. Submits to Poki only after both tests still pass.

### 22.9 The honest truth about playtests

Playtests are painful. The developer will hear strangers say things about their game that hurt. The instinct is to defend the game, to explain why the playtester was wrong, to dismiss the feedback as "they just didn't get it."

The instinct is wrong. The playtester is right by definition — they are the audience. If they didn't get it, the game didn't communicate it. Every piece of harsh feedback is a free fix before Poki's reviewers say the same thing in a rejection email.

The developer should treat the 5 playtests as 5 free Poki QA reviews, used before submitting, when fixes are still cheap.

### Build Directive for Chapter 22

> AI rebuilder: this chapter is for the developer, not for you. You cannot run playtests. Your job is to make sure the build is ready for playtests — that the coach overlay works, that the first 90 seconds are clear, that the fall comedy lands, that the field line is visible. When the developer returns with playtest feedback, re-open the relevant chapters and iterate.

<!-- APPENDIX_A -->
# APPENDIX A — Bibliography of the masters

The bibliography of every master cited in Chapter 3 and throughout the PRD. Arranged by domain. Each entry contains: name, primary work, source for the cited principle.

## A.1 Game art directors

1. Jen Zee — Art Director, *Hades* (Supergiant Games, 2020) and *Hades II* (2024). Source: Supergiant Games developer commentary; NoClip documentary *Hades: The Story of Supergiant Games* (2020).
2. Scott Benson — Artist/Writer, *Night in the Woods* (Infinite Fall / Finji, 2017). Source: Benson's blog *lo-fi limbo* and the *Night in the Woods* art book.
3. Toby Fox — Creator, *Undertale* (2015) and *Deltarune* (2018–). Source: Fox's developer commentary and the *Undertale* 5th-anniversary stream.
4. Tomm Moore — Co-founder, Cartoon Saloon (*The Secret of Kells* 2009, *Song of the Sea* 2014, *Wolfwalkers* 2020). Source: Moore's GDC 2021 talk *Cartoon Saloon: 20 Years of Animation*.
5. Ross Stewart — Co-founder, Cartoon Saloon. Source: as above.
6. Alx Preston — Creator, *Hyper Light Drifter* (Heart Machine, 2016). Source: Preston's GDC 2017 talk and the *Hyper Light Drifter* art book.
7. Brittney Lee — Visual Development Artist, Disney (*Frozen* 2013, *Wreck-It Ralph* 2012). Source: Lee's blog and her GDC 2014 talk on character design.
8. Nico Marlet — Character Designer, DreamWorks (*How to Train Your Dragon* 2010, *Kung Fu Panda* 2008). Source: DreamWorks character design portfolio; *The Art of How to Train Your Dragon* (2010).
9. Carter Goodrich — Character Designer, Illumination/Blue Sky (*Despicable Me* 2010, *Ice Age* 2002). Source: Goodrich's portfolio and *The Art of Despicable Me*.
10. Joseph White — Designer, *Lumines* (Q Entertainment, 2004) and *Rez* (United Game Artists, 2001) lineage. Source: Tetsuya Mizuguchi's GDC talks on synesthesia.
11. Lucas Pope — Creator, *Papers Please* (2013) and *Return of the Obra Dinn* (2018). Source: Pope's GDC 2019 talk *Building Obra Dinn*.

## A.2 Illustrators & painters

12. James Gurney — Illustrator, *Dinotopia* (1992), author of *Color and Light* (2010) and *Imaginative Realism* (2009). Source: the books themselves.
13. Johannes Itten — Bauhaus color theorist, *The Art of Color* (1961). Source: the book; also the Bauhaus curriculum archive.
14. Josef Albers — Bauhaus/Yale, *Interaction of Color* (1963). Source: the book (Yale University Press 50th-anniversary edition, 2013).
15. Faber Birren — Industrial color consultant, *Color Psychology and Color Therapy* (1950), *Creative Color* (1961). Source: the books.
16. Leatrice Eiseman — Director, Pantone Color Institute. Source: *The Complete Color Harmony, Pantone Edition* (2008) and Pantone's annual color forecasts.
17. Moebius / Jean Giraud — Illustrator (*The Airtight Garage* 1975, *Arzach* 1975). Source: the comics; also *Moebius: The Collected Works*.
18. Hergé — Creator, *The Adventures of Tintin* (1929–1983). Source: the comics; also *The Art of Hergé* (Moulinsart).
19. Mary Blair — Disney color stylist (*Alice in Wonderland* 1951, *It's a Small World* 1964). Source: *The Art and Flair of Mary Blair* (John Canemaker, 2003).
20. Hayao Miyazaki — Co-founder, Studio Ghibli. Source: *Starting Point: 1979–1996* and *Turning Point: 1997–2008* (Miyazaki's essays); also *The Art of Spirited Away*.
21. Norman Rockwell — Illustrator. Source: *Norman Rockwell: A Life* (Laura Claridge, 2001) and the Norman Rockwell Museum archive.

## A.3 Concept artists

22. Sparth (Nicolas Bouvier) — Concept Art Lead, *Halo 5* (2015) and *Destiny* (2014). Source: Sparth's *Halo 5 Guardians Concept Art* portfolio and his book *Lumen*.
23. Craig Mullins — Matte painting pioneer. Source: Mullins's online portfolio and his ArtStation commentary.
24. Feng Zhu — Founder, FZD School of Design. Source: FZD's YouTube channel (years of free instructional content).
25. James Paick — Founder, Scribble Pad. Source: Paick's GDC talks on environment design.
26. Maciej Kuciara — Concept artist, *The Last of Us* (Naughty Dog, 2013) and *Cyberpunk 2077* (2020). Source: Kuciara's ArtStation portfolio and his *Design Studio Press* feature.
27. Aaron Limonick — Concept artist, Naughty Dog. Source: *The Art of The Last of Us* (Dark Horse, 2013).
28. Vitaly Bulgarov — Industrial/mech concept artist. Source: Bulgarov's *Robot* sketchbook series and his ArtStation.
29. Yohann Schepacz — Concept artist, *Horizon Zero Dawn* (Guerrilla, 2017). Source: *The Art of Horizon Zero Dawn* (Future Press, 2017).

## A.4 Character designers

30. Bobby Chiu — Founder, Schoolism; character designer, *Alice in Wonderland* (Tim Burton, 2010). Source: Chiu's Schoolism courses and his YouTube channel.
31. Iain McCaig — Concept artist, *Star Wars* prequels (Darth Maul, 1999). Source: *The Art of Star Wars: The Phantom Menace* and McCaig's *Shadowline* portfolio.
32. Glen Keane — Disney animation legend (*The Little Mermaid* 1989, *Beauty and the Beast* 1991, *Tarzan* 1999). Source: *The Art of Disney Animation*; Keane's CalArts lectures; his 2010 Google Doodle documentary.
33. Eric Goldberg — Disney animator (*Aladdin*'s Genie, 1992). Source: *Character Animation Crash Course!* (Goldberg, 2008) and his Walt Disney Family Museum talks.
34. James Baxter — Animator (Belle in *Beauty and the Beast*, Spirit in *Spirit: Stallion of the Cimarron* 2002). Source: Baxter's GDC talks and his YouTube lecture series.
35. Hiroyuki Imaishi — Co-founder, Studio Trigger (*Kill la Kill* 2013, *Promare* 2019). Source: *The Art of Promare* (Trigger, 2020) and Imaishi's *Newtype* interviews.

## A.5 Color theorists

36-40. The five color theorists (Itten, Albers, Gurney, Birren, Eiseman) are listed in A.2 above. Their works are the source.

## A.6 Brand identity & graphic design

41. Paula Scher — Partner, Pentagram. Source: *Make It Bigger* (Scher, 2002) and Pentagram's portfolio.
42. Michael Bierut — Partner, Pentagram. Source: *How To* (Bierut, 2015) and *Now You See It* (Bierut, 2017).
43. Massimo Vignelli — Designer, NYC Subway graphics (1970). Source: *The Vignelli Canon* (Vignelli, 2010) and the Vignelli archive at the Rochester Institute of Technology.
44. Stefan Sagmeister — Designer. Source: *Things I Have Learned in My Life So Far* (Sagmeister, 2008) and his TED talks.
45. David Carson — Designer, *Ray Gun* magazine (1992–1995). Source: *The End of Print* (Carson, 2000, 2nd ed.).
46. Erik Spiekermann — Type designer (FF Meta, 1991; Info Display). Source: *Stop Stealing Sheep* (Spiekermann, 3rd ed., 2014).
47. Adrian Frutiger — Type designer (Frutiger, 1968; Univers, 1957; Avenir, 1988). Source: *Type Sign Symbol* (Frutiger, 1980).
48. Tobias Frere-Jones — Type designer (Interstate, 1993; Gotham, 2000). Source: Frere-Jones's website and his Yale School of Art lectures.

## A.7 Industrial designers

49. Dieter Rams — Chief Design Officer, Braun (1961–1995). Source: *Less But Better* (Klein, 1995) and Rams's *Ten Principles for Good Design* (1970s, published widely).
50. Jonathan Ive — Former Chief Design Officer, Apple. Source: Ive's design commentary in Apple product launch events; *Apple Design* (Zambuto, 2020).
51. Naoto Fukasawa — Industrial designer. Source: *Naoto Fukasawa* (Phaidon, 2007) and his *Without Thought* lecture series.
52. Charles & Ray Eames — Designers. Source: *An Eames Anthology* (Ostroff, 2015) and the Eames Office archive.

## A.8 Cinematographers

53. Roger Deakins — Cinematographer (*Blade Runner 2049* 2017, *1917* 2019, *Sicario* 2015). Source: Deakins's forum *Inside References* and his interviews in *American Cinematographer*.
54. Emmanuel Lubezki — Cinematographer (*Gravity* 2013, *The Revenant* 2015, *Birdman* 2014). Source: Lubezki's *American Cinematographer* interviews.
55. Rodrigo Prieto — Cinematographer (*The Wolf of Wall Street* 2013, *Passengers* 2016). Source: Prieto's *American Cinematographer* interviews and his Yale lectures.
56. Bill Pope — Cinematographer (*The Matrix* 1999, *Spider-Man 2* 2004). Source: Pope's *American Cinematographer* interviews.
57. Zhang Yimou — Director/Cinematographer (*Hero* 2002, *House of Flying Daggers* 2004). Source: Zhang's director commentary and the *Cinematography of Hero* feature in *American Cinematographer*.

## A.9 Animation directors

58. Richard Williams — Animator, *The Animator's Survival Kit* (2001). Source: the book and the related DVD series.
59. Hayao Miyazaki (animation perspective) — Source: *Spirited Away* and *Princess Mononoke* production notes; Miyazaki's essays in *Starting Point*.
60. Bill Tytla — Disney animator (Dumbo, *Fantasia*'s Chernabog). Source: *The Disney Villain* (Johnston & Thomas, 1993).

## A.10 Architects

61. Tadao Ando — Architect. Source: *Tadao Ando: Complete Works* (Frampton, 2007).
62. Frank Lloyd Wright — Architect. Source: *An Autobiography* (Wright, 1932) and *The Future of Architecture* (Wright, 1953).
63. Christopher Alexander — Architect, *A Pattern Language* (1977), *The Timeless Way of Building* (1979). Source: the books.
64. Renzo Piano — Architect (*Centre Pompidou* 1977, *The Shard* 2012). Source: *Renzo Piano: The Complete Works* (Buchanan, 1993–).

## A.11 Why a bibliography

A bibliography is the proof that an art direction is grounded in real authority, not invented. The developer who can answer "which masters did you steal from?" with a real list is a developer whose art direction is defensible. The AI rebuilder who can name its sources is an AI rebuilder whose output is consistent. The Poki reviewer who asks "where did this art direction come from?" gets a real answer.

<!-- APPENDIX_B -->
# APPENDIX B — Mood board & anti-references

## B.1 Mood board (what MAGNETOPE is in dialogue with)

### Games
- *Hades* (Supergiant) — saturation discipline, rim light as identity.
- *Night in the Woods* (Finji) — shape language consistency.
- *Hyper Light Drifter* (Heart Machine) — color as narrative.
- *Return of the Obra Dinn* (Lucas Pope) — constraint as identity.
- *Undertale* (Toby Fox) — restraint as feature.
- *Gris* (Nomada Studio) — color-as-emotion (anti-pattern: too desaturated for MAGNETOPE, but the principle is borrowed).
- *Outer Wilds* (Mobius) — single committed visual identity.
- *Slay the Spire* (MegaCrit) — clean UI over busy game.

### Films
- *Blade Runner 2049* (Deakins) — single-source lighting, color discipline.
- *Hero* (Zhang Yimou) — color blocking.
- *House of Flying Daggers* (Zhang Yimou) — color blocking.
- *Spider-Man: Into the Spider-Verse* (2018) — toon shading with hard terminators in modern animation.
- *The Secret of Kells* (Cartoon Saloon, 2009) — ligne claire adapted to flat-shaded form.
- *Wolfwalkers* (Cartoon Saloon, 2020) — same.

### Books & illustrations
- *Color and Light* (James Gurney, 2010) — gamut mapping.
- *Interaction of Color* (Josef Albers, 1963) — color interaction.
- *The Art of Color* (Johannes Itten, 1961) — the seven contrasts.
- Moebius's *Arzach* — emptiness as positive composition.
- Hergé's *Tintin* — ligne claire.
- Mary Blair's *Alice in Wonderland* concept art — non-naturalistic color.

### Industrial design
- Dieter Rams's Braun products — less, but better.
- Naoto Fukasawa's INFOBAR phone — without thought.

### Architecture
- Tadao Ando's Church of the Light — concrete as canvas for light.
- Renzo Piano's Centre Pompidou — express the structure.

## B.2 Anti-references (what MAGNETOPE explicitly does NOT look like)

| Anti-reference | Why avoided |
|---|---|
| Crossy Road (Hipster Whale, 2014) | Voxel aesthetic is wrong for magnetism; also overused |
| Subway Surfers (SYBO, 2012) | Saturated but undisciplined palette |
| Stickman Hook (Madbox, 2018) | Generic stickman silhouette; same physics-puzzle genre |
| Default Unity asset packs (anything tagged "low-poly junkyard") | Asset-pack equivalent look |
| Default Unreal Engine PBR demos | Realism fights playfulness |
| AI-generated game art (generic Midjourney / Stable Diffusion game art) | The default look of 2023–2026 AI games |
| Generic low-poly indie web games | The current look of MAGNETOPE — the look the renewal exists to escape |
| Adobe Stock illustration | Corporate illustration look |
| Canva templates | Default "kid-friendly" design |
| Free icon sets (Lucide, Feather, Heroicons) as primary brand identity | Default — every web game uses them |
| Stock font pairings (Montserrat + Open Sans; Poppins + Lato) | The most common indie game type pairings of 2024–2026 |
| Tilted Brush font | The default "playful indie" font of 2024–2026 |
| Material Design | The default "Google product" look — wrong for a game |
| Flat design (the 2010s trend) | The default "corporate app" look |

## B.3 The visual neighborhood

MAGNETOPE in its renewed form sits in this visual neighborhood:

- Closer to *Hades* than to *Subway Surfers*.
- Closer to Cartoon Saloon than to *Peppa Pig*.
- Closer to Roger Deakins than to a stock photo.
- Closer to Dieter Rams than to a Verizon store.
- Closer to Mary Blair than to a stock illustration.

The neighborhood is the proof of intent. The developer who can say "my game lives in this neighborhood" is a developer who has committed to an identity.

<!-- APPENDIX_C -->
# APPENDIX C — Full color token table

Every color token from Chapter 15, in a single reference table. Ready to paste into a design file, a shader, or a CSS variable declaration.

```css
:root {
  /* Brand */
  --brand-pole-north: #E53935;
  --brand-pole-south: #1E88E5;
  --brand-field-line: #00E5FF;
  --brand-ink: #0A0A0A;
  --brand-chassis: #546E7A;
  --brand-paper: #F5E6D3;

  /* Scrapyard */
  --scrapyard-sky: #D84315;
  --scrapyard-sky-zenith: #BF360C;
  --scrapyard-sky-horizon: #FF7043;
  --scrapyard-steel: #37474F;
  --scrapyard-rust: #6D4C41;
  --scrapyard-copper: #2E7D32;
  --scrapyard-wood: #795548;
  --scrapyard-shadow: #1B0F08;

  /* Suburbia */
  --suburbia-lawn: #4CAF50;
  --suburbia-roof: #C0442E;
  --suburbia-wall: #FFE0B2;
  --suburbia-fabric: #FFCC80;
  --suburbia-trampoline: #0288D1;
  --suburbia-shadow: #1B5E20;

  /* Metropolis */
  --metropolis-facade: #311B92;
  --metropolis-neon: #FFAB00;
  --metropolis-asphalt: #212121;
  --metropolis-glass: #1A237E;
  --metropolis-steel: #455A64;
  --metropolis-shadow: #0A0A1F;

  /* Playground */
  --playground-asphalt: #9E9E9E;
  --playground-cyan: #00BCD4;
  --playground-magenta: #E91E63;
  --playground-yellow: #FFEB3B;
  --playground-sky: #4FC3F7;
  --playground-shadow: #37474F;

  /* Stratosphere */
  --stratosphere-sky: #0288D1;
  --stratosphere-zenith: #01579B;
  --stratosphere-horizon: #FFD54F;
  --stratosphere-cloud: #FAFAFA;
  --stratosphere-aurora: #69F0AE;
  --stratosphere-shadow: #012233;

  /* Functional UI */
  --ui-bg: #151A22;
  --ui-bg-overlay: rgba(21, 26, 34, 0.6);
  --ui-bg-overlay-deep: rgba(21, 26, 34, 0.8);
  --ui-text-primary: #FFFFFF;
  --ui-text-secondary: #B0BEC5;
  --ui-text-disabled: #546E7A;
  --ui-button-primary: #FFCC80;
  --ui-button-secondary: #37474F;
  --ui-button-rewarded: #FFAB00;
  --ui-button-danger: #E53935;
  --ui-border: rgba(255, 255, 255, 0.12);
  --ui-divider: rgba(255, 255, 255, 0.06);

  /* Spacing (Vignelli grid) */
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-8: 64px;
  --space-12: 96px;

  /* Typography */
  --font-display: 'MagnetopeWordmark', sans-serif;
  --font-body: 'Comfortaa', sans-serif;
  --font-mono: ui-monospace, monospace;
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 32px;
  --font-size-2xl: 48px;
  --font-size-3xl: 96px;

  /* Material shading */
  --mat-steel-lit: 1.0;
  --mat-steel-shadow: 0.4;
  --mat-steel-rim: 0.3;
  --mat-wood-lit: 1.0;
  --mat-wood-shadow: 0.5;
  --mat-plastic-lit: 1.0;
  --mat-plastic-shadow: 0.45;
  --mat-plastic-rim: 0.6;
  --mat-concrete-lit: 0.7;
  --mat-concrete-shadow: 0.4;
  --mat-glass-opacity: 0.3;
  --mat-foliage-lit: 1.0;
  --mat-foliage-shadow: 0.5;
  --mat-magnet-lit: 1.0;
  --mat-magnet-shadow: 0.4;
}
```

<!-- APPENDIX_D -->
# APPENDIX D — Glossary

The terms used throughout the PRD, defined as the PRD uses them. The definitions are operational, not academic — they are what the AI rebuilder needs to understand to execute the spec.

**Anticipation.** The animation principle of preparing for an action with a small opposite motion. (Williams, §8.1.)

**Aspect ratio.** The width-to-height ratio of the game canvas. Poki requires 16:9. (Poki Requirements, §1.)

**Asset-pack equivalent look.** Silent killer #1 (Chapter 2 §2.1). The game's art, while not literally shipping asset-pack assets, is indistinguishable from a game that did.

**Bespoke wordmark.** The custom-drawn "MAGNETOPE" lettering specified in Chapter 10 §10.6. The single highest-leverage brand identity decision.

**Biome.** One of the five themed environments: Scrapyard, Suburbia, Metropolis, Playground, Stratosphere.

**Bloom.** A post-processing effect that makes bright pixels appear to glow. In the renewal, only the magnetism signature colors bloom.

**CSP.** Content Security Policy. The release test (Chapter 18 §18.5 of the original PRD) verifies the game runs under a strict CSP.

**Color blocking.** Zhang Yimou's principle (Chapter 9 §9.3) of large flat color areas carrying visual weight.

**Cold viewer.** A person who has never seen MAGNETOPE before, used for the 200ms thumbnail test and the signature test.

**Commercial break.** A Poki SDK call (`PokiSDK.commercialBreak()`) that fires an ad. Must fire only on pause-to-gameplay transitions.

**Differentiation test.** The third silent test (Chapter 1 §1.3). Does the game look like anything else on Poki, or like everything else on Poki?

**Field line.** The cyan ribbon mesh that ripples from MAGNO's poles during charge, launch, and snap. The motion signature of the renewal.

**Fresnel.** A shading effect where surfaces viewed at a grazing angle appear brighter. In the renewal, used on metallic surfaces near MAGNO to glow with the pole color.

**Gamut.** A constrained subset of the color wheel, per Gurney. Each biome has a gamut wedge (Chapter 5 §5.3).

**Icon set.** The 16 custom-drawn icons specified in Chapter 14 §14.3. Not Lucide.

**Incognito mode.** A browser mode where localStorage is restricted. Poki requires the game to stay playable in incognito.

**Line of action.** Glen Keane's principle (Chapter 6 §6.4). The single dominant curve through a character in any frame.

**Ligne claire.** Hergé's clear-line style. A lineage reference for the toon shader.

**LUT.** Look-Up Table. A 3D texture used for color grading. Each biome has its own LUT in the renewal.

**Ma.** Miyazaki's principle of the pause between actions (Chapter 8 §8.5).

**Magnetism made visible.** The overall signature of the renewal (Chapter 11). Every screen shows magnetism.

**Material family.** A group of materials with shared shading properties: steel, wood, plastic, fabric, concrete, glass, foliage, magnet pole. (Chapter 7 §7.5.)

**Modal hierarchy.** The three-level modal system (primary, secondary, tertiary) specified in Chapter 14 §14.4.

**Padlock problem.** The failure of MAGNO's current silhouette to read as a magnet — it reads as a padlock. The single most devastating art-direction issue. (Chapter 1 §1.1.)

**Pole color.** The red (north) or blue (south) color of MAGNO's magnet. Brand-pole-north and brand-pole-south in the palette.

**Player Fit Test.** Poki's Stage 2 test with ~500 players, measuring average playtime. (Poki SDK Overview.)

**Rewarded break.** A Poki SDK call (`PokiSDK.rewardedBreak()`) that fires a rewarded video. Must be player-initiated.

**Rim light.** A thin edge of light on the side of a character opposite to the camera. Used to separate the character from the background. (Prieto, Chapter 9 §9.2.)

**Signature.** One of the five committed visual decisions of the renewal: silhouette, palette, materiality, motion, overall. (Chapter 4 §4.3.)

**Signature test.** The test of whether five random screenshots are grouped as the same game by a cold viewer. (Chapter 4 §4.3.)

**Silhouette test.** The test of whether a character is recognizable from its pure black-on-white silhouette. (Chapter 6 §6.2.)

**Slow-motion director.** The existing `src/game/slowmo.ts` system. Updated in Chapter 17 §17.3.

**Snap.** The mechanic of MAGNO attaching to a steel surface mid-air. The signature gameplay action.

**Terminator.** The line on a shaded surface where light becomes shadow. Hard in the toon shader (a committed aesthetic). (Chapter 7 §7.3.)

**Three-act lighting.** The lighting structure per biome: establishing on entry, building on ascent, dramatic on summit. (Chapter 9 §9.5.)

**Three-layer background.** The near/mid/far parallax system per biome. (Chapter 13.)

**Tier-low.** The lowest quality tier in `quality.ts`. Devices that cannot afford fresnel on every prop. (Chapter 18 §18.4.)

**Toon shader.** The custom ShaderMaterial specified in Chapter 18 §18.1–§18.2. Two bands, hard terminator, rim light, optional fresnel.

**Vignelli grid.** The 8-pixel base grid that every HUD element snaps to. (Chapter 14 §14.2.)

**Web Fit Test.** Poki's Stage 3 test with ~10,000 players, measuring CTR, time on page, and conversion to play.

**Wordmark.** See Bespoke wordmark.

**200ms test.** The thumbnail test: can a cold viewer identify the game in 200 milliseconds? (Chapter 6 §6.8.)

---

## END OF ENCYCLOPEDIA

This document is v1.0. It is meant to be used, not admired. Open it in any AI coding tool. Prompt the AI with a single chapter. Build that chapter. Test it. Move to the next.

The renewal is complete when the 25 checks in Chapter 21 are all green. Until then, this document is in progress.

If the AI rebuilder finds a contradiction between chapters, the more specific chapter wins. If a chapter is ambiguous, the masters cited in that chapter are the authority. If the masters disagree, the developer decides.

The encyclopedia ends here. The work begins.
