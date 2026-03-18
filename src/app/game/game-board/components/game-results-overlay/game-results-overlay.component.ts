import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { Achievement } from '../../services/player-profile.service';
import { ScoreBreakdown } from '../../models/score.model';
import { CampaignLevel } from '../../../../campaign/models/campaign.model';
import { ChallengeDefinition } from '../../../../campaign/models/challenge.model';
import { FocusTrap } from '../../../../shared/utils/focus-trap.util';

@Component({
  selector: 'app-game-results-overlay',
  templateUrl: './game-results-overlay.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class GameResultsOverlayComponent implements OnInit, OnDestroy {
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

  private readonly focusTrap = new FocusTrap();

  constructor(private readonly elementRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.focusTrap.activate(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.focusTrap.deactivate();
  }
}
