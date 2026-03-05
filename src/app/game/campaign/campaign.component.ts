import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CampaignService, CampaignLevel } from './campaign.service';
import { MapBridgeService } from '../game-board/services/map-bridge.service';

@Component({
  selector: 'app-campaign',
  templateUrl: './campaign.component.html',
  styleUrls: ['./campaign.component.scss']
})
export class CampaignComponent implements OnInit {
  levels: CampaignLevel[] = [];
  private starsSnapshot: Record<number, number> = {};
  private bestScoresSnapshot: Record<number, number> = {};

  constructor(
    private campaignService: CampaignService,
    private mapBridge: MapBridgeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.levels = this.campaignService.getLevels();
    this.refreshProgress();
  }

  isUnlocked(levelId: number): boolean {
    return this.campaignService.isLevelUnlocked(levelId);
  }

  getStars(levelId: number): number {
    return this.starsSnapshot[levelId] ?? 0;
  }

  getBestScore(levelId: number): number {
    return this.bestScoresSnapshot[levelId] ?? 0;
  }

  playLevel(level: CampaignLevel): void {
    if (!this.campaignService.isLevelUnlocked(level.id)) {
      return;
    }
    const map = this.campaignService.getMapForLevel(level.id);
    if (!map) {
      return;
    }
    this.mapBridge.setEditorMapState(map);
    this.mapBridge.setDifficulty(level.difficulty);
    this.mapBridge.setCampaignLevelId(level.id);
    this.router.navigate(['/play']);
  }

  goBack(): void {
    this.router.navigate(['/edit']);
  }

  goToMaps(): void {
    this.router.navigate(['/maps']);
  }

  resetProgress(): void {
    const confirmed = window.confirm(
      'Reset all campaign progress? This cannot be undone.'
    );
    if (confirmed) {
      this.campaignService.resetProgress();
      this.refreshProgress();
    }
  }

  /** Capture a snapshot of progress so template reads are stable per cycle. */
  private refreshProgress(): void {
    const progress = this.campaignService.getProgress();
    this.starsSnapshot = progress.stars;
    this.bestScoresSnapshot = progress.bestScores;
  }

  /** Helper to produce [1, 2, 3] for star rendering — avoids inline array literals in template. */
  readonly starIndices = [1, 2, 3];
}
