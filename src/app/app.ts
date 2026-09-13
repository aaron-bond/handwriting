import { Component, computed, signal, viewChild } from '@angular/core';
import { Home } from './home/home';
import { Practice } from './practice/practice';
import { TraceLine } from './trace-line/trace-line';
import { CUSTOM_COLOR, Workbook } from './workbook';

type Screen = 'home' | 'custom' | 'workbook';

// Not a standard DOM type (Chrome/Edge-only, no Firefox/Safari support) -
// TypeScript's lib.dom doesn't declare it.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

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
  protected readonly customColor = CUSTOM_COLOR;

  private readonly traceLine = viewChild(TraceLine);

  // TraceLine recomputes this itself after each stroke - no Check button,
  // no reset-on-navigate wiring needed here, just read it reactively.
  protected readonly feedback = computed(() => this.traceLine()?.result() ?? null);
  protected readonly canUndo = computed(() => this.traceLine()?.canUndo() ?? false);

  // Chrome/Edge fire this exactly when *they've* decided the app meets
  // every install criterion (valid manifest, active service worker, not
  // already installed, ...) - so its mere presence here already is the
  // "would this actually work" check the install button's visibility
  // relies on, no separate probing needed. Firefox/Safari never fire it,
  // so the button simply never appears there - visitors on those fall
  // back to sharing the URL/manual "Add to Home Screen" as before.
  private readonly deferredInstallPrompt = signal<BeforeInstallPromptEvent | null>(null);
  protected readonly canInstall = computed(() => this.deferredInstallPrompt() !== null);

  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredInstallPrompt.set(event as BeforeInstallPromptEvent);
    });
    // Covers install via the browser's own UI rather than our button.
    window.addEventListener('appinstalled', () => this.deferredInstallPrompt.set(null));
  }

  async install(): Promise<void> {
    const promptEvent = this.deferredInstallPrompt();
    if (!promptEvent) return;
    // A given prompt event can only be used once, whichever way the user
    // answers - hide the button now rather than waiting on userChoice.
    this.deferredInstallPrompt.set(null);
    await promptEvent.prompt();
    await promptEvent.userChoice;
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
  }

  undo(): void {
    this.traceLine()?.undo();
  }
}
