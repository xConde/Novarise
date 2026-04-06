import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { TowerPlacementService } from './tower-placement.service';
import { SceneService } from './scene.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TowerPreviewService } from './tower-preview.service';
import { TilePricingService } from './tile-pricing.service';
import { TowerType } from '../models/tower.model';
import { INITIAL_GAME_STATE } from '../models/game-state.model';
import { createSceneServiceSpy, createGameBoardServiceSpy, createGameStateServiceSpy } from '../testing';

describe('TowerPlacementService', () => {
  let service: TowerPlacementService;
  let sceneSpy: jasmine.SpyObj<SceneService>;
  let gameBoardSpy: jasmine.SpyObj<GameBoardService>;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let towerPreviewSpy: jasmine.SpyObj<TowerPreviewService>;
  let tilePricingSpy: jasmine.SpyObj<TilePricingService>;

  beforeEach(() => {
    sceneSpy = createSceneServiceSpy();
    gameBoardSpy = createGameBoardServiceSpy();
    gameStateSpy = createGameStateServiceSpy();
    towerPreviewSpy = jasmine.createSpyObj<TowerPreviewService>('TowerPreviewService', [
      'showPreview', 'hidePreview', 'cleanup', 'setBoardSize',
    ]);
    tilePricingSpy = jasmine.createSpyObj<TilePricingService>('TilePricingService', [
      'getTilePrice', 'getStrategicValue', 'invalidateCache',
    ]);
    tilePricingSpy.getTilePrice.and.returnValue({ cost: 50, percentIncrease: 0, strategicMultiplier: 0, tier: 'base', isPremium: false });

    TestBed.configureTestingModule({
      providers: [
        TowerPlacementService,
        { provide: SceneService, useValue: sceneSpy },
        { provide: GameBoardService, useValue: gameBoardSpy },
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: TowerPreviewService, useValue: towerPreviewSpy },
        { provide: TilePricingService, useValue: tilePricingSpy },
      ],
    });

    service = TestBed.inject(TowerPlacementService);
  });

  afterEach(() => {
    // Clean up any lingering global listeners
    service.removeDragListeners();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isDragging should be false by default', () => {
    expect(service.isDragging).toBeFalse();
  });

  describe('init', () => {
    it('should store raycaster, mouse and callbacks', () => {
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const tileMeshArrayRef = () => [] as THREE.Mesh[];
      const onEnterPlaceMode = jasmine.createSpy('onEnterPlaceMode');
      const onPlaceAttempt = jasmine.createSpy('onPlaceAttempt');
      const onDeselectTower = jasmine.createSpy('onDeselectTower');

      service.init(raycaster, mouse, tileMeshArrayRef, {
        onEnterPlaceMode,
        onPlaceAttempt,
        onDeselectTower,
      });

      expect(service['raycaster']).toBe(raycaster);
      expect(service['mouse']).toBe(mouse);
      expect(service.onEnterPlaceMode).toBe(onEnterPlaceMode);
      expect(service.onPlaceAttempt).toBe(onPlaceAttempt);
      expect(service.onDeselectTower).toBe(onDeselectTower);
    });
  });

  describe('onTowerDragStart', () => {
    it('should ignore non-left mouse button events', () => {
      const event = new MouseEvent('mousedown', { button: 2 });
      service.onTowerDragStart(event, TowerType.BASIC);
      expect(service['dragTowerType']).toBeNull();
    });

    it('should set dragTowerType on valid mousedown', () => {
      const event = new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 200 });
      service.onTowerDragStart(event, TowerType.SNIPER);
      expect(service['dragTowerType']).toBe(TowerType.SNIPER);
      expect(service['dragStartX']).toBe(100);
      expect(service['dragStartY']).toBe(200);
      expect(service.isDragging).toBeFalse();
    });

    it('should register global mousemove and mouseup listeners', () => {
      spyOn(window, 'addEventListener');
      const event = new MouseEvent('mousedown', { button: 0 });
      service.onTowerDragStart(event, TowerType.BASIC);
      expect(window.addEventListener).toHaveBeenCalledWith('mousemove', jasmine.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('mouseup', jasmine.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('blur', jasmine.any(Function));
    });
  });

  describe('cancelDrag', () => {
    it('should reset isDragging and dragTowerType', () => {
      service['dragTowerType'] = TowerType.BASIC;
      service.isDragging = true;
      service['dragThresholdMet'] = true;

      service.cancelDrag();

      expect(service.isDragging).toBeFalse();
      expect(service['dragTowerType']).toBeNull();
      expect(service['dragThresholdMet']).toBeFalse();
    });

    it('should call towerPreviewService.hidePreview when scene is available', () => {
      const fakeScene = {} as THREE.Scene;
      sceneSpy.getScene.and.returnValue(fakeScene);
      service['dragTowerType'] = TowerType.BASIC;

      service.cancelDrag();

      expect(towerPreviewSpy.hidePreview).toHaveBeenCalledWith(fakeScene);
    });
  });

  describe('removeDragListeners', () => {
    it('should remove mousemove and mouseup listeners for mouse drags', () => {
      spyOn(window, 'removeEventListener');
      service['dragIsTouch'] = false;

      service.removeDragListeners();

      expect(window.removeEventListener).toHaveBeenCalledWith('mousemove', jasmine.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('mouseup', jasmine.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('blur', jasmine.any(Function));
    });

    it('should remove touchmove and touchend listeners for touch drags', () => {
      spyOn(window, 'removeEventListener');
      service['dragIsTouch'] = true;

      service.removeDragListeners();

      expect(window.removeEventListener).toHaveBeenCalledWith('touchmove', jasmine.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('touchend', jasmine.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('blur', jasmine.any(Function));
    });
  });

  describe('INITIAL_GAME_STATE reference', () => {
    it('INITIAL_GAME_STATE should have wave 0', () => {
      expect(INITIAL_GAME_STATE.wave).toBe(0);
    });
  });
});
