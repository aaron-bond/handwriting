import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

// Fixed height for the practice row; width tracks the container so the
// canvases can be reflowed (and redrawn crisply) on resize/orientation change.
const ROW_HEIGHT = 220;
const BASELINE_RATIO = 0.7; // where the text baseline sits within the row

// "Andika" is a literacy font (designed for beginning readers) - plain,
// single-story "a", no stylistic flourish. Playwrite GB S was tried first
// since it's built for UK handwriting instruction specifically, but its
// entry/exit pen strokes on every letter (each "a" trails into a tail,
// "p"/"y" curl into loops) read as joined/cursive even though the letters
// are technically separate - not the simple print look wanted here.
const PRINT_FONT = '"Andika", sans-serif';
// "Playwrite GB J" (the matching joined/cursive style) turned out to render
// its letters disconnected in both DOM and canvas text at normal tracking -
// tightening letter-spacing brings them closer but never actually joins the
// strokes. Dancing Script isn't curriculum-accurate but reads as genuinely
// connected cursive, which is the point of the toggle.
const CURSIVE_FONT = '"Dancing Script", cursive';
// Dancing Script's x-height is much smaller relative to its em box than
// Playwrite GB S's, so it needs a size boost to read at a comparable scale.
const CURSIVE_SIZE_MULTIPLIER = 1.4;

// Width of the invisible "tolerance corridor" stroked along the guide
// letterforms, used to judge whether ink landed on the letter (the live
// green/red ink colour). Generous, since a child's pen control is
// imprecise - this is a forgiving "are you roughly on the letter" test.
const TARGET_TOLERANCE_WIDTH = 32;
// A second, thin mask tracing the letterform's true path (not a wide
// corridor) - coverage asks "did ink pass near each point of the actual
// path", so the mask itself just needs to mark that path; making it wide
// would compare pixel AREAS instead (mask vs. ink), and since ink is a
// thin line, even a perfect trace could then only ever fill a sliver of a
// wide corridor's area and would always score low.
const COVERAGE_PATH_WIDTH = 8;
// How far from each point on that path to look for ink - this, not the
// mask width, is what makes coverage forgiving of a child's imprecision.
const COVERAGE_TOLERANCE_RADIUS = 8;
// Coverage scan reads every Nth backing-store pixel rather than all of
// them - it only runs on a button click, but there's no need to walk
// every pixel to get a representative percentage.
const COVERAGE_SAMPLE_STRIDE = 4;

const ON_TARGET_COLOR = '#16a34a';
const OFF_TARGET_COLOR = '#dc2626';

interface GuideFont {
  fontSpec: string;
  isCursive: boolean;
}

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'rectangle' | 'star';

export interface TracingResult {
  coverage: number;
  message: string;
}

@Component({
  selector: 'app-trace-line',
  imports: [],
  templateUrl: './trace-line.html',
  styleUrl: './trace-line.css',
})
export class TraceLine {
  // Exactly one of `text`/`shape` is meaningful per use - `shape` wins
  // when set, since a guide is either a word or a shape, never both.
  readonly text = input<string>('');
  readonly shape = input<ShapeKind | null>(null);
  readonly fontSize = input(120);
  readonly cursive = input(false);

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly guideCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('guide');
  private readonly inkCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('ink');

  private resizeObserver?: ResizeObserver;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;

  // Off-screen canvases holding the guide masks - never added to the DOM,
  // only read back as pixel data. See TARGET_TOLERANCE_WIDTH/
  // COVERAGE_PATH_WIDTH above for why there are two.
  private readonly targetCanvas = document.createElement('canvas');
  private targetMask?: ImageData;
  private readonly coverageCanvas = document.createElement('canvas');
  private coverageMask?: ImageData;

  // Live tracing score - recomputed after each stroke (see onPointerUp)
  // rather than behind a manual button, so there's one less thing on
  // screen for a child to have to press. Public and read-only: callers
  // just read it reactively, there's nothing to trigger it from outside.
  private readonly _result = signal<TracingResult | null>(null);
  readonly result = this._result.asReadonly();

  constructor() {
    // Canvas backing size depends on the container's rendered width, which
    // isn't known until after the first render.
    afterNextRender(() => {
      const container = this.container().nativeElement;
      this.resizeObserver = new ResizeObserver(() => this.drawGuide());
      this.resizeObserver.observe(container);
      this.drawGuide();
    });

    inject(DestroyRef).onDestroy(() => this.resizeObserver?.disconnect());

    effect(() => {
      this.text();
      this.shape();
      this.fontSize();
      this.cursive();
      // A previous score describes the old guide, not this one.
      this._result.set(null);
      this.drawGuide();
    });
  }

  private sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  private currentFont(): GuideFont {
    const isCursive = this.cursive();
    const fontFamily = isCursive ? CURSIVE_FONT : PRINT_FONT;
    const size = isCursive ? this.fontSize() * CURSIVE_SIZE_MULTIPLIER : this.fontSize();
    return { fontSpec: `${size}px ${fontFamily}`, isCursive };
  }

  // Positions and strokes `text` identically on any context - used for both
  // the visible dashed guide and the invisible tolerance-corridor mask, so
  // the two always stay aligned regardless of font/size/cursive.
  private strokeGuideText(ctx: CanvasRenderingContext2D, baselineY: number, font: GuideFont): void {
    ctx.font = font.fontSpec;
    ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = font.isCursive ? '4px' : '0px';
    ctx.strokeText(this.text(), 24, baselineY);
  }

  // Plots and strokes a shape centred in the ROW_HEIGHT box - the shape
  // equivalent of strokeGuideText, used identically for the visible guide
  // and both hit-testing masks.
  private strokeGuideShape(ctx: CanvasRenderingContext2D, shape: ShapeKind, width: number): void {
    const cx = width / 2;
    const cy = ROW_HEIGHT / 2;
    const size = Math.min(width, ROW_HEIGHT) * 0.7;

    ctx.beginPath();
    switch (shape) {
      case 'circle':
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        break;
      case 'square':
        ctx.rect(cx - size / 2, cy - size / 2, size, size);
        break;
      case 'rectangle':
        ctx.rect(cx - size * 0.65, cy - size * 0.4, size * 1.3, size * 0.8);
        break;
      case 'triangle':
        ctx.moveTo(cx, cy - size / 2);
        ctx.lineTo(cx + size / 2, cy + size / 2);
        ctx.lineTo(cx - size / 2, cy + size / 2);
        ctx.closePath();
        break;
      case 'star': {
        const outerR = size / 2;
        const innerR = outerR * 0.4;
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }
    }
    ctx.stroke();
  }

  private drawGuide(): void {
    const width = this.container().nativeElement.clientWidth;
    if (width === 0) return;

    const guide = this.guideCanvas();
    const ink = this.inkCanvas();

    // Keep the ink canvas's backing store in sync with the guide canvas so
    // strokes stay aligned after a resize (this clears in-progress ink,
    // which is an acceptable trade-off for a resize/orientation change).
    this.sizeCanvas(ink.nativeElement, width, ROW_HEIGHT);

    const ctx = this.sizeCanvas(guide.nativeElement, width, ROW_HEIGHT);
    ctx.clearRect(0, 0, width, ROW_HEIGHT);

    const shape = this.shape();
    if (shape) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      this.strokeGuideShape(ctx, shape, width);

      const draw = (c: CanvasRenderingContext2D) => this.strokeGuideShape(c, shape, width);
      this.targetMask = this.strokeMask(this.targetCanvas, width, TARGET_TOLERANCE_WIDTH, draw);
      this.coverageMask = this.strokeMask(this.coverageCanvas, width, COVERAGE_PATH_WIDTH, draw);
      return;
    }

    const baselineY = ROW_HEIGHT * BASELINE_RATIO;
    const font = this.currentFont();

    // Set the font before measuring, so the x-height (and hence the midline)
    // reflects the font actually in use rather than a guessed ratio.
    ctx.font = font.fontSpec;
    ctx.textBaseline = 'alphabetic';

    // "x" is a lowercase letter with no ascender/descender, so its own
    // bounding-box ascent is a direct measurement of this font's x-height.
    const xHeight = ctx.measureText('x').actualBoundingBoxAscent;
    const midlineY = baselineY - xHeight;

    // Baseline rule, for orientation.
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.stroke();

    // Mid-height (x-height) guide line, marking where lowercase letters
    // without ascenders should top out.
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midlineY);
    ctx.lineTo(width, midlineY);
    ctx.stroke();

    // Dashed guide text to trace over.
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    this.strokeGuideText(ctx, baselineY, font);

    // Unlike DOM text, drawing to a canvas never triggers the browser to
    // fetch a @font-face - it just silently falls back. Kick the load off
    // explicitly and redraw once the real glyphs are available. (Both fonts
    // are webfonts now, so this applies regardless of print/cursive.)
    if (!document.fonts.check(font.fontSpec)) {
      document.fonts.load(font.fontSpec).then(() => this.drawGuide());
    }

    const drawText = (c: CanvasRenderingContext2D) => this.strokeGuideText(c, baselineY, font);
    this.targetMask = this.strokeMask(this.targetCanvas, width, TARGET_TOLERANCE_WIDTH, drawText);
    this.coverageMask = this.strokeMask(this.coverageCanvas, width, COVERAGE_PATH_WIDTH, drawText);
  }

  // Renders the guide (text or shape, via `draw`) off-screen with a thick
  // solid stroke of the given width, and returns the resulting pixel data
  // for hit-testing.
  private strokeMask(
    canvas: HTMLCanvasElement,
    width: number,
    lineWidth: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): ImageData {
    const ctx = this.sizeCanvas(canvas, width, ROW_HEIGHT);
    ctx.clearRect(0, 0, width, ROW_HEIGHT);
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    draw(ctx);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // Converts CSS-pixel coordinates (as used by pointer events) to the
  // DPR-scaled backing-store index of the cached target mask.
  private isOnTarget(cssX: number, cssY: number): boolean {
    const mask = this.targetMask;
    if (!mask) return false;
    const dpr = window.devicePixelRatio || 1;
    const x = Math.round(cssX * dpr);
    const y = Math.round(cssY * dpr);
    if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
    const alphaIndex = (y * mask.width + x) * 4 + 3;
    return mask.data[alphaIndex] > 0;
  }

  private inkContext(): CanvasRenderingContext2D {
    return this.inkCanvas().nativeElement.getContext('2d')!;
  }

  private pointerPosition(event: PointerEvent): { x: number; y: number } {
    const rect = this.inkCanvas().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.inkCanvas().nativeElement.setPointerCapture(event.pointerId);
    this.drawing = true;
    const { x, y } = this.pointerPosition(event);
    this.lastX = x;
    this.lastY = y;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing) return;
    event.preventDefault();
    const { x, y } = this.pointerPosition(event);
    const ctx = this.inkContext();

    const isPen = event.pointerType === 'pen';
    const width = isPen ? Math.max(1.5, event.pressure * 8) : 4;

    ctx.strokeStyle = this.isOnTarget(x, y) ? ON_TARGET_COLOR : OFF_TARGET_COLOR;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.lastX, this.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    this.lastX = x;
    this.lastY = y;
  }

  onPointerUp(event: PointerEvent): void {
    this.drawing = false;
    this.inkCanvas().nativeElement.releasePointerCapture(event.pointerId);
    // Recompute after each completed stroke, not on every pointermove -
    // scanning the ink/mask pixel buffers isn't free, and a stroke lift
    // (finishing a letter, picking the pen back up) is a natural, cheap
    // checkpoint for "how's it looking so far".
    this._result.set(this.computeResult());
  }

  clear(): void {
    const canvas = this.inkCanvas().nativeElement;
    this.inkContext().clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    this._result.set(null);
  }

  // Whether any ink pixel exists within `radius` of (x, y) - a cheap stand-in
  // for "dilate the ink, then compare", so coverage tolerates a child's pen
  // wandering a bit off the true path without needing the path mask itself
  // to be as wide as that tolerance (see COVERAGE_PATH_WIDTH above).
  private hasInkNear(ink: ImageData, x: number, y: number, radius: number): boolean {
    const step = 2;
    for (let dy = -radius; dy <= radius; dy += step) {
      const ny = y + dy;
      if (ny < 0 || ny >= ink.height) continue;
      for (let dx = -radius; dx <= radius; dx += step) {
        const nx = x + dx;
        if (nx < 0 || nx >= ink.width) continue;
        if (ink.data[(ny * ink.width + nx) * 4 + 3] > 0) return true;
      }
    }
    return false;
  }

  // Scans the (narrow) coverage mask against the accumulated ink and
  // reports what fraction of the guide letters actually got traced over.
  private computeResult(): TracingResult {
    const mask = this.coverageMask;
    if (!mask) return { coverage: 0, message: "Couldn't check yet - try again." };

    const inkCanvas = this.inkCanvas().nativeElement;
    const ink = this.inkContext().getImageData(0, 0, inkCanvas.width, inkCanvas.height);

    let targetPixels = 0;
    let coveredPixels = 0;
    for (let y = 0; y < mask.height; y += COVERAGE_SAMPLE_STRIDE) {
      for (let x = 0; x < mask.width; x += COVERAGE_SAMPLE_STRIDE) {
        const alphaIndex = (y * mask.width + x) * 4 + 3;
        if (mask.data[alphaIndex] > 0) {
          targetPixels++;
          if (this.hasInkNear(ink, x, y, COVERAGE_TOLERANCE_RADIUS)) coveredPixels++;
        }
      }
    }

    const coverage = targetPixels === 0 ? 0 : Math.round((coveredPixels / targetPixels) * 100);
    if (coverage >= 80) return { coverage, message: `Great tracing! ${coverage}% traced.` };
    if (coverage >= 50) return { coverage, message: `Good try - ${coverage}% traced. Fill in the gaps!` };
    return { coverage, message: `${coverage}% traced - trace over the dashed lines.` };
  }
}
