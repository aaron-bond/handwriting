# Handwriting Practice App

A web app that helps young kids practice handwriting on a tablet with a
stylus/pen (or a mouse, for development): faded/dashed guide letters,
shapes, or pictures that the child traces or colours over, with live
feedback. Deployed as a static site via GitHub Pages, following the same
pattern as a sibling project, `../farkle`.

This file is meant to be the fast way back into this project's context -
read this instead of re-deriving the app's shape from scratch. `TODO.md`
is the live backlog (what's done, what's next, and why); this file is the
architecture and the reasoning behind it.

## Stack & deployment

- Angular 22, standalone components only (no NgModules), signals for all
  state, Vitest for unit tests (via `@angular/build:unit-test`).
- No router. Navigation is a plain signal on `App` (`'home' | 'custom' |
  'workbook'`) switched with `@switch`. Deliberate: at this app's size (a
  handful of screens), pulling in `@angular/router` would mean dealing
  with GitHub Pages' static-hosting deep-link problem (a refresh on a
  sub-route 404s without hash routing or a 404.html trick) for no real
  benefit yet.
- `npm test` / `npm start` / `npx ng build --base-href /handwriting/` -
  the base-href matters, it's how the app finds its assets once served
  from `github.io/handwriting/` rather than the domain root.
- `.github/workflows/deploy-gh-pages.yml` builds and pushes `dist/` to
  the `gh-pages` branch on every push to `main`; GitHub Pages serves from
  that branch. A failed deploy with `fatal error in commit_refs` is a
  known transient GitHub-side git backend hiccup, not a code problem -
  just re-run the job.
- Installable as a PWA (`ng add @angular/pwa`, so a child's tablet gets a
  home-screen icon and a standalone window instead of a browser tab).
  `public/manifest.webmanifest` (name/theme/background colour, icon set)
  and `ngsw-config.json` (service-worker asset caching) are both stock
  `@angular/pwa` output, hand-edited only for this app's actual name/
  colours rather than the schematic's Angular-blue defaults;
  `provideServiceWorker(...)` in `app.config.ts` registers it, disabled
  in dev mode. iOS ignores the manifest for "Add to Home Screen" branding
  - `index.html` also carries an `apple-touch-icon` link and
  `apple-mobile-web-app-*` meta tags pointing at the same icon set for
  that. The icons themselves (`public/icons/`, replacing the schematic's
  placeholder Angular logo) are a small pencil-on-blue design rendered
  from one SVG at each required size via a Playwright screenshot script
  (ad hoc, not part of the repo) rather than a raster image editor - kept
  vector until the final rasterization step so every size stays crisp.

## Screens and data model

- `src/app/app.ts` - the root: background decoration, the `<h1>`, and
  the screen switch. Owns the `cursive` preference signal (shared across
  screens, not reset on navigation) and the free-text "Custom Word"
  screen's own state.
- `src/app/home/` - lists a tile per `Workbook` (from
  `src/app/workbook.ts`) plus a "Custom Word" tile. Purely presentational;
  emits which workbook/custom was picked.
- `src/app/practice/` - the navigation shell for a workbook: title,
  progress ("Word 3 of 10"), an item picker (tappable pills, jump to any
  item), Previous/Next (bare arrow icons - the picker is the primary
  navigation now), Clear, and a Cursive checkbox (only for text items).
  Renders `<app-trace-line>` or `<app-picture-fill>` depending on the
  current item's `kind`.
- `src/app/workbook.ts` - `Workbook { id, title, icon, itemLabel, color,
  items }`. `PracticeItem` is a union: `{kind:'text', value: string} |
  {kind:'shape', value: ShapeKind} | {kind:'picture', value:
  PictureKind}`. `color` (`accent`/`accentDark`/`accentSoft`) is bound as
  CSS custom properties on that workbook's tile and practice screen, so
  one set of shared CSS rules (buttons, feedback text, the tracing card's
  shadow) renders every workbook in its own colour via `var(--accent,
  var(--color-primary))` fallbacks - Home/Custom Word have no `--accent`
  set and fall back to the base blue.

## The two tracing/activity components

**`src/app/trace-line/trace-line.ts`** - precision tracing (words,
letters, sums, shapes, doodles). The core trick, used throughout: render
the guide (text via `strokeText`, or a shape/doodle via Canvas path
primitives) onto two extra off-screen canvases at different stroke
widths, then read them back as `ImageData` to hit-test ink against:

- A **wide "target" mask** (tolerance corridor) drives live green/red ink
  colour while drawing - forgiving, since a child's pen control is
  imprecise.
- A **narrow "coverage" mask** (close to the letterform's true path)
  drives the score. It has to be narrow: reusing the wide mask here would
  compare pixel *areas*, and since ink is a thin line, even a perfect
  trace could only ever fill a sliver of a wide corridor and would always
  score low. Tolerance for real imprecision instead comes from a small
  search radius against the ink (`hasInkNear`), not the mask's width.

Score (`result`, a public read-only signal, `{coverage, message}`)
recomputes itself on `pointerup` (not every `pointermove` - it walks
pixel buffers, not free) and resets whenever the guide changes. No Check
button anywhere - fewer buttons is better for kids, so scoring is always
live.

Shapes and doodles are the same mechanism as text: `ShapeKind` covers
both simple ones (circle, square, triangle, rectangle, star) and
composed "doodles" (face, sun, tree, house, waves) that are just a
handful of independently-stroked pieces instead of one - no separate
architecture was needed for doodles, just more `ShapeKind` cases.

**`src/app/picture-fill/picture-fill.ts`** - "Complete the Picture": a
deliberately different interaction model. The child colours in a missing
piece (a hole) of a small picture (balloon, apple, heart, star,
icecream), and once they've made a reasonable attempt (>=50% of the hole
covered by ink, checked pixel-for-pixel with no tolerance radius - a hole
and a scribble are both *areas*, so there's no thin-path-vs-wide-corridor
mismatch to compensate for) it reveals a solid-colour fill and a fixed
celebration result. Deliberately shows nothing before that threshold - no
in-progress percentage, no "keep going" nagging. Each picture is a hole
path plus optional permanent "already coloured" context pieces (a
balloon's string, an apple's stem+leaf) positioned adjacent to the hole,
never on top of it, to dodge any z-order/redraw-order fuss.

**Gotcha hit once, worth remembering:** an `effect()` that both *writes*
a signal and, through a function it calls (like `draw()`), also *reads*
that same signal will end up depending on its own write - the effect
re-fires immediately after the write and can undo it. This bit
`PictureFill`'s completion state (`draw()` read `_completed()` to decide
dashed-vs-filled rendering; the picture-change effect wrote `_completed`
and called `draw()`, so setting `_completed` from `onPointerUp`
re-triggered the effect, which reset it right back). Fixed with
`untracked()` around the effect's writes/redraw. Diagnosed by
instrumenting the actual call sites (console logs on `draw()` and the
effect) rather than guessing from symptoms - the symptom (ink and message
both silently vanishing right after release, no error) didn't point at
the cause on its own.

## Fonts

Guide rendering uses real webfonts, loaded in `index.html` and kicked off
explicitly via `document.fonts.load()` inside `drawGuide()` - canvas text
never triggers a browser font fetch the way DOM text does, so without
this the guide silently falls back to a system font on first paint.

- Print: **Andika** (a literacy font - plain, single-story "a", no
  flourish). Playwrite GB S was tried first since it's purpose-built for
  UK handwriting instruction, but its entry/exit pen strokes on every
  letter read as joined/cursive even though technically separate - not
  the plain-print look wanted.
- Cursive: **Dancing Script** - not curriculum-accurate, but the matching
  Playwrite GB J style turned out to render disconnected letters (both in
  DOM and canvas text, at any letter-spacing tried), so it didn't
  actually achieve "joined" either.

## Visual design

Soft pastel-blue base palette, Fredoka (headings) + Nunito (body) fonts,
all as CSS custom properties in `src/styles.css`. Per-workbook accent
colours (see above) cascade through the shared `.controls button` /
`.feedback` / trace-card shadow rules. Home tiles and the tracing/picture
card share the same rounded-card-with-soft-shadow treatment. A completed/
high (>=80%) score gets a celebratory pop-in pill (`.feedback--celebrate`)
with a bounce animation - reused as-is by `PictureFill` by fixing its
completion coverage at exactly 100.

## Working conventions from this project

- **Verification**: real-browser checks via a local Playwright script
  (not part of the repo - written ad hoc in the scratchpad dir, ink drawn
  via simulated pointer events, screenshotted) for every visual or
  interaction change, in addition to `npm test` and a production build.
  Several real bugs were only caught this way (e.g. the effect/untracked
  issue above) - type-checking and unit tests alone weren't enough for
  canvas-heavy, signal-reactive UI like this.
- **TODO.md**: the live backlog. Check items off with a short note on
  what was actually built and any notable trade-off/deviation from the
  original idea - future sessions (and future us) rely on that, not just
  the checkbox.
- **Git**: commit locally freely with descriptive messages (explaining
  *why*, especially for bugs found/fixed), but always show a short
  summary of what's about to go to `main` and wait for approval before
  `git push` - this holds even though `gh` CLI + git credentials are set
  up for direct push access.
