import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TracingResult } from '../trace-line/trace-line';

// Kept in sync with TraceLine's ROW_HEIGHT so both components' trace-card
// wrappers end up the same size.
const ROW_HEIGHT = 220;

// A scribble only needs to cover roughly half the hole to count - this
// activity rewards a reasonable attempt, not precision (there's no
// "off-target" ink here the way TraceLine has).
const COMPLETE_THRESHOLD = 50;
const SAMPLE_STRIDE = 4;
// See TraceLine's MAX_UNDO_STEPS for why this is capped - same "whole
// canvas per snapshot" cost.
const MAX_UNDO_STEPS = 25;

export type PictureKind =
  | 'balloon'
  | 'apple'
  | 'heart'
  | 'star'
  | 'icecream'
  | 'fish'
  | 'butterfly'
  | 'rainbow'
  | 'flower'
  | 'cupcake'
  | 'car'
  | 'boat';

interface PictureDef {
  color: string;
  // Builds the missing piece's path only (moveTo/arc/etc) - the caller
  // decides whether to stroke it dashed (incomplete) or fill it solid
  // (complete), so the same path works for both the visible art and the
  // hit-testing mask. Can draw more than one sub-path (e.g. two wings,
  // five petals) to make a multi-piece hole - no separate "list of holes"
  // plumbing needed, a canvas path already supports disjoint sub-paths
  // and fill()/stroke() apply to all of them at once. Each sub-path after
  // the first needs its own explicit moveTo to its start point, or the
  // browser will draw a stray connecting line from the previous sub-path.
  hole: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void;
  // Draws the picture's permanent, already-"coloured" pieces - each a
  // self-contained beginPath+fill/stroke, positioned so they never
  // obscure the hole (adjacent, not on top of it - a small deliberate
  // exception is where two pieces are meant to visually join, like a
  // flower's petals meeting its center).
  context: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void;
}

// Three overlapping circles for a simple cloud puff - shared by pictures
// with a sky backdrop.
function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#e7f5ff';
  ctx.beginPath();
  ctx.arc(x - r * 0.6, y, r * 0.5, 0, Math.PI * 2);
  ctx.arc(x, y - r * 0.2, r * 0.65, 0, Math.PI * 2);
  ctx.arc(x + r * 0.6, y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

// A small 4-point twinkle, used as a decorative accent around a few
// pictures.
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.25, y - r * 0.25);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.25, y + r * 0.25);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.25, y + r * 0.25);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.25, y - r * 0.25);
  ctx.closePath();
  ctx.fill();
}

// Builds a closed arch-shaped band (like one rainbow stripe) between two
// radii, from the leftmost point round the top to the rightmost point.
function ringArchPath(ctx: CanvasRenderingContext2D, cx: number, y: number, outerR: number, innerR: number): void {
  ctx.arc(cx, y, outerR, Math.PI, 2 * Math.PI);
  ctx.arc(cx, y, innerR, 2 * Math.PI, Math.PI, true);
  ctx.closePath();
}

const PICTURES: Record<PictureKind, PictureDef> = {
  balloon: {
    color: '#4dabf7',
    hole: (ctx, cx, cy, size) => ctx.arc(cx, cy - size * 0.15, size * 0.32, 0, Math.PI * 2),
    context: (ctx, cx, cy, size) => {
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.arc(cx - size * 0.62, cy - size * 0.5, size * 0.13, 0, Math.PI * 2);
      ctx.fill();
      drawCloud(ctx, cx + size * 0.6, cy - size * 0.48, size * 0.17);

      ctx.strokeStyle = '#868e96';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy + size * 0.17);
      ctx.quadraticCurveTo(cx - size * 0.05, cy + size * 0.3, cx, cy + size * 0.45);
      ctx.stroke();
    },
  },
  apple: {
    color: '#fa5252',
    hole: (ctx, cx, cy, size) => ctx.arc(cx, cy + size * 0.08, size * 0.3, 0, Math.PI * 2),
    context: (ctx, cx, cy, size) => {
      ctx.strokeStyle = '#8d6748';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.22);
      ctx.quadraticCurveTo(cx + size * 0.03, cy - size * 0.3, cx - size * 0.02, cy - size * 0.36);
      ctx.stroke();

      ctx.fillStyle = '#51cf66';
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.1, cy - size * 0.33, size * 0.09, size * 0.05, -0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#51cf66';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const dx of [-0.5, -0.2, 0.2, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(cx + size * dx, cy + size * 0.48);
        ctx.quadraticCurveTo(cx + size * dx + size * 0.03, cy + size * 0.38, cx + size * dx + size * 0.06, cy + size * 0.48);
        ctx.stroke();
      }
    },
  },
  heart: {
    color: '#f06595',
    hole: (ctx, cx, cy, size) => {
      const top = cy - size * 0.35;
      const topCurveHeight = size * 0.3;
      ctx.moveTo(cx, top + topCurveHeight);
      ctx.bezierCurveTo(cx, top, cx - size / 2, top, cx - size / 2, top + topCurveHeight);
      ctx.bezierCurveTo(
        cx - size / 2,
        top + (size + topCurveHeight) / 2,
        cx,
        top + (size + topCurveHeight) / 2,
        cx,
        top + size,
      );
      ctx.bezierCurveTo(
        cx,
        top + (size + topCurveHeight) / 2,
        cx + size / 2,
        top + (size + topCurveHeight) / 2,
        cx + size / 2,
        top + topCurveHeight,
      );
      ctx.bezierCurveTo(cx + size / 2, top, cx, top, cx, top + topCurveHeight);
    },
    context: (ctx, cx, cy, size) => {
      drawSparkle(ctx, cx - size * 0.55, cy - size * 0.25, size * 0.06, '#ffe066');
      drawSparkle(ctx, cx + size * 0.5, cy + size * 0.15, size * 0.05, '#ffe066');
      drawSparkle(ctx, cx + size * 0.1, cy - size * 0.55, size * 0.045, '#ffe066');
    },
  },
  star: {
    color: '#ffd43b',
    hole: (ctx, cx, cy, size) => {
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
    },
    context: (ctx, cx, cy, size) => {
      drawSparkle(ctx, cx - size * 0.65, cy - size * 0.35, size * 0.05, '#fff3bf');
      drawSparkle(ctx, cx + size * 0.6, cy - size * 0.1, size * 0.04, '#fff3bf');
      drawSparkle(ctx, cx - size * 0.5, cy + size * 0.4, size * 0.04, '#fff3bf');
    },
  },
  icecream: {
    color: '#ff8787',
    hole: (ctx, cx, cy, size) => ctx.arc(cx, cy - size * 0.18, size * 0.28, 0, Math.PI * 2),
    context: (ctx, cx, cy, size) => {
      ctx.fillStyle = '#d2a679';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.22, cy + size * 0.05);
      ctx.lineTo(cx + size * 0.22, cy + size * 0.05);
      ctx.lineTo(cx, cy + size * 0.45);
      ctx.closePath();
      ctx.fill();

      // A doodle-style face on the cone, below the (still-empty) scoop.
      ctx.fillStyle = '#5c3a21';
      ctx.beginPath();
      ctx.arc(cx - size * 0.08, cy + size * 0.17, size * 0.025, 0, Math.PI * 2);
      ctx.arc(cx + size * 0.08, cy + size * 0.17, size * 0.025, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5c3a21';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + size * 0.22, size * 0.06, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    },
  },
  fish: {
    color: '#20c997',
    hole: (ctx, cx, cy, size) => ctx.ellipse(cx - size * 0.1, cy, size * 0.3, size * 0.2, 0, 0, Math.PI * 2),
    context: (ctx, cx, cy, size) => {
      const bodyRightX = cx - size * 0.1 + size * 0.3;
      ctx.fillStyle = '#0ca678';
      ctx.beginPath();
      ctx.moveTo(bodyRightX, cy);
      ctx.lineTo(bodyRightX + size * 0.22, cy - size * 0.16);
      ctx.lineTo(bodyRightX + size * 0.22, cy + size * 0.16);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#a5d8ff';
      ctx.beginPath();
      ctx.arc(cx + size * 0.35, cy - size * 0.45, size * 0.04, 0, Math.PI * 2);
      ctx.arc(cx + size * 0.45, cy - size * 0.55, size * 0.025, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  butterfly: {
    color: '#e599f7',
    // Two independent wing sub-paths in one hole - the same technique
    // that lets the star be one path with 10 vertices scales to "more
    // than one piece", no PictureDef.hole-as-a-list needed.
    hole: (ctx, cx, cy, size) => {
      const rx = size * 0.24;
      const ry = size * 0.34;
      ctx.moveTo(cx - size * 0.22 + rx, cy);
      ctx.ellipse(cx - size * 0.22, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.moveTo(cx + size * 0.22 + rx, cy);
      ctx.ellipse(cx + size * 0.22, cy, rx, ry, 0, 0, Math.PI * 2);
    },
    context: (ctx, cx, cy, size) => {
      ctx.fillStyle = '#495057';
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.045, size * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#495057';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.3);
      ctx.quadraticCurveTo(cx - size * 0.08, cy - size * 0.45, cx - size * 0.12, cy - size * 0.5);
      ctx.moveTo(cx, cy - size * 0.3);
      ctx.quadraticCurveTo(cx + size * 0.08, cy - size * 0.45, cx + size * 0.12, cy - size * 0.5);
      ctx.stroke();
    },
  },
  rainbow: {
    color: '#ffd43b',
    hole: (ctx, cx, cy, size) => ringArchPath(ctx, cx, cy + size * 0.35, size * 0.5, size * 0.38),
    context: (ctx, cx, cy, size) => {
      const y = cy + size * 0.35;
      ctx.fillStyle = '#ff8787';
      ctx.beginPath();
      ringArchPath(ctx, cx, y, size * 0.62, size * 0.5);
      ctx.fill();
      ctx.fillStyle = '#69db7c';
      ctx.beginPath();
      ringArchPath(ctx, cx, y, size * 0.38, size * 0.26);
      ctx.fill();

      drawCloud(ctx, cx - size * 0.6, y - size * 0.02, size * 0.15);
      drawCloud(ctx, cx + size * 0.6, y - size * 0.02, size * 0.15);
    },
  },
  flower: {
    color: '#e64980',
    // Five petal sub-paths, each given its own moveTo so the browser
    // doesn't stitch a stray line from one petal to the next.
    hole: (ctx, cx, cy, size) => {
      const r = size * 0.2;
      const dist = size * 0.26;
      for (let i = 0; i < 5; i++) {
        const angle = ((Math.PI * 2) / 5) * i - Math.PI / 2;
        const px = cx + dist * Math.cos(angle);
        const py = cy + dist * Math.sin(angle);
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, Math.PI * 2);
      }
    },
    context: (ctx, cx, cy, size) => {
      // Deliberately drawn under the petals (rather than kept clear of
      // them, unlike every other picture's context) - a flower's center
      // is meant to show through where the petals meet it.
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.13, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#51cf66';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy + size * 0.48);
      ctx.lineTo(cx, cy + size * 0.75);
      ctx.stroke();

      ctx.fillStyle = '#51cf66';
      ctx.beginPath();
      ctx.ellipse(cx + size * 0.13, cy + size * 0.58, size * 0.1, size * 0.05, -0.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  cupcake: {
    color: '#f783ac',
    // Frosting swirl (three overlapping blobs) plus a cherry - another
    // multi-piece hole, all filled/scored as one unit.
    hole: (ctx, cx, cy, size) => {
      ctx.moveTo(cx - size * 0.16 + size * 0.17, cy - size * 0.05);
      ctx.arc(cx - size * 0.16, cy - size * 0.05, size * 0.17, 0, Math.PI * 2);
      ctx.moveTo(cx + size * 0.16 + size * 0.17, cy - size * 0.05);
      ctx.arc(cx + size * 0.16, cy - size * 0.05, size * 0.17, 0, Math.PI * 2);
      ctx.moveTo(cx + size * 0.15, cy - size * 0.3);
      ctx.arc(cx, cy - size * 0.3, size * 0.15, 0, Math.PI * 2);
      ctx.moveTo(cx + size * 0.06, cy - size * 0.42);
      ctx.arc(cx, cy - size * 0.42, size * 0.06, 0, Math.PI * 2);
    },
    context: (ctx, cx, cy, size) => {
      ctx.fillStyle = '#e8590c';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.24, cy + size * 0.14);
      ctx.lineTo(cx + size * 0.24, cy + size * 0.14);
      ctx.lineTo(cx + size * 0.15, cy + size * 0.4);
      ctx.lineTo(cx - size * 0.15, cy + size * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#fff3bf';
      ctx.lineWidth = 2;
      for (const dx of [-0.14, -0.05, 0.05, 0.14]) {
        ctx.beginPath();
        ctx.moveTo(cx + size * dx * 1.4, cy + size * 0.16);
        ctx.lineTo(cx + size * dx, cy + size * 0.38);
        ctx.stroke();
      }
    },
  },
  car: {
    color: '#e03131',
    hole: (ctx, cx, cy, size) => {
      const w = size * 0.9;
      const h = size * 0.36;
      const x = cx - w / 2;
      const y = cy - h / 2 + size * 0.05;
      const r = size * 0.08;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    },
    context: (ctx, cx, cy, size) => {
      const h = size * 0.36;
      const bodyTop = cy - h / 2 + size * 0.05;
      const bodyBottom = bodyTop + h;

      ctx.fillStyle = '#a5d8ff';
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.22, bodyTop);
      ctx.lineTo(cx - size * 0.14, bodyTop - size * 0.18);
      ctx.lineTo(cx + size * 0.14, bodyTop - size * 0.18);
      ctx.lineTo(cx + size * 0.22, bodyTop);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#343a40';
      ctx.beginPath();
      ctx.arc(cx - size * 0.28, bodyBottom, size * 0.09, 0, Math.PI * 2);
      ctx.arc(cx + size * 0.28, bodyBottom, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  boat: {
    color: '#ff922b',
    hole: (ctx, cx, cy, size) => {
      ctx.moveTo(cx - size * 0.4, cy + size * 0.15);
      ctx.lineTo(cx + size * 0.4, cy + size * 0.15);
      ctx.lineTo(cx + size * 0.25, cy + size * 0.4);
      ctx.lineTo(cx - size * 0.25, cy + size * 0.4);
      ctx.closePath();
    },
    context: (ctx, cx, cy, size) => {
      ctx.strokeStyle = '#8d6748';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy + size * 0.15);
      ctx.lineTo(cx, cy - size * 0.4);
      ctx.stroke();

      ctx.fillStyle = '#ffd43b';
      ctx.beginPath();
      ctx.moveTo(cx, cy - size * 0.4);
      ctx.lineTo(cx + size * 0.32, cy + size * 0.1);
      ctx.lineTo(cx, cy + size * 0.1);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#4dabf7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.55, cy + size * 0.45);
      ctx.quadraticCurveTo(cx - size * 0.4, cy + size * 0.38, cx - size * 0.25, cy + size * 0.45);
      ctx.quadraticCurveTo(cx - size * 0.1, cy + size * 0.52, cx + size * 0.05, cy + size * 0.45);
      ctx.quadraticCurveTo(cx + size * 0.2, cy + size * 0.38, cx + size * 0.35, cy + size * 0.45);
      ctx.stroke();
    },
  },
};

@Component({
  selector: 'app-picture-fill',
  imports: [],
  templateUrl: './picture-fill.html',
  styleUrl: './picture-fill.css',
})
export class PictureFill {
  readonly picture = input.required<PictureKind>();

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly artCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('art');
  private readonly inkCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('ink');

  private resizeObserver?: ResizeObserver;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;

  // Off-screen, never added to the DOM - the hole's filled area, read
  // back as pixel data to check how much of it the ink covers.
  private readonly holeCanvas = document.createElement('canvas');
  private holeMask?: ImageData;

  private readonly _completed = signal(false);
  private readonly _result = signal<TracingResult | null>(null);
  readonly result = this._result.asReadonly();

  // One snapshot per stroke, taken just before it starts - including the
  // stroke that pushes coverage past the threshold, so undo can still
  // revert a completion the child didn't mean to trigger (see undo()).
  private readonly undoStack = signal<ImageData[]>([]);
  readonly canUndo = computed(() => this.undoStack().length > 0);

  constructor() {
    afterNextRender(() => {
      const container = this.container().nativeElement;
      this.resizeObserver = new ResizeObserver(() => {
        // Old snapshots are the wrong size once draw() below resizes the
        // ink canvas's backing store.
        this.undoStack.set([]);
        this.draw();
      });
      this.resizeObserver.observe(container);
      this.draw();
    });

    inject(DestroyRef).onDestroy(() => this.resizeObserver?.disconnect());

    effect(() => {
      this.picture();
      // untracked: draw() reads _completed() to decide dashed-vs-filled
      // rendering, and onPointerUp writes _completed - without untracked,
      // this effect would end up depending on _completed too (via that
      // nested read) and immediately undo any completion it triggers,
      // right back to a blank incomplete hole with no ink.
      untracked(() => {
        // A different picture, or the same one drawn again from scratch.
        this._completed.set(false);
        this._result.set(null);
        this.undoStack.set([]);
        this.draw();
      });
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

  private draw(): void {
    const width = this.container().nativeElement.clientWidth;
    if (width === 0) return;

    this.sizeCanvas(this.inkCanvas().nativeElement, width, ROW_HEIGHT);

    const def = PICTURES[this.picture()];
    const cx = width / 2;
    const cy = ROW_HEIGHT / 2;
    const size = Math.min(width, ROW_HEIGHT) * 0.6;

    const ctx = this.sizeCanvas(this.artCanvas().nativeElement, width, ROW_HEIGHT);
    ctx.clearRect(0, 0, width, ROW_HEIGHT);
    def.context(ctx, cx, cy, size);

    ctx.beginPath();
    def.hole(ctx, cx, cy, size);
    if (this._completed()) {
      ctx.fillStyle = def.color;
      ctx.fill();
    } else {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
    }

    const maskCtx = this.sizeCanvas(this.holeCanvas, width, ROW_HEIGHT);
    maskCtx.clearRect(0, 0, width, ROW_HEIGHT);
    maskCtx.beginPath();
    def.hole(maskCtx, cx, cy, size);
    maskCtx.fillStyle = '#000';
    maskCtx.fill();
    this.holeMask = maskCtx.getImageData(0, 0, this.holeCanvas.width, this.holeCanvas.height);
  }

  private inkContext(): CanvasRenderingContext2D {
    return this.inkCanvas().nativeElement.getContext('2d')!;
  }

  private pointerPosition(event: PointerEvent): { x: number; y: number } {
    const rect = this.inkCanvas().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  onPointerDown(event: PointerEvent): void {
    if (this._completed()) return;
    event.preventDefault();
    this.inkCanvas().nativeElement.setPointerCapture(event.pointerId);
    this.pushUndoSnapshot();
    this.drawing = true;
    const { x, y } = this.pointerPosition(event);
    this.lastX = x;
    this.lastY = y;
  }

  private pushUndoSnapshot(): void {
    const canvas = this.inkCanvas().nativeElement;
    const snapshot = this.inkContext().getImageData(0, 0, canvas.width, canvas.height);
    const stack = [...this.undoStack(), snapshot];
    this.undoStack.set(stack.length > MAX_UNDO_STEPS ? stack.slice(-MAX_UNDO_STEPS) : stack);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing) return;
    event.preventDefault();
    const { x, y } = this.pointerPosition(event);

    const isPen = event.pointerType === 'pen';
    const width = isPen ? Math.max(6, event.pressure * 24) : 18;

    const ctx = this.inkContext();
    ctx.strokeStyle = PICTURES[this.picture()].color;
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
    if (!this.drawing) return;
    this.drawing = false;
    this.inkCanvas().nativeElement.releasePointerCapture(event.pointerId);

    const coverage = this.holeCoverage();
    if (coverage >= COMPLETE_THRESHOLD) {
      this._completed.set(true);
      this.inkContext().clearRect(0, 0, this.inkCanvas().nativeElement.clientWidth, ROW_HEIGHT);
      this.draw();
      // Fixed at 100 rather than the raw measured value - the picture is
      // now genuinely, visually complete, and this reuses Practice's
      // existing >=80 celebration styling with no template changes.
      this._result.set({ coverage: 100, message: 'Picture complete! Great colouring.' });
    }
  }

  private holeCoverage(): number {
    const mask = this.holeMask;
    if (!mask) return 0;

    const inkCanvas = this.inkCanvas().nativeElement;
    const ink = this.inkContext().getImageData(0, 0, inkCanvas.width, inkCanvas.height);

    let holePixels = 0;
    let coveredPixels = 0;
    for (let y = 0; y < mask.height; y += SAMPLE_STRIDE) {
      for (let x = 0; x < mask.width; x += SAMPLE_STRIDE) {
        const alphaIndex = (y * mask.width + x) * 4 + 3;
        if (mask.data[alphaIndex] > 0) {
          holePixels++;
          if (ink.data[alphaIndex] > 0) coveredPixels++;
        }
      }
    }
    return holePixels === 0 ? 0 : (coveredPixels / holePixels) * 100;
  }

  clear(): void {
    this._completed.set(false);
    this._result.set(null);
    const canvas = this.inkCanvas().nativeElement;
    this.inkContext().clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    this.undoStack.set([]);
    this.draw();
  }

  undo(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1];
    this.undoStack.set(stack.slice(0, -1));

    if (this._completed()) {
      // The stroke being undone is the one that completed the picture -
      // draw() resizes (and so clears) the ink canvas as a side effect,
      // which would otherwise wipe out `previous` below if this ran
      // after restoring it, so restore the dashed/incomplete look first.
      this._completed.set(false);
      this._result.set(null);
      this.draw();
    }
    this.inkContext().putImageData(previous, 0, 0);
  }
}
