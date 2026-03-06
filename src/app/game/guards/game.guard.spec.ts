import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, convertToParamMap } from '@angular/router';
import { GameGuard } from './game.guard';
import { MapBridgeService } from '../game-board/services/map-bridge.service';

describe('GameGuard', () => {
  let guard: GameGuard;
  let mapBridge: jasmine.SpyObj<MapBridgeService>;
  let router: jasmine.SpyObj<Router>;

  function createRoute(queryParams: Record<string, string> = {}): ActivatedRouteSnapshot {
    return { queryParamMap: convertToParamMap(queryParams) } as unknown as ActivatedRouteSnapshot;
  }

  beforeEach(() => {
    mapBridge = jasmine.createSpyObj('MapBridgeService', ['hasEditorMap']);
    router = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        GameGuard,
        { provide: MapBridgeService, useValue: mapBridge },
        { provide: Router, useValue: router }
      ]
    });

    guard = TestBed.inject(GameGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should allow access when a map is loaded', () => {
    mapBridge.hasEditorMap.and.returnValue(true);
    expect(guard.canActivate(createRoute())).toBe(true);
  });

  it('should redirect to /maps when no map is loaded', () => {
    mapBridge.hasEditorMap.and.returnValue(false);
    const mockUrlTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(mockUrlTree);

    const result = guard.canActivate(createRoute());

    expect(result).toBe(mockUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/maps']);
  });

  it('should allow access with quickplay query param even without a map', () => {
    mapBridge.hasEditorMap.and.returnValue(false);
    const result = guard.canActivate(createRoute({ quickplay: 'true' }));
    expect(result).toBe(true);
  });

  it('should redirect when quickplay param is not "true"', () => {
    mapBridge.hasEditorMap.and.returnValue(false);
    const mockUrlTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(mockUrlTree);

    const result = guard.canActivate(createRoute({ quickplay: 'false' }));

    expect(result).toBe(mockUrlTree);
  });
});
