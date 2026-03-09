import { Component, Input } from '@angular/core';
import { GamePhase, GameState } from '../../models/game-state.model';

@Component({
  selector: 'app-game-hud',
  templateUrl: './game-hud.component.html',
  styleUrls: ['./game-hud.component.scss']
})
export class GameHUDComponent {
  @Input() gameState!: GameState;
  @Input() formattedTime = '00:00';
  @Input() enemiesAlive = 0;
  @Input() enemiesToSpawn = 0;
  @Input() pathBlocked = false;

  readonly GamePhase = GamePhase;
}
