import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { MapBridgeService } from '../game-board/services/map-bridge.service';

/** Query parameter that bypasses the map check for Quick Play (default board). */
export const QUICK_PLAY_PARAM = 'quickplay';

/**
 * Prevents navigating to /play without a valid map loaded.
 * Redirects to /maps (map select) when no editor map is available,
 * unless the ?quickplay=true query param is present (uses default board).
 */
@Injectable({
  providedIn: 'root'
})
export class GameGuard implements CanActivate {
  constructor(
    private mapBridge: MapBridgeService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (this.mapBridge.hasEditorMap()) {
      return true;
    }
    if (route.queryParamMap.get(QUICK_PLAY_PARAM) === 'true') {
      return true;
    }
    return this.router.createUrlTree(['/maps']);
  }
}
