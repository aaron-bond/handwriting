import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
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

export type PictureKind = 'balloon' | 'apple' | 'heart' | 'star' | 'icecream';

interface PictureDef {
  color: string;
  // Builds the missing piece's path only (moveTo/arc/etc) - the caller
  // decides whether to stroke it dashed (incomplete) or fill it solid
  // (complete), so the same path works for both the visible art and the
  // hit-testing mask.
  hole: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void;
  // Draws the picture's permanent, already-"coloured" pieces - each a
  // self-contained beginPath+fill/stroke, positioned so they never
  // overlap the hole (adjacent, not on top of it).
  context: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void;
}

const PICTURES: Record<PictureKind, PictureDef> = {
  balloon: {
    color: '#4dabf7',
    hole: (ctx, cx, cy, size) => ctx.arc(cx, cy - size * 0.15, size * 0.32, 0, Math.PI * 2),
    context: (ctx, cx, cy, size) => {
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
    context: () => {},
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
    context: () => {},
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

  constructor() {
    afterNextRender(() => {
      const container = this.container().nativeElement;
      this.resizeObserver = new ResizeObserver(() => this.draw());
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
    this.drawing = true;
    const { x, y } = this.pointerPosition(event);
    this.lastX = x;
    this.lastY = y;
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
    this.draw();
  }
}
