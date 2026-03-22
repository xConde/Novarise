const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class FocusTrap {
  private previouslyFocused: HTMLElement | null = null;
  private trapElement: HTMLElement | null = null;
  private boundHandler: ((e: KeyboardEvent) => void) | null = null;

  activate(element: HTMLElement): void {
    // Deactivate any existing trap to prevent listener leaks on double-activate
    if (this.boundHandler) {
      document.removeEventListener('keydown', this.boundHandler);
      this.boundHandler = null;
    }
    this.previouslyFocused = document.activeElement as HTMLElement;
    this.trapElement = element;

    const focusables = this.getFocusableElements();
    if (focusables.length > 0) {
      focusables[0].focus();
    }

    this.boundHandler = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.boundHandler);
  }

  deactivate(): void {
    if (this.boundHandler) {
      document.removeEventListener('keydown', this.boundHandler);
      this.boundHandler = null;
    }
    if (this.previouslyFocused) {
      this.previouslyFocused.focus();
      this.previouslyFocused = null;
    }
    this.trapElement = null;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !this.trapElement) return;

    const focusables = this.getFocusableElements();
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.trapElement) return [];
    return Array.from(this.trapElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }
}
