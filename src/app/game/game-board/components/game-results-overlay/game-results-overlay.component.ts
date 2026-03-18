import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { Achievement } from '../../services/player-profile.service';
import { ScoreBreakdown } from '../../models/score.model';
import { CampaignLevel } from '../../../../campaign/models/campaign.model';
import { ChallengeDefinition } from '../../../../campaign/models/challenge.model';

@Component({
  selector: 'app-game-results-overlay',
  templateUrl: './game-results-overlay.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class GameResultsOverlayComponent {
  @Input() isVictory = false;
  @Input() scoreBreakdown: ScoreBreakdown | null = null;
  @Input() starArray: Array<'filled' | 'empty'> = [];
  @Input() gameScore = 0;
  @Input() maxWaves = 0;
  @Input() isCampaignGame = false;
  @Input() currentCampaignLevel: CampaignLevel | null = null;
  @Input() campaignChallenges: ChallengeDefinition[] = [];
  @Input() completedChallenges: ChallengeDefinition[] = [];
  @Input() achievementDetails: Achievement[] = [];
  @Input() newlyUnlockedCount = 0;
  @Input() isNextLevelUnlocked = false;
  @Input() nextLevelName = '';
  @Input() isChallengeCompletedFn: (challenge: ChallengeDefinition) => boolean = () => false;

  @Output() restart = new EventEmitter<void>();
  @Output() backToCampaign = new EventEmitter<void>();
  @Output() editMap = new EventEmitter<void>();
  @Output() playNextLevel = new EventEmitter<void>();
}
