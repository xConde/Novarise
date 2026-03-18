import { Component, Input, Output, EventEmitter, ViewEncapsulation } from '@angular/core';
import { DifficultyLevel, DIFFICULTY_PRESETS } from '../../models/game-state.model';
import { GameModifier, GameModifierConfig } from '../../models/game-modifier.model';
import { CampaignLevel } from '../../../../campaign/models/campaign.model';
import { ChallengeDefinition } from '../../../../campaign/models/challenge.model';

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
  @Input() isCampaignGame = false;
  @Input() currentCampaignLevel: CampaignLevel | null = null;
  @Input() campaignChallenges: ChallengeDefinition[] = [];
  @Input() isEndless = false;
  @Input() isChallengeAlreadyCompletedFn: (id: string) => boolean = () => false;

  @Output() selectDifficulty = new EventEmitter<DifficultyLevel>();
  @Output() toggleModifier = new EventEmitter<GameModifier>();
  @Output() toggleEndless = new EventEmitter<void>();
  @Output() startGame = new EventEmitter<void>();
}
