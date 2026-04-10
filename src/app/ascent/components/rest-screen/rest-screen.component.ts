import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-rest-screen',
  templateUrl: './rest-screen.component.html',
  styleUrls: ['./rest-screen.component.scss'],
})
export class RestScreenComponent {
  @Input() currentLives!: number;
  @Input() maxLives!: number;
  @Input() healAmount!: number;
  @Output() restChosen = new EventEmitter<void>();
  @Output() skipChosen = new EventEmitter<void>();

  get livesAfterHeal(): number {
    return Math.min(this.maxLives, this.currentLives + this.healAmount);
  }

  get actualHeal(): number {
    return this.livesAfterHeal - this.currentLives;
  }

  get atFullHealth(): boolean {
    return this.currentLives >= this.maxLives;
  }

  rest(): void {
    this.restChosen.emit();
  }

  skip(): void {
    this.skipChosen.emit();
  }
}
