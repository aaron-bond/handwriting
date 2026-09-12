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

## Content / workbooks

- [x] Home screen listing workbooks to open, instead of a single hard-coded
      word. Also kept the old free-text entry as a "Custom Word" tile.
- [x] Workbook: everyday words (colours, household objects, etc.) — 10
      words, with Next/Previous navigation and progress ("Word X of Y").
- [ ] Workbook: maths (simple equations, e.g. "1 + 1 = 2").
- [x] Workbook: shapes — circle, square, triangle, rectangle, star.
      TraceLine gained a `shape` input alongside `text` (drawn via Canvas
      path primitives instead of strokeText), reusing the same pixel-mask
      tracing/scoring pipeline unchanged.
- [ ] Workbook: alphabet (A-Z, one letter at a time).
- [ ] Workbook: "Doodles" (working name, open to better) — simple
      pictures rather than single geometric shapes: a smiling face,
      waves, a basic tree, etc. Likely needs TraceLine's shape support
      extended from one path primitive to a small composed drawing (e.g.
      face = circle + two dot eyes + curved smile) rather than a single
      `ShapeKind`.

## Other activity ideas

- [ ] "Complete the picture" activity — a simple solid-colour image with
      one piece missing (left blank/outlined); the child scribbles/colours
      in the missing piece, and on submit that area is replaced with the
      real solid-colour piece, completing the picture. A different
      interaction model from tracing-and-scoring: it's about rewarding
      any reasonable attempt at filling the space (not accuracy against a
      guide path), with a satisfying reveal at the end regardless of how
      messy the colouring is. Needs: a way to define an image + its
      missing region (simplest: a filled shape/path marking the "hole",
      similar to how Shapes/Doodles define their guides), a "did they
      colour roughly inside the hole" check (loose - just enough ink
      inside the region, not the precise on-path scoring TraceLine does),
      and a reveal step that swaps the ink for the solid-colour fill.

## Visual design

- [ ] Give the app a soft, child-friendly aesthetic — it's currently
      plain/functional (system-ui font, basic borders, flat buttons).
      Think rounded shapes, a warm/playful colour palette, friendlier
      typography for the UI chrome (not the tracing guide fonts
      themselves), bigger touch-friendly tap targets for tablet use.
      First pass done: pastel-blue palette + Fredoka/Nunito fonts as
      shared tokens in `styles.css`, applied to the home screen (rounded
      shadowed cards, icons, hover lift) and shared controls (pill
      buttons) used everywhere else. Still to revisit: the practice
      screens' layout/spacing beyond just the shared buttons, and the
      tracing canvas area itself (currently plain white/transparent).
