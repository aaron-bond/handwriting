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

// Taller than TraceLine/PictureFill's 220px row - a dot-to-dot page needs
// room for ~15 dots plus their labels without them crowding each other.
const PAGE_HEIGHT = 460;

// How close (CSS px) the pen has to pass to the next dot to count as
// reaching it - generous, since small hands rarely land dead centre.
const HIT_RADIUS = 24;
const DOT_RADIUS = 6;
// How far a label sits from its dot's centre - see labelDirection().
const LABEL_OFFSET = 18;
const LINE_WIDTH = 6;
// Thinner than the outline, for the details revealed on completion.
const DETAIL_WIDTH = 3;
const LINE_COLOR = '#343a40';
const INK_COLOR = '#5c7cfa';
// See TraceLine's MAX_UNDO_STEPS - same "whole canvas per snapshot" cost.
const MAX_UNDO_STEPS = 25;

// The colouring drawer's crayons, once a picture is finished.
export const PAINT_COLOURS: { name: string; value: string }[] = [
  { name: 'Red', value: '#fa5252' },
  { name: 'Orange', value: '#ff922b' },
  { name: 'Yellow', value: '#fcc419' },
  { name: 'Green', value: '#51cf66' },
  { name: 'Blue', value: '#339af0' },
  { name: 'Purple', value: '#845ef7' },
  { name: 'Pink', value: '#f06595' },
  { name: 'Brown', value: '#a0522d' },
  { name: 'Grey', value: '#adb5bd' },
  { name: 'Black', value: '#343a40' },
];

// Picked in the drawer like a colour, but rubs colouring out instead.
export const ERASER = 'eraser';

export type DotLabelMode = 'numbers' | 'letters';

export type DotsKind = 'star' | 'house' | 'fish' | 'boat' | 'heart' | 'rocket' | 'tree';

type Point = [number, number];

interface DotsDef {
  name: string; // for the completion message, e.g. "a star"
  // Ordered outline points in a 0-100 box (y down). The outline always
  // closes back to the first point once the last one is reached. Kept at
  // 26 or fewer so Letters mode (A-Z) never runs out of labels.
  points: Point[];
  // Line-art details revealed once complete (windows, an eye, ornaments...)
  // - outlines only, no colour, so the finished picture is a blank
  // colouring page rather than a pre-coloured one. Called with the stroke
  // style already set; takes the same box->canvas mapping the points use.
  details?: (ctx: CanvasRenderingContext2D, map: (p: Point) => Point, scale: number) => void;
}

// Samples a closed curve into evenly spaced (in parameter) dots.
function sampled(count: number, fn: (t: number) => Point): Point[] {
  return Array.from({ length: count }, (_, i) => fn((i / count) * Math.PI * 2));
}

function ring(ctx: CanvasRenderingContext2D, [x, y]: Point, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

// A small solid dot in the line colour - pupils, a doorknob.
function spot(ctx: CanvasRenderingContext2D, [x, y]: Point, r: number): void {
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function outline(ctx: CanvasRenderingContext2D, points: Point[], closed = true): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (closed) ctx.closePath();
  ctx.stroke();
}

const DOTS: Record<DotsKind, DotsDef> = {
  star: {
    name: 'a star',
    points: sampled(10, (t) => {
      const r = Math.round((t / (Math.PI * 2)) * 10) % 2 === 0 ? 46 : 19;
      return [50 + r * Math.cos(t - Math.PI / 2), 52 + r * Math.sin(t - Math.PI / 2)];
    }),
    details: (ctx, map, s) => {
      spot(ctx, map([42, 50]), 2.5 * s);
      spot(ctx, map([58, 50]), 2.5 * s);
      const [mx, my] = map([50, 56]);
      ctx.beginPath();
      ctx.arc(mx, my, 6 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    },
  },
  house: {
    name: 'a house',
    points: [
      [20, 95],
      [20, 50],
      [8, 50],
      [50, 10],
      [64, 23],
      [64, 12],
      [76, 12],
      [76, 34],
      [92, 50],
      [80, 50],
      [80, 95],
    ],
    details: (ctx, map, s) => {
      outline(ctx, [map([42, 95]), map([42, 70]), map([58, 70]), map([58, 95])], false);
      spot(ctx, map([54, 83]), 1.2 * s);
      for (const x of [26, 64]) {
        outline(ctx, [map([x, 56]), map([x + 10, 56]), map([x + 10, 66]), map([x, 66])]);
        outline(ctx, [map([x + 5, 56]), map([x + 5, 66])], false);
        outline(ctx, [map([x, 61]), map([x + 10, 61])], false);
      }
    },
  },
  fish: {
    name: 'a fish',
    points: [
      [6, 50],
      [18, 34],
      [36, 26],
      [56, 28],
      [70, 42],
      [92, 24],
      [86, 50],
      [92, 76],
      [70, 58],
      [56, 72],
      [36, 74],
      [18, 66],
    ],
    details: (ctx, map, s) => {
      ring(ctx, map([22, 46]), 4 * s);
      spot(ctx, map([23, 46]), 1.8 * s);
      outline(ctx, [map([40, 50]), map([54, 40]), map([52, 58])]);
      // Gill line behind the head.
      ctx.beginPath();
      const [gx, gy] = map([22, 50]);
      ctx.arc(gx, gy, 12 * s, -0.35 * Math.PI, 0.35 * Math.PI);
      ctx.stroke();
      ring(ctx, map([4, 30]), 2.5 * s);
      ring(ctx, map([8, 20]), 1.8 * s);
    },
  },
  boat: {
    name: 'a boat',
    // Hull, then up the mast to a little flag and down the sail, whose
    // bottom edge is the deck - one outline, no tight notches.
    points: [
      [24, 86],
      [8, 64],
      [46, 64],
      [46, 6],
      [62, 11],
      [46, 16],
      [90, 64],
      [76, 86],
    ],
    details: (ctx, map, s) => {
      // The deck under the sail, closing the sail and hull off as two
      // separate areas to colour.
      outline(ctx, [map([46, 64]), map([90, 64])], false);
      ctx.beginPath();
      for (let x = 0; x < 100; x += 20) {
        const [ax, ay] = map([x, 95]);
        const [bx, by] = map([x + 10, 91]);
        const [cx, cy] = map([x + 20, 95]);
        if (x === 0) ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(bx, by - 4 * s, cx, cy);
      }
      ctx.stroke();
    },
  },
  heart: {
    name: 'a heart',
    // Hand-placed rather than sampled from the parametric heart curve -
    // even parameter steps bunched dots (and their labels) together at
    // the top dip and bottom tip.
    points: [
      [50, 26],
      [60, 14],
      [72, 9],
      [84, 12],
      [92, 22],
      [93, 36],
      [86, 52],
      [72, 68],
      [50, 90],
      [28, 68],
      [14, 52],
      [7, 36],
      [8, 22],
      [16, 12],
      [28, 9],
      [40, 14],
    ],
    details: (ctx, map, s) => {
      // A little shine stroke near the top-left curve.
      ctx.beginPath();
      const [hx, hy] = map([28, 30]);
      ctx.arc(hx, hy, 10 * s, 1.05 * Math.PI, 1.4 * Math.PI);
      ctx.stroke();
    },
  },
  rocket: {
    name: 'a rocket',
    points: [
      [50, 4],
      [62, 20],
      [64, 60],
      [78, 74],
      [78, 88],
      [62, 80],
      [38, 80],
      [22, 88],
      [22, 74],
      [36, 60],
      [38, 20],
    ],
    details: (ctx, map, s) => {
      outline(ctx, [map([38, 20]), map([62, 20])], false);
      ring(ctx, map([50, 40]), 8 * s);
      ring(ctx, map([50, 40]), 5 * s);
      outline(ctx, [map([42, 81]), map([50, 98]), map([58, 81])], false);
      outline(ctx, [map([46, 81]), map([50, 91]), map([54, 81])], false);
    },
  },
  tree: {
    name: 'a tree',
    points: [
      [50, 4],
      [70, 30],
      [59, 30],
      [79, 54],
      [66, 54],
      [88, 78],
      [56, 78],
      [56, 96],
      [44, 96],
      [44, 78],
      [12, 78],
      [34, 54],
      [21, 54],
      [41, 30],
      [30, 30],
    ],
    details: (ctx, map, s) => {
      // Trunk top, splitting the trunk from the branches.
      outline(ctx, [map([44, 78]), map([56, 78])], false);
      for (const p of [
        [50, 20],
        [44, 42],
        [58, 46],
        [34, 68],
        [66, 70],
        [50, 62],
      ] as Point[]) {
        ring(ctx, map(p), 3 * s);
      }
    },
  },
};

export function dotLabel(index: number, mode: DotLabelMode): string {
  return mode === 'letters' ? String.fromCharCode(65 + index) : String(index + 1);
}

// Shortest distance from point P to the segment AB - lets one pointermove
// that jumps clean over a dot (a fast stroke can move tens of px per
// event) still count as passing through it.
export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Which way to push a dot's label: along the bisector of the angle its
// two outline neighbours make, on the side facing away from both - so it
// never sits on either of that dot's own lines. (Pushing away from the
// picture's centre instead put labels on top of lines at every concave
// corner, e.g. inside a house's chimney.) Straight-through dots get the
// perpendicular, towards the outside of the turn.
export function labelDirection(prev: Point, point: Point, next: Point): Point {
  const unit = ([x, y]: Point): Point => {
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length];
  };
  const toPrev = unit([prev[0] - point[0], prev[1] - point[1]]);
  const toNext = unit([next[0] - point[0], next[1] - point[1]]);
  const away: Point = [-(toPrev[0] + toNext[0]), -(toPrev[1] + toNext[1])];
  if (Math.hypot(...away) > 0.05) return unit(away);
  return [toNext[1], -toNext[0]];
}

interface UndoState {
  reached: number;
  fadedInk: ImageData;
  paint: ImageData;
}

@Component({
  selector: 'app-connect-dots',
  imports: [],
  templateUrl: './connect-dots.html',
  styleUrl: './connect-dots.css',
})
export class ConnectDots {
  readonly picture = input.required<DotsKind>();
  readonly labels = input<DotLabelMode>('numbers');

  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly artCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('art');
  // The child's ink is split across two canvases: the stroke in progress
  // draws at full strength on `ink`, and gets moved onto `fadedInk` (CSS
  // opacity, so a plain drawImage copy comes out faded) as soon as it
  // reaches a dot or the pen lifts - the snapped bold line then takes over
  // as "the" picture, with their own attempt still visible underneath.
  private readonly fadedInkCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('fadedInk');
  private readonly inkCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('ink');
  // The child's colouring, once the picture is finished. Sits *under* the
  // line art so outlines stay crisp on top of any scribbling, and holds
  // their actual strokes for good - never swapped for a solid fill, and
  // never clipped to the outline.
  private readonly paintCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('paint');

  private resizeObserver?: ResizeObserver;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;
  private width = 0;

  // How many dots, in order, the child has reached so far. 0 = none yet
  // (dot 1 is the next target); points.length = complete.
  private readonly reached = signal(0);
  // Each dot's on-canvas position (CSS px), recomputed on every draw.
  private readonly positions = signal<Point[]>([]);

  protected readonly completed = computed(() => {
    const total = DOTS[this.picture()].points.length;
    return this.reached() >= total;
  });
  // Drives the pulsing DOM ring over whichever dot is next, so the child
  // never has to hunt for it - a CSS animation rather than a canvas
  // redraw loop.
  protected readonly nextDot = computed<Point | null>(() => {
    if (this.completed()) return null;
    return this.positions()[this.reached()] ?? null;
  });

  protected readonly paintColours = PAINT_COLOURS;
  protected readonly eraser = ERASER;
  // A colour value, or ERASER.
  protected readonly paintColour = signal(PAINT_COLOURS[0].value);
  // The colouring drawer starts tucked away - only its handle shows once
  // the picture is finished, for the child to pull out.
  protected readonly paletteOpen = signal(false);

  private readonly _result = signal<TracingResult | null>(null);
  readonly result = this._result.asReadonly();

  // One snapshot per stroke (dots reached + faded ink), so undo steps back
  // a whole stroke, matching TraceLine/PictureFill - including a stroke
  // that finished the picture.
  private readonly undoStack = signal<UndoState[]>([]);
  readonly canUndo = computed(() => this.undoStack().length > 0);

  constructor() {
    afterNextRender(() => {
      const container = this.container().nativeElement;
      this.resizeObserver = new ResizeObserver(() => {
        this.undoStack.set([]);
        this.resize();
      });
      this.resizeObserver.observe(container);
      this.resize();
      // Canvas text never triggers a webfont fetch on its own (see
      // TraceLine's drawGuide) - load the label font and redraw once it's in.
      document.fonts.load('800 16px Nunito').then(() => this.draw());
    });

    inject(DestroyRef).onDestroy(() => this.resizeObserver?.disconnect());

    effect(() => {
      this.picture();
      // untracked: draw() reads reached/completed - see the PictureFill
      // effect gotcha in CLAUDE.md (an effect depending on its own write).
      untracked(() => this.clear());
    });

    effect(() => {
      this.labels();
      untracked(() => this.draw());
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

  // Resizing clears a canvas's contents, so only do it when the size
  // actually changes - draw() alone is called far more often (every dot
  // reached) and must leave the child's ink alone.
  private resize(): void {
    const width = this.container().nativeElement.clientWidth;
    if (width === 0) return;
    this.width = width;
    this.sizeCanvas(this.paintCanvas().nativeElement, width, PAGE_HEIGHT);
    this.sizeCanvas(this.fadedInkCanvas().nativeElement, width, PAGE_HEIGHT);
    this.sizeCanvas(this.inkCanvas().nativeElement, width, PAGE_HEIGHT);
    this.draw();
  }

  // Maps the picture's 0-100 box onto the canvas, centred, as large as
  // fits with a margin for labels.
  private mapping(): { map: (p: Point) => Point; scale: number } {
    const size = Math.min(this.width, PAGE_HEIGHT) - 2 * (LABEL_OFFSET + 16);
    const scale = size / 100;
    const left = (this.width - size) / 2;
    const top = (PAGE_HEIGHT - size) / 2;
    return { map: ([x, y]) => [left + x * scale, top + y * scale], scale };
  }

  private draw(): void {
    if (this.width === 0) return;
    const def = DOTS[this.picture()];
    const { map, scale } = this.mapping();
    const points = def.points.map(map);
    this.positions.set(points);

    const ctx = this.sizeCanvas(this.artCanvas().nativeElement, this.width, PAGE_HEIGHT);
    ctx.clearRect(0, 0, this.width, PAGE_HEIGHT);
    const reached = this.reached();
    const complete = reached >= points.length;

    // Finished: just the line art, left blank for the child to colour.
    if (complete && def.details) {
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = DETAIL_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      def.details(ctx, map, scale);
    }

    // The snapped "strong" lines between every consecutive pair of
    // reached dots, plus the closing segment back to dot 1 on completion.
    if (reached > 1) {
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.slice(0, reached).forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      if (complete) ctx.closePath();
      ctx.stroke();
    }

    // Dots and labels only while the puzzle is in progress - the finished
    // picture reads as a picture, not a worksheet.
    if (!complete) {
      ctx.font = '800 16px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      points.forEach(([x, y], i) => {
        ctx.fillStyle = i < reached ? LINE_COLOR : '#868e96';
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        const prev = points[(i - 1 + points.length) % points.length];
        const next = points[(i + 1) % points.length];
        const [dx, dy] = labelDirection(prev, [x, y], next);
        ctx.fillStyle = i === reached ? '#212529' : '#868e96';
        ctx.fillText(dotLabel(i, this.labels()), x + dx * LABEL_OFFSET, y + dy * LABEL_OFFSET);
      });
    }
  }

  private pointerPosition(event: PointerEvent): Point {
    const rect = this.inkCanvas().nativeElement.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  // The same pen does two jobs: joining dots until the picture is
  // finished, then colouring it in.
  onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.inkCanvas().nativeElement.setPointerCapture(event.pointerId);
    this.pushUndoSnapshot();
    this.drawing = true;
    [this.lastX, this.lastY] = this.pointerPosition(event);
    if (this.completed()) {
      // A tap leaves a blob of colour, like a real crayon would.
      this.paintSegment(this.lastX, this.lastY, event);
    } else {
      // A tap straight onto the next dot counts too.
      this.checkReached(this.lastX, this.lastY, this.lastX, this.lastY);
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing) return;
    event.preventDefault();
    const [x, y] = this.pointerPosition(event);

    if (this.completed()) {
      this.paintSegment(x, y, event);
    } else {
      const isPen = event.pointerType === 'pen';
      const ctx = this.inkCanvas().nativeElement.getContext('2d')!;
      ctx.strokeStyle = INK_COLOR;
      ctx.lineWidth = isPen ? Math.max(3, event.pressure * 10) : 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.lastX, this.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      this.checkReached(this.lastX, this.lastY, x, y);
    }
    this.lastX = x;
    this.lastY = y;
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.inkCanvas().nativeElement.releasePointerCapture(event.pointerId);
    this.fadeInk();
  }

  // One colouring segment straight onto the paint layer - a thick
  // crayon-ish line, kept exactly as drawn. Deliberately *not* clipped to
  // the outline: going over the lines is half the fun.
  private paintSegment(x: number, y: number, event: PointerEvent): void {
    const ctx = this.paintCanvas().nativeElement.getContext('2d')!;
    const isPen = event.pointerType === 'pen';
    const erasing = this.paintColour() === ERASER;
    // The eraser only ever touches the paint layer - outlines and the
    // faded joining ink live on other canvases, so they can't be rubbed
    // out by accident. destination-out clears wherever it "draws".
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = erasing ? '#000' : this.paintColour();
    // A bit wider than a crayon, so rubbing out is quick.
    const width = isPen ? Math.max(8, event.pressure * 28) : 20;
    ctx.lineWidth = erasing ? width * 1.5 : width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.lastX, this.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  protected togglePalette(): void {
    this.paletteOpen.update((open) => !open);
  }

  protected pickColour(value: string): void {
    this.paintColour.set(value);
  }

  // Advances past every next-in-order dot this pointer segment passed
  // over (a loop, so one sweeping stroke can join several). Out-of-order
  // dots are simply ignored - no error state.
  private checkReached(ax: number, ay: number, bx: number, by: number): void {
    const points = this.positions();
    let advanced = false;
    while (this.reached() < points.length) {
      const [px, py] = points[this.reached()];
      if (distanceToSegment(px, py, ax, ay, bx, by) > HIT_RADIUS) break;
      this.reached.update((n) => n + 1);
      advanced = true;
    }
    if (!advanced) return;

    this.fadeInk();
    this.draw();
    if (this.completed()) {
      // End the joining stroke here rather than letting the rest of it
      // carry on as colouring.
      this.drawing = false;
      // Fixed at 100 so Practice's existing >=80 celebration styling
      // applies, same as PictureFill.
      this._result.set({ coverage: 100, message: `You joined all the dots - it's ${DOTS[this.picture()].name}!` });
    }
  }

  private fadeInk(): void {
    const ink = this.inkCanvas().nativeElement;
    const faded = this.fadedInkCanvas().nativeElement.getContext('2d')!;
    // Copy device pixels 1:1 - temporarily drop the DPR transform.
    faded.save();
    faded.setTransform(1, 0, 0, 1, 0, 0);
    faded.drawImage(ink, 0, 0);
    faded.restore();
    ink.getContext('2d')!.clearRect(0, 0, this.width, PAGE_HEIGHT);
  }

  private snapshot(canvas: HTMLCanvasElement): ImageData {
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  }

  private pushUndoSnapshot(): void {
    const state: UndoState = {
      reached: this.reached(),
      fadedInk: this.snapshot(this.fadedInkCanvas().nativeElement),
      paint: this.snapshot(this.paintCanvas().nativeElement),
    };
    const stack = [...this.undoStack(), state];
    this.undoStack.set(stack.length > MAX_UNDO_STEPS ? stack.slice(-MAX_UNDO_STEPS) : stack);
  }

  clear(): void {
    this.reached.set(0);
    this._result.set(null);
    this.undoStack.set([]);
    this.paletteOpen.set(false);
    // Nothing's been drawn (or even sized) before the first layout.
    if (this.width === 0) return;
    for (const canvas of [this.inkCanvas, this.fadedInkCanvas, this.paintCanvas]) {
      canvas().nativeElement.getContext('2d')!.clearRect(0, 0, this.width, PAGE_HEIGHT);
    }
    this.draw();
  }

  undo(): void {
    const stack = this.undoStack();
    if (stack.length === 0) return;
    const previous = stack[stack.length - 1];
    this.undoStack.set(stack.slice(0, -1));
    // Unlike PictureFill, draw() never resizes the ink canvases, so
    // there's no restore-order hazard here.
    this.reached.set(previous.reached);
    // Undoing a colouring stroke leaves the picture finished (and its
    // message up); only undoing back past the last dot clears it.
    if (!this.completed()) {
      this._result.set(null);
      this.paletteOpen.set(false);
    }
    this.fadedInkCanvas().nativeElement.getContext('2d')!.putImageData(previous.fadedInk, 0, 0);
    this.paintCanvas().nativeElement.getContext('2d')!.putImageData(previous.paint, 0, 0);
    this.draw();
  }
}
