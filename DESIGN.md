# mock-ai design system — "Streaming wall, light"

Reference: `prototypes/streaming/` (`shared.css`, `home.html`, `exam.html`, `report.html`, `landing.html`, `shots/`). Product rules: `PRODUCT.md`.

## Direction

A light, warm-neutral wall of skill posters. The ground is quiet; colour lives in the posters; one red marks the thing to do next. Big condensed poster lettering for names and headings, a clean sans for everything you operate, a serif for long reading.

- Name: always lowercase `mock-ai`, the hyphen in the accent (`<Wordmark />`). Never "mock.ai".
- Light only. No dark mode, no page-level dark sections. Dark or saturated colour is allowed inside poster art only.
- English only.

## Tokens (`src/theme.css`)

Every colour, face, radius, shadow, easing and duration is a token. Component CSS never hard-codes a colour.

| Group | Tokens |
|---|---|
| Ground | `--ground` #F0EFEC, `--ground-2` long-read, `--surface` #FFF, `--surface-2` wells/tracks, `--line`, `--line-strong` |
| Ink | `--text` #15161A, `--text-2`, `--text-3` (aliases `--ink`, `--ink-2`, `--ink-3`) |
| Accent | `--accent` #CC321D (text + buttons), `--accent-hover`, `--accent-hi` #FF4D3D (decorative only: rings, rails, indicators, never text), `--accent-ink`, `--accent-tint` |
| Roles | `--action` (= accent), `--progress` (= ink), `--ok`, `--alert`, `--warn`, `--streak`, `--star` |
| Skills | `--listening/-deep/-ink`, `--reading/-hi/-lo/-deep/-ink`, `--writing/-mid/-deep/-ink`, `--speaking/-hi/-lo/-deep/-ink`, `--full-deep/-ink`; readable text inks `--skill-listening/reading/writing/speaking` |
| Chrome | `--chrome` (side nav), `--chrome-glass` (top/tab bar), `--nav-active`, `--avatar`, `--scrim` |
| Reading | `--glaze`, `--glaze-sunk`, `--glaze-raised`, `--ink-glaze*`, `--line-glaze*` |
| Type | `--font-display` Big Shoulders Display, `--font-ui` Onest, `--font-read` Source Serif 4; `--step--1` 13px … `--step-6` 98px |
| Space | `--s1` 4 … `--s7` 48, `--sidebar` 248px, `--tabbar-h` |
| Shape | `--r-tile` 10 (posters), `--r-ctl` 12 (controls), `--r-card` 14, `--r-hero` 20, `--radius-pill` |
| Depth | `--shadow-card`, `--shadow-tile`, `--shadow-lift` (warm, never grey-blue) |
| Motion | `--ease-out` expo, `--ease-quint`, `--ease-settle`, `--ease-inout`; `--dur-micro` 140, `--dur-short` 220, `--dur-long` 600 |

`--paper` and `--muted` are legacy aliases; migrate them to `--surface` / `--text-2` when you touch a rule.

## Type

- **Display** (`--font-display`, weight 800): poster titles (uppercase, line-height 0.86), page titles (`h1`, 40px phone), section headings (`h2`, 24px, weight 750). Utility: `.display`.
- **UI** (`--font-ui`): body 15/1.5, controls, labels, `h3` 17px/650. Minimum readable size 13px.
- **Read** (`--font-read`): passages, essays, AI report prose. Utility: `.read`.
- Numbers that change or compare use `.num` (tabular).

## Posters

The poster is the brand's unit: a 2:3 tile, one hue + one deep + one ink + one motif per skill.

| Skill | Motif |
|---|---|
| Listening | concentric sound rings from the bottom-left |
| Reading | ruled text columns on amber |
| Writing | margin rule + lined paper; pen stroke on `lg`/`hero` |
| Speaking | a voice waveform on lilac |
| Full mock | the four hues stacked as bands |

Rules: titles are short (1–3 words), uppercase Big Shoulders, bottom-left. Band badge top-right, tag top-left. The poster is decorative (`aria-hidden`); the control around it carries the name. Do not put body text on posters. Do not invent new skill colours; a new kind of content picks the skill it trains.

## Motion

Two speeds:

- **Interaction** 120–250 ms, `--ease-out`: press `scale(0.97)` 80 ms, hover lift −1.5 px / poster −4 px, colour 220 ms.
- **Signature entrance** 2.5–4 s on key screens only (home, report, landing), in acts: *set up* (surfaces land, posters wipe open, art sharpens), *reveal* (heading letters rise, numbers roll in valid steps, rails draw), *resolve* (primary action settles, secondary rows stagger in). Layered stagger 60–90 ms, `--ease-out`/`--ease-quint`, blur-to-sharp, clip wipes.

Rules:

- Never block input. Any tap or key during an entrance jumps it to the final state.
- Numbers roll only through real values: IELTS bands in 0.5 steps, counts in 1s.
- Timed exam screens stay calm: no entrance beyond a 220 ms fade; no ambient motion.
- `prefers-reduced-motion`: final state instantly, no ambient loops, no view transitions.
- View switches use `document.startViewTransition` (old 200 ms out, new 420 ms blur-in); the side nav, top bar and tab bar keep still.
- CSS + WAAPI only. No animation libraries.

## Layout

| Width | Shell |
|---|---|
| < 1024 px | sticky glass top bar (wordmark, stars, avatar) + fixed bottom tab bar (5 items). Content is padded by `--tabbar-h` + safe area so nothing sits under the bar. |
| ≥ 1024 px | 248 px side-nav column (sticky 100vh nav; its background runs the full page height) (wordmark, items with icons, student card + sign out at the bottom); top bar shows only the star chip. |

- Phone first: 390 px is the real product (Telegram Mini App, safe-area insets via `--mini-*` on `.telegram-fullscreen`). 1440 px gets a real composition (poster + reasoning side by side, columns), not a stretched phone.
- Page content goes in `.content` (max 1280 px, 16 px phone / 40 px desktop gutters).
- Page breakpoints for page rules: `max-width: 800px` (phone layout) and `min-width: 1024px` (desktop composition). Put phone overrides next to the rule they change.
- Touch targets ≥ 44 px.

## Do / don't

- Do use one primary (red) button per view. Secondary actions are ghost buttons.
- Do let posters carry colour; keep cards white on the ground with `--shadow-card`.
- Do keep every `aria-*`, `role`, `:focus-visible` style and keyboard path.
- Don't add gradients, glows or tints outside poster art.
- Don't use `--accent-hi` for text.
- Don't hard-code colours, fonts or radii in component CSS.
- Don't claim stats, testimonials or prices that the API does not give.

## Re-skin for a centre

A centre deployment overrides `src/theme.css` only. Usually: `--accent`, `--accent-hover`, `--accent-hi`, `--accent-tint`, `--accent-shadow`, optionally `--ground` and `--font-display`. Skill hues stay fixed so a skill means the same colour everywhere. Check `--accent` keeps 4.5:1 on `--ground` and under `--accent-ink`.

## Page agent contract

### Who owns which CSS

| File | Owns |
|---|---|
| `src/theme.css` | tokens (Foundation) |
| `src/styles/base.css` | reset, type, buttons, forms, chips, motion vocabulary, view transitions, reduced motion, wordmark, app shell (side nav, top bar, tab bar, profile sheet, modal scrim, Telegram insets), page primitives shared by several areas (`.page-header`, `.section-heading`, `.options`, `.status-chip`, `.empty-state`, …) (Foundation) |
| `src/styles/poster.css` | the poster system (Foundation) |
| `src/styles/home.css` | dashboard, explore, practice, study plan, progress |
| `src/styles/exam.css` | ExamRunner, FullMockFlow, ReviewPage |
| `src/styles/report.css` | Writing, FullMockWriting(Score), Speaking, LiveSpeaking, Examiner |
| `src/styles/account.css` | Landing, AuthScreen, Stars, MyCentre, ReminderSettings, Notebook, VocabularyGame, WorkspaceTools |
| `src/styles/admin.css` | Admin*, Content/Marking/Centres/Centre*/StarsAdmin/ManagedContent |

Edit only your file. To change a shared primitive for your page, override it in your file with a scoped selector (e.g. `.writing-page .section-heading`); ask Foundation/Main for a change that should apply everywhere. All files are imported from `src/main.tsx` in the order above; base loads first.

### `<Poster>` — `src/Poster.tsx`

```tsx
import Poster, { posterSkill } from "./Poster";

<button className="tile" onClick={open} aria-label="Opinion essays, Writing Task 2">
  <Poster skill="writing" title="Opinion essays" tag="Task 2" band={5.5} size="md" />
</button>
```

| Prop | Type | Notes |
|---|---|---|
| `skill` | `"listening" \| "reading" \| "writing" \| "speaking" \| "full"` | `posterSkill(apiSkill)` maps any API skill string, unknown → `"full"` |
| `title?` | string | Big Shoulders, uppercase via CSS, bottom-left; omit for art only |
| `tag?` | string | small label top-left ("Task 2", "Drill") |
| `band?` | number \| null | badge top-right, shown `toFixed(1)` |
| `size?` | `"sm" \| "md" \| "lg" \| "hero"` | title 18 / 25 / 32 px; `hero` fills its parent's height (min 214 px), title `--step-5` → `--step-6` at ≥1024, writing gets the pen stroke on `lg`/`hero` |
| `enter?` | boolean | wipe-open + sharpen entrance inside a `.play` root; delay via `style={stagger(i, base)}` |
| `className?`, `style?` | | width comes from the parent (2:3 ratio) |

The poster is `aria-hidden`; the wrapping `a`/`button`/`[role=option]` names it and gets hover lift, focus ring and press for free.

### Motion — `src/motion.tsx`

| API | Use |
|---|---|
| `useEntrance(ref, enabled?)` | on mount: holds the first frame until fonts load (≤1.5 s), adds `.play` to `ref`; pointerdown/keydown in the first 5 s finishes every animation in the subtree and lands `Roll`s. No-op under reduced motion and in tests. |
| `stagger(i, base?, step?, dur?)` | inline style `{ "--d", "--dur" }` for `.rise`, `.blurin`, `.wipe`, `.grow`, `.land`, `.p-enter` |
| `<Roll value from? step? decimals? delay? duration? />` | number that counts up in valid steps inside `.play` (bands: `step={0.5}`; counts: `step={1}`); React renders the final value |
| `<RevealText text as? base? charStep? />` | heading whose letters rise from word masks inside `.play`; accessible name stays the plain text |
| `prefersReducedMotion()` | true under reduced motion or without `matchMedia` |
| `viewTransition(update)` | wraps a view change in `startViewTransition` when allowed |

CSS role classes (base.css), all inert without a `.play` ancestor: `.rise` (rise + blur, quint), `.blurin`, `.wipe` (clip wipe left→right), `.grow` (scaleX from left: rails, bars), `.land` (drop + settle: dots, badges). Per element: `--d` delay, `--dur` duration.

```tsx
const stage = useRef<HTMLDivElement>(null);
useEntrance(stage);
<section ref={stage}>
  <Poster skill="writing" size="hero" enter style={stagger(0, 120)} title="Task 2" />
  <RevealText as="h1" text="Writing Task 2" base={380} />
  <p className="rise" style={stagger(0, 1100)}>Writing <Roll value={5.5} from={4} step={0.5} delay={1300} /> is your lowest skill.</p>
  <button className="btn btn-primary rise" style={stagger(0, 2800, 0, 1000)}>Start</button>
</section>
```

### Other shared pieces

- `<Wordmark />` (`src/Wordmark.tsx`): replaces the retired "M" tile (`.brand-mark` is hidden by CSS until each screen switches). Put it inside a named link/button.
- Buttons: `.btn.btn-primary`, `.btn.btn-ghost` (legacy `.primary-action`, `.secondary-action`, `.primary-button`, `.submit-exam`, `.google-button` render the same).
- `.chip` (pill with icon), `.num`, `.display`, `.read`, `.visually-hidden`.
- Icons (`src/icons.tsx`): add new ones there, 24×24 stroke paths, `aria-hidden`.
- The old spot illustrations (`src/illustrations.tsx`, `.art*`, `.page-art`) and the 3D `public/art/hero.*` are deleted; use `<Poster>`.
