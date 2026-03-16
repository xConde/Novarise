import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CampaignLevel, CampaignLevelProgress } from './models/campaign.model';
import { CampaignService } from './services/campaign.service';
import { CampaignMapService } from './services/campaign-map.service';
import { MapBridgeService } from '../game/game-board/services/map-bridge.service';

@Component({
  selector: 'app-campaign',
  templateUrl: './campaign.component.html',
  styleUrls: ['./campaign.component.scss'],
})
export class CampaignComponent implements OnInit {
  levels: CampaignLevel[] = [];
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
  }

  isUnlocked(levelId: string): boolean {
    return this.campaignService.isUnlocked(levelId);
  }

  isCompleted(levelId: string): boolean {
    return this.campaignService.isCompleted(levelId);
  }

  getLevelProgress(levelId: string): CampaignLevelProgress | null {
    return this.campaignService.getLevelProgress(levelId);
  }

  /** Returns an array of length 3 used to render filled/empty stars. */
  getStarArray(levelId: string): boolean[] {
    const progress = this.getLevelProgress(levelId);
    const earned = progress?.bestStars ?? 0;
    return [earned >= 1, earned >= 2, earned >= 3];
  }

  playLevel(level: CampaignLevel): void {
    if (!this.isUnlocked(level.id)) return;
    const mapState = this.campaignMapService.loadLevel(level.id);
    if (!mapState) return;
    this.mapBridge.setEditorMapState(mapState, level.id);
    this.router.navigate(['/play']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
