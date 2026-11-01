---
version: 1
slug: "src-studentapp-tsx"
primary_target: "src/StudentApp.tsx"
related_targets: ["src/ExamRunner.tsx","src/WritingPage.tsx","src/styles.css"]
---

## Direction contract

THESIS: A band is something you complete, not a number you are handed. The app refuses the edtech dashboard arrangement — blue hero holding a big figure, two stat tiles, a stack of same-size cards — and replaces it with a single fired-tile counter the student fills point by point.

OWN-WORLD: Samarkand majolica, from its saturated glaze side. Cobalt `#0F3A86` owns the ground at page scale; `#0B2A63` is the recessed surface; turquoise `#2BA3A0` carries earned progress; saffron `#E2A32B` is the one action colour; white glaze `#F3EFE4` is type. No cream, no buff ground. Archivo, self-hosted, Black for display. Geometry is structural only — rosette, tiling grid, rotated-square pip, 1px white keylines, zero border radius anywhere. Recognisable with all content removed by: cobalt field, hairline white keylines, right-angle tiles, one saffron block.

STORY: The student sees one honest band and one unambiguous next action within two seconds, starts it, and afterwards reads exactly which sentence or second cost them marks.

FIRST VIEWPORT: Cobalt fills the frame. Top bar: tile mark plus `mock-ai`, avatar right. Heading at 27px Archivo Black, no kicker above it. Below, the rosette block — an eight-point girih star 92px square, six segments set turquoise, saffron core carrying the band figure — paired right with the band label, segments-set line, and the weakest skill named. One saffron action bar beneath it. Then the exam tiles two-up, then attempt rows. Standard bottom nav, active tab a turquoise tile.

FORM: Girih Glaze, candidate 6 of seven grounded directions, assigned by the roll. seed:bdd6ecfd0ce1d046

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Scope and mode

Mode: Operate. Primary target `src/StudentApp.tsx`; related `src/ExamRunner.tsx`, `src/WritingPage.tsx`, `src/styles.css`, `src/mobile.css`.

Three screens this round: home, exam runner, Writing AI report. Behaviour, routing, API contracts, exam logic and existing accessibility work are untouched.

## Audience and constraints

Uzbek students under 25, phone-first inside Telegram, fixed exam date. Two arrival routes — assigned by a centre's branch, or self-serve.

- Name is `mock-ai`, domain `mock-ai.uz`. Never "mock.ai".
- English only; no i18n library.
- Every colour and type value ships as a swappable token: a centre's branch re-skins without touching components.
- Preserve the 55 aria-labels, 58 roles, focus-visible rings and the `prefers-reduced-motion` block.
- No prices, paywalls or billing states — payment does not exist.

## Raises

Five donations, each named for the challenger it came from:

- Centre Rail — corrections hang in a ruled margin bracketed back to the exact quoted sentence, drawn in cobalt and saffron rather than bone and vermilion.
- Star Atlas — one fixed quantitative ramp carries hierarchy, so type never states the band.
- Character Goods — every skill carries identical furniture in a finite ranked set.
- Cassette — the daily goal is a visibly finite budget that fills and cannot overfill.
- Ikeda — the palette commits at page scale rather than accenting a grey screen.

## Anti-goals

Violet-to-blue gradients, glassmorphism, rounded-everything, Inter/Geist defaults, emoji as icons, floating blobs, mascots, confetti, cartoon roundness. Kickers above headings. Same-size icon+heading+text cards as page structure. The hero-metric template.

## Unresolved

Whether the engagement layer (streak, points, leaderboard) leads the home screen or stays secondary was asked and not answered; this round keeps it secondary to the band and the next action, and it can be promoted later without changing the world.
