import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { MapBridgeService } from '../../core/services/map-bridge.service';

/** Query parameter that bypasses the map check for Quick Play (default board). */
export const QUICK_PLAY_PARAM = 'quickplay';

/**
 * Prevents navigating to /play without a valid map loaded.
 * Redirects to /maps (map select) when no editor map is available,
 * unless the ?quickplay=true query param is present (uses default board).
 */
export const gameGuard: CanActivateFn = (route: ActivatedRouteSnapshot): boolean | UrlTree => {
  const mapBridge = inject(MapBridgeService);
  const router = inject(Router);

  if (mapBridge.hasEditorMap()) {
    return true;
  }
  if (route.queryParamMap.get(QUICK_PLAY_PARAM) === 'true') {
    return true;
  }
  return router.createUrlTree(['/maps']);
};
