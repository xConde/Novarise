import { Component, Input, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { DifficultyLevel, DIFFICULTY_PRESETS } from '../../models/game-state.model';
import { DIFFICULTY_SCORE_MULTIPLIER } from '../../models/score.model';
import { GameModifier, GameModifierConfig } from '../../models/game-modifier.model';

@Component({
  selector: 'app-game-setup-panel',
  templateUrl: './game-setup-panel.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class GameSetupPanelComponent {
  @Input() difficulty: DifficultyLevel = DifficultyLevel.NORMAL;
  @Input() difficultyLevels: DifficultyLevel[] = [];
  @Input() difficultyPresets = DIFFICULTY_PRESETS;
  @Input() modifierConfigs: Record<string, GameModifierConfig> = {};
  @Input() allModifiers: GameModifier[] = [];
  @Input() activeModifiers = new Set<GameModifier>();
  @Input() modifierScoreMultiplier = 1.0;
  @Input() isEndless = false;

  modifiersExpanded = false;

  @Output() selectDifficulty = new EventEmitter<DifficultyLevel>();
  @Output() toggleModifier = new EventEmitter<GameModifier>();
  @Output() toggleEndless = new EventEmitter<void>();
  @Output() startGame = new EventEmitter<void>();

  getDifficultyInfo(level: DifficultyLevel): string {
    const preset = this.difficultyPresets[level];
    const multiplier = DIFFICULTY_SCORE_MULTIPLIER[level];
    return `${preset.lives} lives · ${preset.gold}g · ${multiplier.toFixed(1)}× score`;
  }
}
