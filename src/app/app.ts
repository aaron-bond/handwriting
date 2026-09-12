import { Component, effect, signal, viewChild } from '@angular/core';
import { Home } from './home/home';
import { Practice } from './practice/practice';
import { TraceLine, TracingResult } from './trace-line/trace-line';
import { CUSTOM_COLOR, Workbook } from './workbook';

type Screen = 'home' | 'custom' | 'workbook';

@Component({
  imports: [Home, Practice, TraceLine],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly screen = signal<Screen>('home');
  // Only meaningful while screen() === 'workbook' - kept as its own signal
  // (rather than folded into a discriminated union on `screen`) so the
  // template can read it without needing type-narrowing across two calls.
  protected readonly activeWorkbook = signal<Workbook | null>(null);

  // A shared preference, not reset when navigating between screens.
  protected readonly cursive = signal(false);

  // State for the 'custom' screen only.
  protected readonly word = signal('hello');
  protected readonly feedback = signal<TracingResult | null>(null);
  protected readonly customColor = CUSTOM_COLOR;

  private readonly traceLine = viewChild(TraceLine);

  constructor() {
    // A previous check result describes the old word/style, not the new one.
    effect(() => {
      this.word();
      this.cursive();
      this.feedback.set(null);
    });
  }

  openWorkbook(workbook: Workbook): void {
    this.activeWorkbook.set(workbook);
    this.screen.set('workbook');
  }

  openCustom(): void {
    this.screen.set('custom');
  }

  goHome(): void {
    this.screen.set('home');
  }

  clear(): void {
    this.traceLine()?.clear();
    this.feedback.set(null);
  }

  check(): void {
    const traceLine = this.traceLine();
    if (traceLine) this.feedback.set(traceLine.checkTracing());
  }
}
