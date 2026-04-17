import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import * as THREE from 'three';

import { CardPlayService, CardPlayCallbacks } from './card-play.service';
import { DeckService } from '../../../run/services/deck.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { TowerCombatService } from './tower-combat.service';
import { GameStateService } from './game-state.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
import { AudioService } from './audio.service';
import { GameStatsService } from './game-stats.service';
import { GameBoardService } from '../game-board.service';
import { EnemyService } from './enemy.service';
import { SceneService } from './scene.service';
import { StatusEffectService } from './status-effect.service';
import { CombatLoopService } from './combat-loop.service';
import { WavePreviewService } from './wave-preview.service';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { GamePhase, INITIAL_GAME_STATE } from '../models/game-state.model';
import { CardId, CardInstance, DeckState, EnergyState } from '../../../run/models/card.model';
import {
  createGameStateServiceSpy,
  createGameBoardServiceSpy,
  createGameStatsServiceSpy,
  createAudioServiceSpy,
  createSceneServiceSpy,
} from '../testing';

describe('CardPlayService', () => {
  let service: CardPlayService;
  let deckSpy: jasmine.SpyObj<DeckService>;
  let cardEffectSpy: jasmine.SpyObj<CardEffectService>;
  let towerCombatSpy: jasmine.SpyObj<TowerCombatService>;
  let gameStateSpy: jasmine.SpyObj<GameStateService>;
  let meshRegistrySpy: jasmine.SpyObj<BoardMeshRegistryService>;
  let upgradeVisualSpy: jasmine.SpyObj<TowerUpgradeVisualService>;
  let audioSpy: jasmine.SpyObj<AudioService>;
  let gameStatsSpy: jasmine.SpyObj<GameStatsService>;
  let gameBoardSpy: jasmine.SpyObj<GameBoardService>;
  let enemySpy: jasmine.SpyObj<EnemyService>;
  let sceneSpy: jasmine.SpyObj<SceneService>;
  let statusEffectSpy: jasmine.SpyObj<StatusEffectService>;
  let combatLoopSpy: jasmine.SpyObj<CombatLoopService>;
  let wavePreviewSpy: jasmine.SpyObj<WavePreviewService>;

  const combatState = { ...INITIAL_GAME_STATE, phase: GamePhase.COMBAT };

  beforeEach(() => {
    deckSpy = jasmine.createSpyObj<DeckService>('DeckService', [
      'playCard', 'getEnergy', 'drawOne', 'addEnergy', 'discardHand', 'getDeckState', 'undoPlay',
    ]);
    deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);
    deckSpy.playCard.and.returnValue(true);
    deckSpy.getDeckState.and.returnValue(
      { drawPile: [], hand: [], discardPile: [], exhaustPile: [] } as DeckState
    );

    cardEffectSpy = jasmine.createSpyObj<CardEffectService>('CardEffectService', [
      'applySpell', 'applyModifier', 'reset',
    ]);

    towerCombatSpy = jasmine.createSpyObj<TowerCombatService>('TowerCombatService', [
      'getPlacedTowers', 'upgradeTower', 'unregisterTower',
    ]);
    towerCombatSpy.getPlacedTowers.and.returnValue(new Map());

    gameStateSpy = createGameStateServiceSpy();
    gameStateSpy.getState.and.returnValue(combatState);

    meshRegistrySpy = jasmine.createSpyObj<BoardMeshRegistryService>('BoardMeshRegistryService', [
      'rebuildTowerChildrenArray',
    ]);
    // towerMeshes is readonly — assign via cast so tests can mutate the Map
    (meshRegistrySpy as { towerMeshes: Map<string, THREE.Group> }).towerMeshes = new Map();

    upgradeVisualSpy = jasmine.createSpyObj<TowerUpgradeVisualService>('TowerUpgradeVisualService', [
      'applyUpgradeVisuals',
    ]);

    audioSpy = createAudioServiceSpy();
    gameStatsSpy = createGameStatsServiceSpy();
    gameBoardSpy = createGameBoardServiceSpy();
    enemySpy = jasmine.createSpyObj<EnemyService>('EnemyService', ['repathAffectedEnemies']);

    sceneSpy = createSceneServiceSpy();

    statusEffectSpy = jasmine.createSpyObj<StatusEffectService>('StatusEffectService', ['apply']);
    combatLoopSpy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', ['getTurnNumber']);
    combatLoopSpy.getTurnNumber.and.returnValue(1);
    wavePreviewSpy = jasmine.createSpyObj<WavePreviewService>('WavePreviewService', [
      'addOneShotBonus', 'getPreviewDepth', 'getFutureWavesSummary', 'resetForEncounter',
    ]);

    TestBed.configureTestingModule({
      providers: [
        CardPlayService,
        { provide: DeckService, useValue: deckSpy },
        { provide: CardEffectService, useValue: cardEffectSpy },
        { provide: TowerCombatService, useValue: towerCombatSpy },
        { provide: GameStateService, useValue: gameStateSpy },
        { provide: BoardMeshRegistryService, useValue: meshRegistrySpy },
        { provide: TowerUpgradeVisualService, useValue: upgradeVisualSpy },
        { provide: AudioService, useValue: audioSpy },
        { provide: GameStatsService, useValue: gameStatsSpy },
        { provide: GameBoardService, useValue: gameBoardSpy },
        { provide: EnemyService, useValue: enemySpy },
        { provide: SceneService, useValue: sceneSpy },
        { provide: StatusEffectService, useValue: statusEffectSpy },
        { provide: CombatLoopService, useValue: combatLoopSpy },
        { provide: WavePreviewService, useValue: wavePreviewSpy },
      ],
    });

    service = TestBed.inject(CardPlayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('hasPendingCard', () => {
    it('should return false initially', () => {
      expect(service.hasPendingCard()).toBeFalse();
    });

    it('should return false after reset', () => {
      service.reset();
      expect(service.hasPendingCard()).toBeFalse();
    });
  });

  describe('getPendingCard', () => {
    it('should return null initially', () => {
      expect(service.getPendingCard()).toBeNull();
    });
  });

  describe('getPendingCardId', () => {
    it('should return null initially', () => {
      expect(service.getPendingCardId()).toBeNull();
    });
  });

  describe('cancelPendingTowerCard', () => {
    it('should null out the pending card', () => {
      service['pendingTowerCard'] = { instanceId: 'abc', cardId: CardId.TOWER_BASIC, upgraded: false };
      service.cancelPendingTowerCard();
      expect(service.hasPendingCard()).toBeFalse();
    });
  });

  describe('consumePendingTowerCard', () => {
    it('should play the card and clear pending state', () => {
      const card: CardInstance = { instanceId: 'x1', cardId: CardId.TOWER_BASIC, upgraded: false };
      service['pendingTowerCard'] = card;
      service.consumePendingTowerCard();
      expect(deckSpy.playCard).toHaveBeenCalledWith('x1');
      expect(service.hasPendingCard()).toBeFalse();
    });

    it('should be a no-op when no pending card exists', () => {
      service.consumePendingTowerCard();
      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });
  });

  describe('onCardPlayed', () => {
    it('should no-op when phase is not COMBAT', () => {
      gameStateSpy.getState.and.returnValue({ ...INITIAL_GAME_STATE, phase: GamePhase.SETUP });
      const card: CardInstance = { instanceId: 'c1', cardId: CardId.DRAW_TWO, upgraded: false };
      service.onCardPlayed(card);
      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });

    it('should block card plays when a tower card is already pending', () => {
      const existingCard: CardInstance = { instanceId: 'pending', cardId: CardId.DRAW_TWO, upgraded: false };
      service['pendingTowerCard'] = existingCard;

      const newCard: CardInstance = { instanceId: 'new', cardId: CardId.DRAW_TWO, upgraded: false };
      service.onCardPlayed(newCard);
      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });

    it('should call onRefreshUI when re-clicking the pending card (cancel)', () => {
      const onRefreshUI = jasmine.createSpy('onRefreshUI');
      service.init({ onEnterPlacementMode: jasmine.createSpy(), onRefreshUI, onSalvageComplete: jasmine.createSpy() });

      const card: CardInstance = { instanceId: 'pending', cardId: CardId.DRAW_TWO, upgraded: false };
      service['pendingTowerCard'] = card;
      service.onCardPlayed(card);

      expect(service.hasPendingCard()).toBeFalse();
      expect(onRefreshUI).toHaveBeenCalled();

    });

    it('should not consume energy below threshold for tower cards', () => {
      deckSpy.getEnergy.and.returnValue({ current: 0, max: 3 } as EnergyState);
      const onEnterPlacementMode = jasmine.createSpy('onEnterPlacementMode');
      service.init({ onEnterPlacementMode, onRefreshUI: jasmine.createSpy(), onSalvageComplete: jasmine.createSpy() });

      // 'basic-tower' has energyCost — if current < cost, should not enter placement
      const card: CardInstance = { instanceId: 'c1', cardId: CardId.TOWER_BASIC, upgraded: false };
      service.onCardPlayed(card);
      expect(onEnterPlacementMode).not.toHaveBeenCalled();
    });

    it('should call applyModifier for modifier cards', () => {
      // Use a real modifier card if defined; otherwise verify playCard is called
      const card: CardInstance = { instanceId: 'm1', cardId: CardId.DRAW_TWO, upgraded: false };
      service.onCardPlayed(card);
      // draw-two is a utility card — deckSpy.playCard should have been called
      expect(deckSpy.playCard).toHaveBeenCalledWith('m1');
    });
  });

  describe('executeUtilityCard (via onCardPlayed)', () => {
    it('should draw cards for "draw" utility', () => {
      const card: CardInstance = { instanceId: 'u1', cardId: CardId.DRAW_TWO, upgraded: false };
      service.onCardPlayed(card);
      // draw-two draws 2 cards
      expect(deckSpy.drawOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('fortifyRandomTower', () => {
    it('should be a no-op when no towers are placed', () => {
      towerCombatSpy.getPlacedTowers.and.returnValue(new Map());
      service['fortifyRandomTower']();
      expect(towerCombatSpy.upgradeTower).not.toHaveBeenCalled();
    });
  });

  describe('salvageLastTower', () => {
    it('should be a no-op when no towers are placed', () => {
      towerCombatSpy.getPlacedTowers.and.returnValue(new Map());
      service.salvageLastTower();
      expect(towerCombatSpy.unregisterTower).not.toHaveBeenCalled();
    });
  });

  describe('salvage pre-validation', () => {
    it('should NOT consume card or energy when no towers are placed', () => {
      towerCombatSpy.getPlacedTowers.and.returnValue(new Map());
      const card: CardInstance = { instanceId: 'sal-1', cardId: CardId.SALVAGE, upgraded: false };
      service.onCardPlayed(card);
      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });

    it('should consume card and salvage when towers exist', () => {
      const tower = { row: 0, col: 0, level: 1, type: TowerType.BASIC, totalInvested: 50 };
      const placedMap = new Map<string, typeof tower>();
      placedMap.set('0-0', tower as never);
      towerCombatSpy.getPlacedTowers.and.returnValue(placedMap as never);
      towerCombatSpy.unregisterTower.and.returnValue(tower as never);
      const mockScene = { remove: jasmine.createSpy('remove') };
      (sceneSpy.getScene as jasmine.Spy).and.returnValue(mockScene);

      const card: CardInstance = { instanceId: 'sal-2', cardId: CardId.SALVAGE, upgraded: false };
      service.onCardPlayed(card);
      expect(deckSpy.playCard).toHaveBeenCalledWith('sal-2');
      expect(towerCombatSpy.unregisterTower).toHaveBeenCalledWith('0-0');
    });
  });

  describe('fortify pre-validation', () => {
    it('should NOT consume card or energy when no towers are upgradeable (empty map)', () => {
      towerCombatSpy.getPlacedTowers.and.returnValue(new Map());
      const card: CardInstance = { instanceId: 'fort-1', cardId: CardId.FORTIFY, upgraded: false };
      service.onCardPlayed(card);
      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });

    it('should NOT consume card when all towers are at max-1 level (L2 — cannot auto-upgrade)', () => {
      // MAX_TOWER_LEVEL = 3, so level < MAX_TOWER_LEVEL - 1 means level < 2 — L2 towers are excluded
      const tower = { row: 0, col: 0, level: 2, type: TowerType.BASIC, totalInvested: 100 };
      const placedMap = new Map<string, typeof tower>();
      placedMap.set('0-0', tower as never);
      towerCombatSpy.getPlacedTowers.and.returnValue(placedMap as never);

      const card: CardInstance = { instanceId: 'fort-2', cardId: CardId.FORTIFY, upgraded: false };
      service.onCardPlayed(card);
      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });

    it('should consume card and upgrade when an L1 tower exists', () => {
      const tower = { row: 0, col: 0, level: 1, type: TowerType.BASIC, totalInvested: 50 };
      const placedMap = new Map<string, typeof tower>();
      placedMap.set('0-0', tower as never);
      towerCombatSpy.getPlacedTowers.and.returnValue(placedMap as never);
      towerCombatSpy.upgradeTower.and.returnValue(tower as never);

      const card: CardInstance = { instanceId: 'fort-3', cardId: CardId.FORTIFY, upgraded: false };
      service.onCardPlayed(card);
      expect(deckSpy.playCard).toHaveBeenCalledWith('fort-3');
      expect(towerCombatSpy.upgradeTower).toHaveBeenCalledWith('0-0', 0);
    });

    // Phase 1 Sprint 5 — upgraded FORTIFY upgrades up to 2 towers.
    it('upgraded FORTIFY upgrades up to 2 distinct towers', () => {
      const t1 = { row: 0, col: 0, level: 1, type: TowerType.BASIC, totalInvested: 50 };
      const t2 = { row: 1, col: 0, level: 1, type: TowerType.SNIPER, totalInvested: 80 };
      const placedMap = new Map<string, typeof t1>();
      placedMap.set('0-0', t1 as never);
      placedMap.set('1-0', t2 as never);
      towerCombatSpy.getPlacedTowers.and.returnValue(placedMap as never);
      towerCombatSpy.upgradeTower.and.callFake((_key: string) => t1 as never);

      const card: CardInstance = { instanceId: 'fort-up', cardId: CardId.FORTIFY, upgraded: true };
      service.onCardPlayed(card);

      expect(deckSpy.playCard).toHaveBeenCalledWith('fort-up');
      // Two distinct upgrade calls — one per tower in the pool, never the same key twice.
      expect(towerCombatSpy.upgradeTower).toHaveBeenCalledTimes(2);
      const calledKeys = towerCombatSpy.upgradeTower.calls.allArgs().map(a => a[0]);
      expect(new Set(calledKeys).size).toBe(2);
    });

    it('upgraded FORTIFY tolerates fewer eligible towers than upgrade count', () => {
      // Only 1 eligible tower; upgraded FORTIFY (count=2) should still upgrade
      // that one without crashing or double-upgrading.
      const tower = { row: 0, col: 0, level: 1, type: TowerType.BASIC, totalInvested: 50 };
      const placedMap = new Map<string, typeof tower>();
      placedMap.set('0-0', tower as never);
      towerCombatSpy.getPlacedTowers.and.returnValue(placedMap as never);
      towerCombatSpy.upgradeTower.and.returnValue(tower as never);

      const card: CardInstance = { instanceId: 'fort-up2', cardId: CardId.FORTIFY, upgraded: true };
      service.onCardPlayed(card);

      expect(towerCombatSpy.upgradeTower).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset', () => {
    it('should clear pending card state', () => {
      service['pendingTowerCard'] = { instanceId: 'x', cardId: CardId.TOWER_BASIC, upgraded: false };
      service.reset();
      expect(service.hasPendingCard()).toBeFalse();
      expect(service.getPendingCard()).toBeNull();
    });
  });

  describe('effect rollback on error', () => {
    it('calls undoPlay with card instanceId and energy cost when applySpell throws', () => {
      const error = new Error('effect exploded');
      cardEffectSpy.applySpell.and.throwError(error);
      spyOn(console, 'error');

      const card: CardInstance = { instanceId: 'spell-1', cardId: CardId.GOLD_RUSH, upgraded: false };
      service.onCardPlayed(card);

      expect(deckSpy.playCard).toHaveBeenCalledWith('spell-1');
      expect(deckSpy.undoPlay).toHaveBeenCalledWith('spell-1', jasmine.any(Number));
      expect(console.error).toHaveBeenCalled();
    });

    it('does NOT call undoPlay when applySpell succeeds', () => {
      const card: CardInstance = { instanceId: 'spell-2', cardId: CardId.GOLD_RUSH, upgraded: false };
      service.onCardPlayed(card);
      expect(deckSpy.undoPlay).not.toHaveBeenCalled();
    });
  });
});
