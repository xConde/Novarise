import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MapBridgeService } from '../game/game-board/services/map-bridge.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  constructor(
    private router: Router,
    private mapBridge: MapBridgeService
  ) {}

  goToEditor(): void {
    this.router.navigate(['/edit']);
  }

  goToMapSelect(): void {
    this.router.navigate(['/maps']);
  }

  quickPlay(): void {
    this.mapBridge.clearEditorMap();
    this.router.navigate(['/play'], { queryParams: { quickplay: 'true' } });
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }
}
