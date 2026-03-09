import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DifficultyLevel, DIFFICULTY_PRESETS, GameState } from '../../models/game-state.model';
import { GameModifier, GAME_MODIFIER_CONFIGS } from '../../models/game-modifier.model';

@Component({
  selector: 'app-game-setup',
  templateUrl: './game-setup.component.html',
  styleUrls: ['./game-setup.component.scss']
})
export class GameSetupComponent {
  @Input() gameState!: GameState;
  @Input() activeModifiers = new Set<GameModifier>();
  @Input() modifierScoreMultiplier = 1.0;

  @Output() selectDifficulty = new EventEmitter<DifficultyLevel>();
  @Output() toggleModifier = new EventEmitter<GameModifier>();
  @Output() toggleEndless = new EventEmitter<void>();
  @Output() startGame = new EventEmitter<void>();

  readonly difficultyLevels = Object.values(DifficultyLevel);
  readonly difficultyPresets = DIFFICULTY_PRESETS;
  readonly modifierConfigs = GAME_MODIFIER_CONFIGS;
  readonly allModifiers = Object.values(GameModifier);
}
