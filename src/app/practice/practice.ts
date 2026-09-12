import { Component, computed, input, output, signal, viewChild } from '@angular/core';
import { ShapeKind, TraceLine } from '../trace-line/trace-line';
import { Workbook } from '../workbook';

@Component({
  selector: 'app-practice',
  imports: [TraceLine],
  templateUrl: './practice.html',
  styleUrl: './practice.css',
})
export class Practice {
  readonly workbook = input.required<Workbook>();
  readonly cursive = input.required<boolean>();

  readonly cursiveChange = output<boolean>();
  readonly back = output<void>();

  protected readonly index = signal(0);

  protected readonly item = computed(() => this.workbook().items[this.index()]);
  protected readonly canGoPrevious = computed(() => this.index() > 0);
  protected readonly canGoNext = computed(() => this.index() < this.workbook().items.length - 1);

  // Narrowed views of `item()` for TraceLine's inputs - a single local
  // read of item() lets TypeScript narrow `.value`'s type per branch,
  // which two separate `item()` calls in the template can't do (both
  // variants share a `value` property, so without narrowing its type is
  // `string | ShapeKind`, satisfying neither `text` nor `shape`).
  protected readonly textValue = computed(() => {
    const current = this.item();
    return current.kind === 'text' ? current.value : '';
  });
  protected readonly shapeValue = computed<ShapeKind | null>(() => {
    const current = this.item();
    return current.kind === 'shape' ? current.value : null;
  });

  // Singularized, capitalized form of the workbook's plural itemLabel
  // ("words" -> "Word") for the "Word X of Y" progress line.
  protected readonly itemLabel = computed(() => {
    const plural = this.workbook().itemLabel;
    const singular = plural.replace(/s$/, '');
    return singular.charAt(0).toUpperCase() + singular.slice(1);
  });

  private readonly traceLine = viewChild.required(TraceLine);

  // TraceLine recomputes this itself after each stroke - no Check button,
  // no reset-on-navigate wiring needed here, just read it reactively.
  protected readonly feedback = computed(() => this.traceLine().result());

  previous(): void {
    if (this.canGoPrevious()) this.index.update((i) => i - 1);
  }

  next(): void {
    if (this.canGoNext()) this.index.update((i) => i + 1);
  }

  clear(): void {
    this.traceLine().clear();
  }
}
