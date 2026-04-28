import { TestBed } from '@angular/core/testing';
import { TowerInteractionService, UpgradeTowerResult } from './tower-interaction.service';
import { GameStateService } from './game-state.service';
import { GameBoardService } from '../game-board.service';
import { TowerCombatService } from './tower-combat.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameEndService } from './game-end.service';
import { EnemyService } from './enemy.service';
import {
  TowerType,
  TowerSpecialization,
  PlacedTower,
  TOWER_CONFIGS,
  getSellValue,
  MAX_TOWER_LEVEL,
  TargetingMode,
} from '../models/tower.model';
import { GamePhase, GameState } from '../models/game-state.model';
import { ModifierEffects } from '../models/game-modifier.model';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { RelicService } from '../../../run/services/relic.service';
import { createRelicServiceSpy } from '../testing';
import { RunEventBusService, RunEventType } from '../../../run/services/run-event-bus.service';

function makeMockTower(overrides: Partial<PlacedTower> = {}): PlacedTower {
  return {
    id: '2-3',
    type: TowerType.BASIC,
    level: 1,
    row: 2,
    col: 3,
    kills: 0,
    totalInvested: 100,
    mesh: null,
    targetingMode: TargetingMode.NEAREST,
    ...overrides,
  };
}

describe('TowerInteractionService', () => {
  let service: TowerInteractionService;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let gameBoardSpy: jasmine.SpyObj<GameBoardService>;
  let towerCombatSpy: jasmine.SpyObj<TowerCombatService>;
  let challengeSpy: jasmine.SpyObj<ChallengeTrackingService>;
  let gameEndSpy: jasmine.SpyObj<GameEndService>;
  let enemySpy: jasmine.SpyObj<EnemyService>;
  let eventBusSpy: jasmine.SpyObj<RunEventBusService>;

  beforeEach(() => {
    gameStateSpy = jasmine.createSpyObj('GameStateService', [
      'getState', 'canAfford', 'spendGold', 'addGold', 'getModifierEffects',
    ]);
    gameBoardSpy = jasmine.createSpyObj('GameBoardService', [
      'canPlaceTower', 'placeTower', 'removeTower', 'getGameBoard', 'wouldBlockPath',
    ]);
    towerCombatSpy = jasmine.createSpyObj('TowerCombatService', [
      'registerTower', 'unregisterTower', 'upgradeTower', 'upgradeTowerWithSpec', 'getTower',
    ]);
    challengeSpy = jasmine.createSpyObj('ChallengeTrackingService', [
      'recordTowerPlaced', 'recordTowerUpgraded', 'recordTowerSold',
    ]);
    gameEndSpy = jasmine.createSpyObj('GameEndService', ['recordSpecialization']);
    enemySpy = jasmine.createSpyObj('EnemyService', ['repathAffectedEnemies']);
    eventBusSpy = jasmine.createSpyObj<RunEventBusService>('RunEventBusService', ['emit']);

    // Default safe stubs
    gameStateSpy.getState.and.returnValue({ phase: GamePhase.SETUP, gold: 1000 } as unknown as GameState);
    gameStateSpy.canAfford.and.returnValue(true);
    gameStateSpy.getModifierEffects.and.returnValue({ towerCostMultiplier: 1 } as ModifierEffects);

    TestBed.configureTestingModule({
      providers: [
        TowerInteractionService,
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: GameBoardService, useValue: gameBoardSpy },
        { provide: TowerCombatService, useValue: towerCombatSpy },
        { provide: ChallengeTrackingService, useValue: challengeSpy },
        { provide: GameEndService, useValue: gameEndSpy },
        { provide: EnemyService, useValue: enemySpy },
        { provide: RelicService, useValue: createRelicServiceSpy() },
        { provide: RunEventBusService, useValue: eventBusSpy },
      ],
    });

    service = TestBed.inject(TowerInteractionService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  // ─── placeTower ────────────────────────────────────────────────────────────

  describe('placeTower', () => {
    it('fails when phase is VICTORY', () => {
      gameStateSpy.getState.and.returnValue({ phase: GamePhase.VICTORY, gold: 1000 } as unknown as GameState);
      const result = service.placeTower(0, 0, TowerType.BASIC);
      expect(result.success).toBeFalse();
    });

    it('fails when phase is DEFEAT', () => {
      gameStateSpy.getState.and.returnValue({ phase: GamePhase.DEFEAT, gold: 1000 } as unknown as GameState);
      const result = service.placeTower(0, 0, TowerType.BASIC);
      expect(result.success).toBeFalse();
    });

    it('fails when canPlaceTower returns false (bounds/path check)', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(false);
      const result = service.placeTower(-1, -1, TowerType.BASIC);
      expect(result.success).toBeFalse();
      expect(gameStateSpy.spendGold).not.toHaveBeenCalled();
    });

    it('fails when player cannot afford the cost', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(true);
      gameStateSpy.canAfford.and.returnValue(false);
      const result = service.placeTower(0, 0, TowerType.BASIC);
      expect(result.success).toBeFalse();
      expect(gameStateSpy.spendGold).not.toHaveBeenCalled();
    });

    it('fails when gameBoardService.placeTower returns false', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(true);
      gameBoardSpy.placeTower.and.returnValue(false);
      const result = service.placeTower(0, 0, TowerType.BASIC);
      expect(result.success).toBeFalse();
      expect(gameStateSpy.spendGold).not.toHaveBeenCalled();
    });

    it('succeeds and spends gold on valid placement', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(true);
      gameBoardSpy.placeTower.and.returnValue(true);
      const result = service.placeTower(2, 3, TowerType.BASIC);
      expect(result.success).toBeTrue();
      expect(result.cost).toBe(TOWER_CONFIGS[TowerType.BASIC].cost);
      expect(result.towerKey).toBe('2-3');
      expect(gameStateSpy.spendGold).toHaveBeenCalledWith(TOWER_CONFIGS[TowerType.BASIC].cost);
    });

    it('records challenge metrics on success', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(true);
      gameBoardSpy.placeTower.and.returnValue(true);
      service.placeTower(0, 0, TowerType.SNIPER);
      expect(challengeSpy.recordTowerPlaced).toHaveBeenCalledWith(TowerType.SNIPER, TOWER_CONFIGS[TowerType.SNIPER].cost);
    });

    it('emits TOWER_PLACED with tower details on success', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(true);
      gameBoardSpy.placeTower.and.returnValue(true);
      service.placeTower(2, 3, TowerType.SNIPER);

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        RunEventType.TOWER_PLACED,
        jasmine.objectContaining({
          towerKey: '2-3',
          type: TowerType.SNIPER,
          row: 2,
          col: 3,
          cost: TOWER_CONFIGS[TowerType.SNIPER].cost,
        }),
      );
    });

    it('does NOT emit TOWER_PLACED when placement fails', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(false);
      service.placeTower(0, 0, TowerType.BASIC);

      const placedCalls = eventBusSpy.emit.calls.allArgs()
        .filter(args => args[0] === RunEventType.TOWER_PLACED);
      expect(placedCalls.length).toBe(0);
    });

    it('repaths enemies on success', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(true);
      gameBoardSpy.placeTower.and.returnValue(true);
      service.placeTower(2, 3, TowerType.BASIC);
      expect(enemySpy.repathAffectedEnemies).toHaveBeenCalledWith(2, 3);
    });

    it('does not double-spend gold when placeTower returns false after canPlaceTower', () => {
      gameBoardSpy.canPlaceTower.and.returnValue(true);
      gameBoardSpy.placeTower.and.returnValue(false);
      service.placeTower(0, 0, TowerType.BASIC);
      expect(gameStateSpy.spendGold).not.toHaveBeenCalled();
    });
  });

  // ─── wouldBlockPath ────────────────────────────────────────────────────────

  describe('wouldBlockPath', () => {
    it('delegates to gameBoardService.wouldBlockPath and returns true when BFS confirms blocking', () => {
      gameBoardSpy.wouldBlockPath.and.returnValue(true);
      expect(service.wouldBlockPath(0, 2)).toBeTrue();
      expect(gameBoardSpy.wouldBlockPath).toHaveBeenCalledWith(0, 2);
    });

    it('delegates to gameBoardService.wouldBlockPath and returns false for a non-blocking tile', () => {
      gameBoardSpy.wouldBlockPath.and.returnValue(false);
      expect(service.wouldBlockPath(1, 1)).toBeFalse();
      expect(gameBoardSpy.wouldBlockPath).toHaveBeenCalledWith(1, 1);
    });
  });

  // ─── isPlaceableTile ───────────────────────────────────────────────────────

  describe('isPlaceableTile', () => {
    it('returns true when tile is an unoccupied purchasable BASE tile', () => {
      const tile = { type: BlockType.BASE, isPurchasable: true, towerType: null } as unknown as GameBoardTile;
      gameBoardSpy.getGameBoard.and.returnValue([[tile]]);
      expect(service.isPlaceableTile(0, 0)).toBeTrue();
    });

    it('returns false when tile already has a tower', () => {
      const tile = { type: BlockType.BASE, isPurchasable: true, towerType: TowerType.BASIC } as unknown as GameBoardTile;
      gameBoardSpy.getGameBoard.and.returnValue([[tile]]);
      expect(service.isPlaceableTile(0, 0)).toBeFalse();
    });

    it('returns false when tile is not BASE type', () => {
      const tile = { type: BlockType.WALL, isPurchasable: false, towerType: null } as unknown as GameBoardTile;
      gameBoardSpy.getGameBoard.and.returnValue([[tile]]);
      expect(service.isPlaceableTile(0, 0)).toBeFalse();
    });

    it('returns false for out-of-bounds row', () => {
      gameBoardSpy.getGameBoard.and.returnValue([]);
      expect(service.isPlaceableTile(5, 0)).toBeFalse();
    });
  });

  // ─── sellTower ─────────────────────────────────────────────────────────────

  describe('sellTower', () => {
    it('fails when phase is VICTORY', () => {
      gameStateSpy.getState.and.returnValue({ phase: GamePhase.VICTORY } as unknown as GameState);
      const result = service.sellTower('1-1');
      expect(result.success).toBeFalse();
    });

    it('fails when phase is DEFEAT', () => {
      gameStateSpy.getState.and.returnValue({ phase: GamePhase.DEFEAT } as unknown as GameState);
      const result = service.sellTower('1-1');
      expect(result.success).toBeFalse();
    });

    it('fails when unregisterTower returns undefined (stale reference)', () => {
      towerCombatSpy.unregisterTower.and.returnValue(undefined);
      const result = service.sellTower('9-9');
      expect(result.success).toBeFalse();
      expect(gameStateSpy.addGold).not.toHaveBeenCalled();
    });

    it('calculates correct refund (50% of totalInvested)', () => {
      const tower = makeMockTower({ id: '1-1', totalInvested: 200 });
      towerCombatSpy.unregisterTower.and.returnValue(tower);
      const result = service.sellTower('1-1');
      expect(result.success).toBeTrue();
      expect(result.refundAmount).toBe(getSellValue(200));
      expect(gameStateSpy.addGold).toHaveBeenCalledWith(getSellValue(200));
    });

    it('adds gold (not score) on successful sell', () => {
      const tower = makeMockTower({ totalInvested: 150 });
      towerCombatSpy.unregisterTower.and.returnValue(tower);
      service.sellTower('2-3');
      expect(gameStateSpy.addGold).toHaveBeenCalled();
    });

    it('removes tower from board on success', () => {
      const tower = makeMockTower({ row: 2, col: 3 });
      towerCombatSpy.unregisterTower.and.returnValue(tower);
      service.sellTower('2-3');
      expect(gameBoardSpy.removeTower).toHaveBeenCalledWith(2, 3);
    });

    it('records challenge sell metric', () => {
      const tower = makeMockTower();
      towerCombatSpy.unregisterTower.and.returnValue(tower);
      service.sellTower('2-3');
      expect(challengeSpy.recordTowerSold).toHaveBeenCalled();
    });

    it('repaths ALL enemies on sell', () => {
      const tower = makeMockTower();
      towerCombatSpy.unregisterTower.and.returnValue(tower);
      service.sellTower('2-3');
      expect(enemySpy.repathAffectedEnemies).toHaveBeenCalledWith(-1, -1);
    });

    it('confirms unregistration BEFORE adding gold (confirm-before-refund)', () => {
      towerCombatSpy.unregisterTower.and.returnValue(undefined);
      service.sellTower('2-3');
      // If unregister fails, no gold should be added
      expect(gameStateSpy.addGold).not.toHaveBeenCalled();
    });

    it('emits TOWER_SOLD with refund amount on success', () => {
      const tower = makeMockTower({ id: '1-1', type: TowerType.SPLASH, totalInvested: 200 });
      towerCombatSpy.unregisterTower.and.returnValue(tower);
      service.sellTower('1-1');

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        RunEventType.TOWER_SOLD,
        jasmine.objectContaining({
          towerKey: '1-1',
          type: TowerType.SPLASH,
          refundAmount: getSellValue(200),
        }),
      );
    });

    it('does NOT emit TOWER_SOLD when sell fails', () => {
      towerCombatSpy.unregisterTower.and.returnValue(undefined);
      service.sellTower('9-9');

      const soldCalls = eventBusSpy.emit.calls.allArgs()
        .filter(args => args[0] === RunEventType.TOWER_SOLD);
      expect(soldCalls.length).toBe(0);
    });
  });

  // ─── upgradeTower ──────────────────────────────────────────────────────────

  describe('upgradeTower', () => {
    it('fails when phase is VICTORY', () => {
      gameStateSpy.getState.and.returnValue({ phase: GamePhase.VICTORY } as unknown as GameState);
      towerCombatSpy.getTower.and.returnValue(makeMockTower());
      const result = service.upgradeTower('2-3');
      expect(result.success).toBeFalse();
    });

    it('fails when tower not found', () => {
      towerCombatSpy.getTower.and.returnValue(undefined);
      const result = service.upgradeTower('9-9');
      expect(result.success).toBeFalse();
    });

    it('fails when tower is already at max level', () => {
      const tower = makeMockTower({ level: MAX_TOWER_LEVEL });
      towerCombatSpy.getTower.and.returnValue(tower);
      const result = service.upgradeTower('2-3');
      expect(result.success).toBeFalse();
    });

    it('fails when player cannot afford upgrade', () => {
      const tower = makeMockTower({ level: 1 });
      towerCombatSpy.getTower.and.returnValue(tower);
      gameStateSpy.canAfford.and.returnValue(false);
      const result = service.upgradeTower('2-3');
      expect(result.success).toBeFalse();
      expect(gameStateSpy.spendGold).not.toHaveBeenCalled();
    });

    it('executes L1→L2 standard upgrade and spends gold', () => {
      const tower = makeMockTower({ level: 1 });
      towerCombatSpy.getTower.and.returnValue(tower);
      towerCombatSpy.upgradeTower.and.returnValue(true);
      const result = service.upgradeTower('2-3');
      expect(result.success).toBeTrue();
      expect(result.newLevel).toBe(2);
      expect(gameStateSpy.spendGold).toHaveBeenCalled();
      expect(challengeSpy.recordTowerUpgraded).toHaveBeenCalled();
    });

    it('emits TOWER_UPGRADED on L1→L2 success (no specialization field)', () => {
      const tower = makeMockTower({ id: '2-3', level: 1, type: TowerType.BASIC });
      towerCombatSpy.getTower.and.returnValue(tower);
      towerCombatSpy.upgradeTower.and.returnValue(true);
      service.upgradeTower('2-3');

      const upgradeCalls = eventBusSpy.emit.calls.allArgs()
        .filter(args => args[0] === RunEventType.TOWER_UPGRADED);
      expect(upgradeCalls.length).toBe(1);
      const payload = upgradeCalls[0][1] as Record<string, unknown>;
      expect(payload['towerKey']).toBe('2-3');
      expect(payload['type']).toBe(TowerType.BASIC);
      expect(payload['newLevel']).toBe(2);
      expect(payload['specialization']).toBeUndefined();
    });

    it('emits TOWER_UPGRADED on L2→L3 success with specialization field', () => {
      const tower = makeMockTower({ level: 2, type: TowerType.SNIPER });
      towerCombatSpy.getTower.and.returnValue(tower);
      towerCombatSpy.upgradeTowerWithSpec.and.returnValue(true);
      service.upgradeTower('2-3', TowerSpecialization.ALPHA);

      expect(eventBusSpy.emit).toHaveBeenCalledWith(
        RunEventType.TOWER_UPGRADED,
        jasmine.objectContaining({
          newLevel: 3,
          specialization: TowerSpecialization.ALPHA,
        }),
      );
    });

    it('does NOT emit TOWER_UPGRADED when upgrade fails due to affordability', () => {
      const tower = makeMockTower({ level: 1 });
      towerCombatSpy.getTower.and.returnValue(tower);
      gameStateSpy.canAfford.and.returnValue(false);
      service.upgradeTower('2-3');

      const upgradeCalls = eventBusSpy.emit.calls.allArgs()
        .filter(args => args[0] === RunEventType.TOWER_UPGRADED);
      expect(upgradeCalls.length).toBe(0);
    });

    it('fails L1→L2 when combat service upgradeTower returns false', () => {
      const tower = makeMockTower({ level: 1 });
      towerCombatSpy.getTower.and.returnValue(tower);
      towerCombatSpy.upgradeTower.and.returnValue(false);
      const result = service.upgradeTower('2-3');
      expect(result.success).toBeFalse();
      expect(gameStateSpy.spendGold).not.toHaveBeenCalled();
    });

    it('returns needsSpecialization=true for L2→L3 without spec', () => {
      const tower = makeMockTower({ level: 2 });
      towerCombatSpy.getTower.and.returnValue(tower);
      const result = service.upgradeTower('2-3');
      expect(result.success).toBeFalse();
      expect(result.needsSpecialization).toBeTrue();
      expect(result.specOptions).toBeDefined();
      expect(result.specOptions!.length).toBe(2);
    });

    it('executes L2→L3 specialization upgrade with ALPHA spec', () => {
      const tower = makeMockTower({ level: 2 });
      towerCombatSpy.getTower.and.returnValue(tower);
      towerCombatSpy.upgradeTowerWithSpec.and.returnValue(true);
      const result: UpgradeTowerResult = service.upgradeTower('2-3', TowerSpecialization.ALPHA);
      expect(result.success).toBeTrue();
      expect(result.newLevel).toBe(3);
      expect(result.specialization).toBe(TowerSpecialization.ALPHA);
      expect(gameStateSpy.spendGold).toHaveBeenCalled();
      expect(challengeSpy.recordTowerUpgraded).toHaveBeenCalled();
      expect(gameEndSpy.recordSpecialization).toHaveBeenCalled();
    });

    it('executes L2→L3 specialization upgrade with BETA spec', () => {
      const tower = makeMockTower({ level: 2 });
      towerCombatSpy.getTower.and.returnValue(tower);
      towerCombatSpy.upgradeTowerWithSpec.and.returnValue(true);
      const result: UpgradeTowerResult = service.upgradeTower('2-3', TowerSpecialization.BETA);
      expect(result.success).toBeTrue();
      expect(result.specialization).toBe(TowerSpecialization.BETA);
    });

    it('fails L2→L3 when upgradeTowerWithSpec returns false', () => {
      const tower = makeMockTower({ level: 2 });
      towerCombatSpy.getTower.and.returnValue(tower);
      towerCombatSpy.upgradeTowerWithSpec.and.returnValue(false);
      const result = service.upgradeTower('2-3', TowerSpecialization.ALPHA);
      expect(result.success).toBeFalse();
      expect(gameStateSpy.spendGold).not.toHaveBeenCalled();
    });
  });
});
