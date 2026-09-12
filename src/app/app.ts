import { Component, effect, signal, viewChild } from '@angular/core';
import { TraceLine } from './trace-line/trace-line';

@Component({
  imports: [TraceLine],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly word = signal('hello');
  protected readonly cursive = signal(false);
  protected readonly feedback = signal<string | null>(null);

  private readonly traceLine = viewChild.required(TraceLine);

  constructor() {
    // A previous check result describes the old word/style, not the new one.
    effect(() => {
      this.word();
      this.cursive();
      this.feedback.set(null);
    });
  }

  clear(): void {
    this.traceLine().clear();
    this.feedback.set(null);
  }

  check(): void {
    this.feedback.set(this.traceLine().checkTracing());
  }
}
