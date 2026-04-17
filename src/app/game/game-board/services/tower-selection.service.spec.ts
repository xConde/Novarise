import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';

import { TowerSelectionService } from './tower-selection.service';
import { TowerCombatService } from './tower-combat.service';
import { GameStateService } from './game-state.service';
import { RangeVisualizationService } from './range-visualization.service';
import { GameBoardService } from '../game-board.service';
import { SceneService } from './scene.service';
import { RelicService } from '../../../run/services/relic.service';
import { TowerType, PlacedTower, TargetingMode } from '../models/tower.model';
import { INITIAL_GAME_STATE } from '../models/game-state.model';
import {
  createGameBoardServiceSpy,
  createGameStateServiceSpy,
  createRelicServiceSpy,
  createSceneServiceSpy,
  createTowerCombatServiceSpy,
} from '../testing';

function createMockTower(overrides: Partial<PlacedTower> = {}): PlacedTower {
  return {
    id: 'tower-0-0',
    type: TowerType.BASIC,
    level: 1,
    row: 0,
    col: 0,
    kills: 0,
    totalInvested: 100,
    mesh: null as unknown as THREE.Group,
    targetingMode: TargetingMode.NEAREST,
    specialization: undefined,
    ...overrides,
  };
}

describe('TowerSelectionService', () => {
  let service: TowerSelectionService;
  let towerCombatSpy: jasmine.SpyObj<TowerCombatService>;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let rangeVisSpy: jasmine.SpyObj<RangeVisualizationService>;
  let gameBoardSpy: jasmine.SpyObj<GameBoardService>;
  let sceneSpy: jasmine.SpyObj<SceneService>;
  let relicSpy: jasmine.SpyObj<RelicService>;

  beforeEach(() => {
    towerCombatSpy = createTowerCombatServiceSpy();
    gameStateSpy = createGameStateServiceSpy();
    rangeVisSpy = jasmine.createSpyObj<RangeVisualizationService>('RangeVisualizationService', [
      'showForTower', 'removePreview', 'cleanup', 'toggleAllRanges',
    ]);
    gameBoardSpy = createGameBoardServiceSpy();
    sceneSpy = createSceneServiceSpy();
    relicSpy = createRelicServiceSpy();

    TestBed.configureTestingModule({
      providers: [
        TowerSelectionService,
        { provide: TowerCombatService, useValue: towerCombatSpy },
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: RangeVisualizationService, useValue: rangeVisSpy },
        { provide: GameBoardService, useValue: gameBoardSpy },
        { provide: SceneService, useValue: sceneSpy },
        { provide: RelicService, useValue: relicSpy },
      ],
    });

    service = TestBed.inject(TowerSelectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have null selectedTowerInfo by default', () => {
    expect(service.selectedTowerInfo).toBeNull();
  });

  it('should have false sellConfirmPending by default', () => {
    expect(service.sellConfirmPending).toBeFalse();
  });

  it('should have false showSpecializationChoice by default', () => {
    expect(service.showSpecializationChoice).toBeFalse();
  });

  describe('selectPlacedTower', () => {
    it('should deselect when clicking the same tower again', () => {
      const tower = createMockTower();
      towerCombatSpy.getTower.and.returnValue(tower);
      const cancelPlacement = jasmine.createSpy('cancelPlacement');

      service.selectPlacedTower('tower-0-0', cancelPlacement);
      expect(service.selectedTowerInfo).toBe(tower);

      // Second click on same tower
      service.selectPlacedTower('tower-0-0', cancelPlacement);
      expect(service.selectedTowerInfo).toBeNull();
    });

    it('should set selectedTowerInfo when tower is found', () => {
      const tower = createMockTower();
      towerCombatSpy.getTower.and.returnValue(tower);
      const cancelPlacement = jasmine.createSpy('cancelPlacement');

      service.selectPlacedTower('tower-0-0', cancelPlacement);

      expect(service.selectedTowerInfo).toBe(tower);
      expect(cancelPlacement).toHaveBeenCalled();
    });

    it('should not set selectedTowerInfo when tower is not found', () => {
      towerCombatSpy.getTower.and.returnValue(undefined);
      const cancelPlacement = jasmine.createSpy('cancelPlacement');

      service.selectPlacedTower('nonexistent', cancelPlacement);

      expect(service.selectedTowerInfo).toBeNull();
      expect(cancelPlacement).not.toHaveBeenCalled();
    });

    it('should call rangeVisualizationService.showForTower', () => {
      const tower = createMockTower();
      towerCombatSpy.getTower.and.returnValue(tower);

      service.selectPlacedTower('tower-0-0', () => {});

      expect(rangeVisSpy.showForTower).toHaveBeenCalled();
    });
  });

  describe('deselectTower', () => {
    it('should clear all selection state', () => {
      const tower = createMockTower();
      towerCombatSpy.getTower.and.returnValue(tower);
      service.selectPlacedTower('tower-0-0', () => {});
      service.sellConfirmPending = true;
      service.showSpecializationChoice = true;

      service.deselectTower();

      expect(service.selectedTowerInfo).toBeNull();
      expect(service.selectedTowerStats).toBeNull();
      expect(service.upgradePreview).toBeNull();
      expect(service.sellConfirmPending).toBeFalse();
      expect(service.showSpecializationChoice).toBeFalse();
      expect(service.specOptions).toEqual([]);
    });

    it('should call rangeVisualizationService.removePreview', () => {
      service.deselectTower();
      expect(rangeVisSpy.removePreview).toHaveBeenCalled();
    });
  });

  describe('refreshTowerInfoPanel', () => {
    it('should be a no-op when no tower is selected', () => {
      service.refreshTowerInfoPanel();
      expect(service.selectedTowerStats).toBeNull();
    });

    it('should populate selectedTowerStats for a selected tower', () => {
      const tower = createMockTower({ type: TowerType.SNIPER, level: 1 });
      service.selectedTowerInfo = tower;

      service.refreshTowerInfoPanel();

      expect(service.selectedTowerStats).not.toBeNull();
      expect(service.selectedTowerStats!.damage).toBeGreaterThan(0);
    });

    it('should set upgradePreview to null at max level - 1', () => {
      // Level 2 is MAX_TOWER_LEVEL - 1 → spec-choice required, preview = null
      const tower = createMockTower({ level: 2 });
      service.selectedTowerInfo = tower;

      service.refreshTowerInfoPanel();

      expect(service.upgradePreview).toBeNull();
    });

    it('should set upgradePreview for level 1 towers', () => {
      const tower = createMockTower({ level: 1 });
      service.selectedTowerInfo = tower;

      service.refreshTowerInfoPanel();

      expect(service.upgradePreview).not.toBeNull();
    });

    it('sell preview uses base 0.5 rate without SALVAGE_KIT', () => {
      relicSpy.getSellRefundRate.and.returnValue(0.5);
      const tower = createMockTower({ totalInvested: 200 });
      service.selectedTowerInfo = tower;

      service.refreshTowerInfoPanel();

      expect(service.selectedTowerSellValue).toBe(100);
    });

    it('sell preview uses relic-adjusted 0.75 rate with SALVAGE_KIT active', () => {
      relicSpy.getSellRefundRate.and.returnValue(0.75);
      const tower = createMockTower({ totalInvested: 200 });
      service.selectedTowerInfo = tower;

      service.refreshTowerInfoPanel();

      expect(service.selectedTowerSellValue).toBe(150);
    });
  });

  describe('cycleTargeting', () => {
    it('should be a no-op when no tower is selected', () => {
      service.cycleTargeting();
      expect(towerCombatSpy.cycleTargetingMode).not.toHaveBeenCalled();
    });

    it('should be a no-op for SLOW towers', () => {
      service.selectedTowerInfo = createMockTower({ type: TowerType.SLOW });
      service.cycleTargeting();
      expect(towerCombatSpy.cycleTargetingMode).not.toHaveBeenCalled();
    });

    it('should call cycleTargetingMode for non-SLOW towers', () => {
      const tower = createMockTower({ id: 'tower-5-5', type: TowerType.SNIPER });
      service.selectedTowerInfo = tower;

      service.cycleTargeting();

      expect(towerCombatSpy.cycleTargetingMode).toHaveBeenCalledWith('tower-5-5');
    });
  });

  describe('INITIAL_GAME_STATE reference', () => {
    it('INITIAL_GAME_STATE should have wave 0', () => {
      expect(INITIAL_GAME_STATE.wave).toBe(0);
    });
  });
});
