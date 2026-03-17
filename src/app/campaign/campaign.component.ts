import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CampaignLevel, CampaignLevelProgress, UnlockRequirement } from './models/campaign.model';
import { CampaignService } from './services/campaign.service';
import { CampaignMapService } from './services/campaign-map.service';
import { MapBridgeService } from '../game/game-board/services/map-bridge.service';
import { ChallengeDefinition } from './models/challenge.model';

export interface LevelViewModel {
  level: CampaignLevel;
  unlocked: boolean;
  completed: boolean;
  stars: boolean[];            // [true, true, false] = 2 stars
  progress: CampaignLevelProgress | null;
  challenges: ChallengeDefinition[];
  challengeCompletion: boolean[];  // parallel to challenges array
}

@Component({
  selector: 'app-campaign',
  templateUrl: './campaign.component.html',
  styleUrls: ['./campaign.component.scss'],
})
export class CampaignComponent implements OnInit {
  levels: CampaignLevel[] = [];
  levelViews: LevelViewModel[] = [];
  totalStars = 0;
  completedCount = 0;

  constructor(
    private campaignService: CampaignService,
    private campaignMapService: CampaignMapService,
    private mapBridge: MapBridgeService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.levels = this.campaignService.getAllLevels();
    this.totalStars = this.campaignService.getTotalStars();
    this.completedCount = this.campaignService.getCompletedCount();
    this.levelViews = this.levels.map(level => {
      const challenges = this.campaignService.getChallengesForLevel(level.id);
      return {
        level,
        unlocked: this.campaignService.isUnlocked(level.id),
        completed: this.campaignService.isCompleted(level.id),
        stars: this.getStarArray(level.id),
        progress: this.campaignService.getLevelProgress(level.id),
        challenges,
        challengeCompletion: challenges.map(c =>
          this.campaignService.isChallengeCompleted(c.id),
        ),
      };
    });
  }

  /** Returns an array of length 3 used to render filled/empty stars. */
  getStarArray(levelId: string): boolean[] {
    const progress = this.campaignService.getLevelProgress(levelId);
    const earned = progress?.bestStars ?? 0;
    return [earned >= 1, earned >= 2, earned >= 3];
  }

  // Kept for backward compatibility with existing tests
  isUnlocked(levelId: string): boolean {
    return this.campaignService.isUnlocked(levelId);
  }

  isCompleted(levelId: string): boolean {
    return this.campaignService.isCompleted(levelId);
  }

  getLevelProgress(levelId: string): CampaignLevelProgress | null {
    return this.campaignService.getLevelProgress(levelId);
  }

  getChallenges(levelId: string): ChallengeDefinition[] {
    return this.campaignService.getChallengesForLevel(levelId);
  }

  isChallengeCompleted(challengeId: string): boolean {
    return this.campaignService.isChallengeCompleted(challengeId);
  }

  get isCampaignComplete(): boolean {
    return this.completedCount === this.levels.length;
  }

  playLevel(level: CampaignLevel): void {
    if (!this.campaignService.isUnlocked(level.id)) return;
    const mapState = this.campaignMapService.loadLevel(level.id);
    if (!mapState) return;
    this.mapBridge.setEditorMapState(mapState, level.id);
    this.router.navigate(['/play']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  /**
   * Returns a human-readable unlock requirement string for a locked level card.
   * Returns empty string for the 'none' type (always unlocked).
   */
  getUnlockText(level: CampaignLevel): string {
    const req: UnlockRequirement = level.unlockRequirement;
    switch (req.type) {
      case 'level_complete': {
        const reqLevel = req.levelId ? this.campaignService.getLevel(req.levelId) : undefined;
        return reqLevel ? `Complete "${reqLevel.name}" first` : 'Complete previous level';
      }
      case 'stars_total': {
        const current = this.campaignService.getTotalStars();
        return `Earn ${req.starsRequired} stars (${current} earned)`;
      }
      default:
        return '';
    }
  }
}
