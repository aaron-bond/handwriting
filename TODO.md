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
