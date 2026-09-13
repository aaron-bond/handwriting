# Todo

## Core tracing experience

- [x] Capture and score the child's strokes against the guide letters, to
      tell whether a letter was traced accurately. Live ink colour
      (green/red) shows on/off-target as they write; a Check button scores
      overall coverage against the guide, pixel-mask based (no font-path
      library).
- [x] Simpler, more child-friendly fonts — print uses Andika (a literacy
      font: plain, single-story "a", no flourish). Playwrite GB S was
      tried first but its entry/exit pen strokes read as joined/cursive
      even with separate letters, which wasn't the plain-print look
      wanted. Cursive is still Dancing Script (decorative) — the matching
      Playwrite GB J style doesn't actually render its letters joined.
- [x] Made the % score live instead of needing a Check button. TraceLine
      now recomputes its own score on `pointerup` (each completed stroke,
      not every pointermove) and exposes it as a public read-only signal
      (`result`); Practice/App just read it reactively instead of holding
      their own feedback state and calling a method. Check button removed
      everywhere - Clear stays.
- [x] Added a tappable item picker to Practice - a row of pills (one per
      workbook item, showing its text or a representative emoji for
      shapes/doodles) below the nav bar, so you can jump straight to any
      item instead of only stepping sequentially. Previous/Next are now
      bare arrow icons (◀▶, no text) since the picker is the primary
      "where am I" UI now. Not added to the Custom Word screen - it's a
      single free-typed word, not a list to pick from. Alphabet's 26
      one-pair items were also regrouped into 9 items of 3 pairs each
      ("Aa Bb Cc", ..., "Yy Zz") - the picker helps, but 26 pages of
      near-identical content was the bigger underlying problem.

## Content / workbooks

- [x] Home screen listing workbooks to open, instead of a single hard-coded
      word. Also kept the old free-text entry as a "Custom Word" tile.
- [x] Workbook: everyday words (colours, household objects, etc.) — 10
      words, with Next/Previous navigation and progress ("Word X of Y").
- [x] Workbook: maths — 10 basic sums (addition and subtraction, e.g.
      "1 + 1 = 2", "5 - 2 = 3"), spaced out so each symbol traces cleanly
      on its own. Also generalized workbook metadata: `icon`/`itemLabel`
      now live on each `Workbook` entry instead of Home/Practice
      special-casing `workbook.id` per new workbook.
- [x] Workbook: shapes — circle, square, triangle, rectangle, star.
      TraceLine gained a `shape` input alongside `text` (drawn via Canvas
      path primitives instead of strokeText), reusing the same pixel-mask
      tracing/scoring pipeline unchanged.
- [x] Workbook: alphabet — upper/lowercase pairs (Aa, Bb, Cc, ... Zz)
      rather than one bare letter at a time, so each item shows how the
      two forms relate. Fit entirely into the existing text-item
      architecture (each pair is just a two-character string) - no
      TraceLine changes needed. (Later regrouped 3-per-item - see the
      item picker entry above.)
- [x] Workbook: "Doodles" — face, sun, tree, house, waves. Turned out not
      to need any new architecture: each is still just a `ShapeKind`
      (extended `strokeGuideShape()` to stroke a handful of independent
      pieces - circle + eyes + smile for `face`, etc. - instead of one),
      so it reuses Shapes' rendering/scoring pipeline completely unchanged.

## Other activity ideas

- [x] "Complete the Picture" activity — balloon, apple, heart, star,
      icecream. A different interaction model from every other workbook
      (reward any reasonable colouring attempt, not precision), so it's
      its own `PictureFill` component rather than another TraceLine mode:
      one filled-region pixel mask (not TraceLine's wide-corridor/narrow-
      path pair - a hole and a scribble are both *areas*, so plain
      pixel-for-pixel overlap works, no tolerance radius needed), ink
      always drawn in the picture's own target colour, and no in-progress
      percentage shown - it's silent until >=50% coverage, then reveals a
      solid fill and a fixed celebration result. Found and fixed a real
      bug along the way: the "reset on picture change" effect called
      draw(), which reads the `completed` signal to decide dashed-vs-
      filled rendering - since the effect also *writes* `completed`, it
      ended up depending on its own write (via that nested read) and
      immediately undid every completion right after `onPointerUp` set
      it, wiping the ink and message with no visible error. Fixed with
      `untracked()` around the writes/redraw.
- [ ] "Complete the Picture" has gone down well with actual kids testing
      it - worth investing further. Two directions: (1) more detail per
      picture - right now each is just one hole plus 0-2 simple adjacent
      context pieces (a string, a stem+leaf, a cone); could add more
      context pieces per picture (e.g. clouds/sun behind the balloon,
      grass under the tree in Doodles-style compositions, a face on the
      ice-cream cone) for a richer scene, and/or multiple holes per
      picture (colour in several pieces to complete one bigger scene,
      rather than always a single hole). (2) more pictures - candidates:
      fish, butterfly, rainbow, flower, cupcake, car, boat. Both are
      additive to `PICTURES`/`PictureDef` in `picture-fill.ts` - worth
      checking first whether multiple holes needs `PictureDef.hole` to
      become a list rather than a single path function.

## Visual design

- [x] Give the app a soft, child-friendly aesthetic — it's currently
      plain/functional (system-ui font, basic borders, flat buttons).
      Think rounded shapes, a warm/playful colour palette, friendlier
      typography for the UI chrome (not the tracing guide fonts
      themselves), bigger touch-friendly tap targets for tablet use.
      First pass done: pastel-blue palette + Fredoka/Nunito fonts as
      shared tokens in `styles.css`, applied to the home screen (rounded
      shadowed cards, icons, hover lift) and shared controls (pill
      buttons) used everywhere else.
      Second pass done: per-workbook accent colours (each `Workbook` has
      a `color` - accent/accentDark/accentSoft - bound as CSS custom
      properties on its tile and practice screen, so the shared button/
      input/feedback styles pick it up automatically via
      `var(--accent, var(--color-primary))` fallbacks); colour-matched
      icon badges on home tiles; button icons (🏠◀▶🧹) on the nav
      buttons; a celebratory pop-in pill (🎉 + bounce animation) when the
      live score reaches ≥80%; and soft blurred background blobs behind
      every screen. TraceLine's tracing result is `{ coverage, message }`
      rather than a bare string so callers can style by score tier
      without parsing the message text (see live-scoring item above).
      Third pass done: the tracing canvas itself is now wrapped in a
      white rounded card (`trace-card` in `trace-line.html`/`.css`),
      matching the home tiles - same radius, same accent-tinted soft
      shadow via `color-mix()`, using the workbook's `--accent` variable
      already threaded through from the earlier colour pass.
