# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: IELTS candidates in Uzbekistan, mostly school and university students, largely under 25. They are phone-first and enter predominantly through Telegram; many are preparing for a university entry or visa requirement on a fixed exam date.

They arrive through two commercially distinct routes that matter roughly equally:

- **Centre branch** — a learning centre buys and receives its own isolated instance (separate deployment/container) with its own materials, its own exams, and its own students. Content is theirs, not the global library.
- **Self-serve** — a student signs up to the public platform directly, practises alone, and pays a monthly fee for access.

The student interface must work for both: someone whose centre sets the work, and someone with nobody telling them what to do next.

Secondary: centre administrators and tutors, who use a separate browser-based admin application to author content, assign it, and review student progress.

## Product Purpose

Give a student an honest, repeatable estimate of their IELTS band across all four skills, plus the specific corrections needed to raise it — without a human examiner in the loop for every attempt.

Success is a student who takes a timed mock, understands precisely why they scored what they scored, acts on it, and sees the band move on the next attempt.

## Positioning

AI scoring across all four skills, including **recorded and live three-part Speaking interviews** with per-criterion band reports and timestamped issues — not just auto-marked Listening and Reading. Delivered inside Telegram, where this audience already is, rather than requiring a separate app install.

## Operating Context

- **Multi-tenant by deployment.** A centre's purchase provisions a separate instance rather than a row-level flag, so the same client code ships under different owners with different content. The interface must therefore tolerate being re-skinned per centre without redesign — identity has to live in swappable tokens, not in hard-coded component styling.
- Runs as a Telegram Mini App and as a desktop browser app from the same responsive client. Telegram supplies identity via `initData`; email/password and Google are alternatives.
- Phone-first usage. The 390px layout is a first-class design target, not a shrunken desktop (`src/mobile.css`), including Telegram fullscreen safe-area insets.
- Timed exams run against a server deadline; an expired attempt auto-submits.
- Speaking requires microphone capture and stores recordings with an expiry window.
- Students may study in short sessions between classes, and the product pushes a daily reminder.

## Capabilities and Constraints

Implemented:

- Timed Listening and Reading mocks with a question map, flags, notes, highlights, autosave, and automatic band scoring.
- Full mock flow chaining Listening → Reading → Writing with breaks.
- Writing Task 2 submission with AI report: overall band, four criteria with reasons and improvements, strengths, quoted issues with suggestions, next steps, and a rewrite.
- Speaking: three-part recorded interview and a live conversational mode, with per-criterion bands, transcripts, timestamped issues, strengths and next steps.
- Practice mode by skill and question type, mistake notebook with retry, attempt review.
- Study plan with target band, exam date, daily goal, streak, and a recommended next activity.
- Progress: per-skill bands, accuracy, attempt history.
- Engagement layer, built but visually under-expressed: daily challenges, achievements, a vocabulary game, weekly points and a leaderboard.
- Admin: content authoring, PDF import, public/private libraries, student progress analytics.

Constraints:

- Interface language is **English only** (`lang="en"`, no i18n library). Confirmed decision: students preparing for an English exam read an English interface. Exam content is English by nature.
- React 19 + Vite, plain hand-written CSS (`styles.css`, `mobile.css`). No component library, no CSS framework.
- Backend is a separate Go API (`mock-ai` repository); the student client is `mock-ai-web`.
- **Stars pay for full mocks; practice credits pay for AI practice.** A full four-skill mock costs 1 star (taken once when it starts; resuming is free). In Practice, each AI-evaluated essay uses 1 Writing check and each AI interview 1 Speaking interview; a full mock's own Writing and Speaking are covered by its star. Every account starts with 1 of each; Reading/Listening practice is free. Prices are set by platform admins (Pricing tab) and paid through inPAY. Learning-centre students use their centre's balances, which the centre buys or the platform tops up. Details: `mock-ai/docs/payments.md`.
- The conversational AI teacher remains deferred.

## Brand Commitments

**The product name is `mock-ai`** — hyphenated, lowercase. Not "mock.ai". The public domain will be **mock-ai.uz**. Any surface, wordmark, or asset written as "mock.ai" is wrong and must be corrected.

Beyond the name and domain, nothing is binding: wordmark, palette and typography are explicitly replaceable as of this engagement.

Prior identity, recorded as evidence and anti-reference only: an "M" tile mark with a warm-paper editorial look (cream `#f4f1ea`, ink `#20201e`, violet `#6d5bd0`, lime `#e3ff65`), DM Sans and Manrope. Clients reviewed it and rejected it as not fitting their students.

## Evidence on Hand

- Real product UI, capturable at 2x via Playwright with mocked API responses (`mock-ai-promo` capture harness) — no production data required.
- A 30-second Uzbek-narrated promo film built from those captures (`/Users/admin/go/src/own/mock-ai-promo`).
- Student app at `mock-ai.uz`; admin panel at `panel.mock-ai.uz`. The earlier `mock.web.chessinsight.uz` and `mockai.admin.chessinsight.uz` hosts keep serving until their DNS is retired.
- Client feedback that the current interface does not suit school-age students. This is reported feedback, not a documented research study: no user interviews, analytics, retention figures or usability sessions exist. Future work must not cite numbers that were never measured.
- No testimonials, case studies, press, or published outcome data.

## Product Principles

1. **The band is the product.** Every screen either produces an honest band estimate or explains how to move it. Decoration that does not serve that is noise.
2. **Two kinds of student, one interface.** It must answer "what did my teacher assign?" and "what should I do next?" without becoming two products.
3. **Phone-first, Telegram-native.** The 390px view is the real product; desktop is the secondary case.
4. **Correction over congratulation.** Feedback names the specific sentence, word or second that cost marks. Encouragement never replaces the correction.
5. **Earned progress, not vanity metrics.** Streaks, points and achievements already exist; they must reflect real practice, and must never imply a band the student has not actually scored.

## Accessibility & Inclusion

Existing implementation is deliberate and must be preserved: 55 `aria-label`s, 58 `role`s, `aria-pressed` on toggles, `aria-modal` dialogs, visible `:focus-visible` outlines, and a `prefers-reduced-motion` block that disables all animation and transitions.

Any redesign must keep reduced-motion support — relevant because the engagement layer invites added motion — and keep tap targets usable on a phone held one-handed.
