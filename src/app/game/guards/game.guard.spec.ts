import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, convertToParamMap } from '@angular/router';
import { EnvironmentInjector } from '@angular/core';
import { gameGuard, QUICK_PLAY_PARAM } from './game.guard';
import { MapBridgeService } from '../game-board/services/map-bridge.service';

describe('gameGuard', () => {
  let mapBridge: jasmine.SpyObj<MapBridgeService>;
  let router: jasmine.SpyObj<Router>;
  let injector: EnvironmentInjector;

  function createRoute(queryParams: Record<string, string> = {}): ActivatedRouteSnapshot {
    return { queryParamMap: convertToParamMap(queryParams) } as unknown as ActivatedRouteSnapshot;
  }

  function runGuard(route: ActivatedRouteSnapshot): boolean | UrlTree {
    return injector.runInContext(() =>
      gameGuard(route, {} as RouterStateSnapshot)
    ) as boolean | UrlTree;
  }

  beforeEach(() => {
    mapBridge = jasmine.createSpyObj('MapBridgeService', ['hasEditorMap']);
    router = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: MapBridgeService, useValue: mapBridge },
        { provide: Router, useValue: router }
      ]
    });

    injector = TestBed.inject(EnvironmentInjector);
  });

  it('should allow access when a map is loaded', () => {
    mapBridge.hasEditorMap.and.returnValue(true);
    expect(runGuard(createRoute())).toBe(true);
  });

  it('should redirect to /maps when no map is loaded', () => {
    mapBridge.hasEditorMap.and.returnValue(false);
    const mockUrlTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(mockUrlTree);

    const result = runGuard(createRoute());

    expect(result).toBe(mockUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/maps']);
  });

  it('should allow access with quickplay query param even without a map', () => {
    mapBridge.hasEditorMap.and.returnValue(false);
    const result = runGuard(createRoute({ [QUICK_PLAY_PARAM]: 'true' }));
    expect(result).toBe(true);
  });

  it('should redirect when quickplay param is not "true"', () => {
    mapBridge.hasEditorMap.and.returnValue(false);
    const mockUrlTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(mockUrlTree);

    const result = runGuard(createRoute({ [QUICK_PLAY_PARAM]: 'false' }));

    expect(result).toBe(mockUrlTree);
  });
});
