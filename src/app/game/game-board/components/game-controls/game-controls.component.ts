import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GamePhase } from '../../models/game-state.model';

@Component({
  selector: 'app-game-controls',
  templateUrl: './game-controls.component.html',
  styleUrls: ['./game-controls.component.scss']
})
export class GameControlsComponent {
  @Input() phase!: GamePhase;
  @Input() isPaused = false;
  @Input() gameSpeed = 1;
  @Input() showAllRanges = false;
  @Input() showPathOverlay = false;

  @Output() startWave = new EventEmitter<void>();
  @Output() togglePause = new EventEmitter<void>();
  @Output() setSpeed = new EventEmitter<number>();
  @Output() toggleAllRanges = new EventEmitter<void>();
  @Output() togglePathOverlay = new EventEmitter<void>();

  readonly GamePhase = GamePhase;
  readonly speeds = [1, 2, 3];
}
