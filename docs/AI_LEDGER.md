# AI use ledger

Poki's guidance asks developers to be able to show how and where AI tools were used, with prompts and iterations on request.
This file is the running record. Keep it honest and current; add a row every time AI output enters the project.

| Date | Area | Tool | What it produced | What a human changed or decided |
| --- | --- | --- | --- | --- |
| 2026-10-08 | Game engine, controller, renderer, audio, UI, tests (session 1) | Claude (Claude Code) | First implementation of the systems listed in `docs/ROADMAP.md` from the PRD | To be filled in: playtesting verdicts, tuning changes, anything rewritten by hand |
| 2026-10-08 | Map, locker, ghosts, onboarding, share card, telemetry (session 2) | Claude (Claude Code) | Implementation of the session 2 rows in `docs/ROADMAP.md` | To be filled in |
| 2026-10-08 | Suburbia and Metropolis: scripted hazards, hinged props, wind, 22 props (procedural low-poly kits in `render/kit-*.ts`), 14 levels, skylines, ambience, title cards (session 3) | Claude (Claude Code) | Code for every item; level layouts, palettes and prop designs written as code, with no generated image or model files | To be filled in: layout and difficulty verdicts after playtests. Planner routes were recorded by the bot, not by hand |
| 2026-10-09 | Playground of Giants and Stratosphere: spinning motion, see-saw hinges, ball-pit cushion, low-gravity levels, 24 props (procedural low-poly kits in `render/kit-playground.ts` and `kit-stratosphere.ts`), 14 levels, skylines, aurora, the Core, ambience, title cards (session 4) | Claude (Claude Code) | Code for every item; level layouts, palettes and prop designs written as code, with no generated image or model files | To be filled in: layout and difficulty verdicts after playtests, especially low-gravity feel. Planner routes were recorded by the bot, not by hand |
| 2026-10-09 | The ending film, levels 8 to 14 of every biome, par ghosts and routes (session 5) | Claude (Claude Code) | Code for the film, the mountain, the score cues and 35 level layouts; routes and ghosts recorded by the planner bot | To be filled in: pacing and sound of the ending, difficulty verdicts on the second seven |
| 2026-10-09 | Post-processing (bloom, vignette, per-biome colour grade), in-engine thumbnail capture, telemetry heatmap tooling, browser behavioural tests, submission dossier (session 6) | Claude (Claude Code) | Code and test for every item. The grade parameters are hand-set numbers in `render/grade.ts`; the thumbnail framing was chosen from captured frames | To be filled in: the final choice of thumbnail frame, store copy rewritten in the developer's own words before submission |
| 2026-10-09 | Reactive props: boing, crumble, follower and spring-board behaviour, 11 prop kits (`render/kit-reactive.ts`), voices, effects, placement in 12 levels (session 7) | Claude (Claude Code) | Code and tests for every item; changed levels were re-solved by the planner bot | To be filled in: feel of the bounce, crumble and lift timings after playtests |
| 2026-10-09 | Self-hosted font (session 7) | Claude (Claude Code) | Downloaded Fredoka from Google's fonts repository on the developer's approval and subset it with fonttools | Developer approved the font and its licence |
| 2026-10-09 | Friend ghosts as text codes, controls screen, colour-vision test, QA sweep tooling (session 8) | Claude (Claude Code) | Code and tests for each item | To be filled in: wording of the exchange screen, feel of the controls screen |
| 2026-10-09 | Field-driven ferris wheel (hub, welded spokes, hung cabins, axle bearing), wheel kits and hangers, axle groan voice, soak tests, Twin Wheels re-laid and re-solved (session 9) | Claude (Claude Code) | Code and tests for every item; the route was recorded by the planner bot | To be filled in: feel of the wheel's weight, inertia and coast after playtests |
| 2026-10-11 | Magnet-first re-lay of Suburbia 01, 02, 09, 10 and Metropolis 01, 11, re-solved with ghosts rebuilt (session 10) | Claude (Claude Code) | Level geometry and tests; routes recorded by the planner bot | To be filled in: feel of the larger steps after playtests |
| 2026-10-11 | Rapier WebAssembly served as a streamed file, cold-load measurement tool and test (session 11) | Claude (Claude Code) | Build plugin, `tools/cold-load.ts`, `tests/load-time.test.ts` | To be filled in: confirm timings on a real phone |

Rules this project follows (from the PRD):

- Generated output is a draft. Every level, asset and tuning number is reviewed and owned by the developer.
- Levels are only shipped after the planner bot verifies them **and** a human has played and balanced them.
- No watermark or prompt text may appear in any shipped asset.
- Art is redrawn or re-modelled by hand before it enters the game; raw generator output never ships.
