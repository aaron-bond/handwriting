import { Component, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { TraceLine } from '../trace-line/trace-line';
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
  protected readonly feedback = signal<string | null>(null);

  protected readonly word = computed(() => this.workbook().words[this.index()]);
  protected readonly canGoPrevious = computed(() => this.index() > 0);
  protected readonly canGoNext = computed(() => this.index() < this.workbook().words.length - 1);

  private readonly traceLine = viewChild.required(TraceLine);

  constructor() {
    // A previous check result describes the old word/style, not the new one.
    effect(() => {
      this.index();
      this.cursive();
      this.feedback.set(null);
    });
  }

  previous(): void {
    if (this.canGoPrevious()) this.index.update((i) => i - 1);
  }

  next(): void {
    if (this.canGoNext()) this.index.update((i) => i + 1);
  }

  clear(): void {
    this.traceLine().clear();
    this.feedback.set(null);
  }

  check(): void {
    this.feedback.set(this.traceLine().checkTracing());
  }
}
