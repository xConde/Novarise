import { Component, Input, Output, EventEmitter } from '@angular/core';
import { GamePhase, GameState } from '../../models/game-state.model';
import { ScoreBreakdown } from '../../models/score.model';
import { Achievement } from '../../services/player-profile.service';

@Component({
  selector: 'app-game-results',
  templateUrl: './game-results.component.html',
  styleUrls: ['./game-results.component.scss']
})
export class GameResultsComponent {
  @Input() gameState!: GameState;
  @Input() scoreBreakdown: ScoreBreakdown | null = null;
  @Input() starArray: Array<'filled' | 'empty'> = [];
  @Input() newlyUnlockedAchievements: string[] = [];
  @Input() achievementDetails: Achievement[] = [];

  @Output() restart = new EventEmitter<void>();
  @Output() goToEditor = new EventEmitter<void>();

  readonly GamePhase = GamePhase;
}
