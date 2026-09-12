import { Component, signal, viewChild } from '@angular/core';
import { TraceLine } from './trace-line/trace-line';

@Component({
  imports: [TraceLine],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly word = signal('hello');

  private readonly traceLine = viewChild.required(TraceLine);

  clear(): void {
    this.traceLine().clear();
  }
}
