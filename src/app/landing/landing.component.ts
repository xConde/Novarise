import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MapBridgeService } from '../core/services/map-bridge.service';
import { QUICK_PLAY_PARAM } from '../game/guards/game.guard';
import { CampaignService } from '../campaign/services/campaign.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit {
  campaignProgress = 0;
  campaignTotal = 0;

  constructor(
    private router: Router,
    private mapBridge: MapBridgeService,
    private campaignService: CampaignService
  ) {}

  ngOnInit(): void {
    this.campaignTotal = this.campaignService.getAllLevels().length;
    this.campaignProgress = this.campaignService.getCompletedCount();
  }

  goToEditor(): void {
    this.router.navigate(['/edit']);
  }

  goToMapSelect(): void {
    this.router.navigate(['/maps']);
  }

  quickPlay(): void {
    this.mapBridge.clearEditorMap();
    this.router.navigate(['/play'], { queryParams: { [QUICK_PLAY_PARAM]: 'true' } });
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  goToCampaign(): void {
    this.router.navigate(['/campaign']);
  }
}
