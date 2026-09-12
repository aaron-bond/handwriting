import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';

// Fixed height for the practice row; width tracks the container so the
// canvases can be reflowed (and redrawn crisply) on resize/orientation change.
const ROW_HEIGHT = 220;
const BASELINE_RATIO = 0.7; // where the text baseline sits within the row

const PRINT_FONT = '"Comic Sans MS", sans-serif';
const CURSIVE_FONT = '"Dancing Script", cursive';
// Dancing Script's x-height is much smaller relative to its em box than
// Comic Sans's, so it needs a size boost to read at a comparable scale.
const CURSIVE_SIZE_MULTIPLIER = 1.4;

@Component({
  selector: 'app-trace-line',
  imports: [],
  templateUrl: './trace-line.html',
  styleUrl: './trace-line.css',
})
export class TraceLine {
  readonly text = input.required<string>();
  readonly fontSize = input(120);
  readonly cursive = input(false);

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly guideCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('guide');
  private readonly inkCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('ink');

  private resizeObserver?: ResizeObserver;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;

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
      this.fontSize();
      this.cursive();
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

    const baselineY = ROW_HEIGHT * BASELINE_RATIO;

    // Set the font before measuring, so the x-height (and hence the midline)
    // reflects the font actually in use rather than a guessed ratio.
    const isCursive = this.cursive();
    const fontFamily = isCursive ? CURSIVE_FONT : PRINT_FONT;
    const size = isCursive ? this.fontSize() * CURSIVE_SIZE_MULTIPLIER : this.fontSize();
    const fontSpec = `${size}px ${fontFamily}`;
    ctx.font = fontSpec;
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
    ctx.letterSpacing = isCursive ? '4px' : '0px';
    ctx.strokeText(this.text(), 24, baselineY);

    // Unlike DOM text, drawing to a canvas never triggers the browser to
    // fetch a @font-face - it just silently falls back. Kick the load off
    // explicitly and redraw once the real glyphs are available.
    if (isCursive && !document.fonts.check(fontSpec)) {
      document.fonts.load(fontSpec).then(() => this.drawGuide());
    }
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

    ctx.strokeStyle = '#1d4ed8';
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
  }

  clear(): void {
    const canvas = this.inkCanvas().nativeElement;
    this.inkContext().clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }
}
