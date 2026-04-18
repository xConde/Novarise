import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import * as THREE from 'three';

import { CardPlayService, CardPlayCallbacks } from './card-play.service';
import { PathMutationService } from './path-mutation.service';
import { ElevationService } from './elevation.service';
import { DeckService } from '../../../run/services/deck.service';
import { RunService } from '../../../run/services/run.service';
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
import {
  CardId,
  CardInstance,
  DeckState,
  EnergyState,
  TerraformTargetCardEffect,
  isTerraformTargetEffect,
} from '../../../run/models/card.model';
import { MutationOp, MutationResult, MutationRejectionReason } from './path-mutation.types';
import { CARD_DEFINITIONS } from '../../../run/constants/card-definitions';
import {
  createGameStateServiceSpy,
  createGameBoardServiceSpy,
  createGameStatsServiceSpy,
  createAudioServiceSpy,
  createSceneServiceSpy,
} from '../testing';

// ── Terraform card fixture helpers ────────────────────────────────────────────

/**
 * Build a fake TerraformTargetCardEffect for testing.
 * Not wired to CARD_DEFINITIONS — infrastructure tests must not depend
 * on real card definitions (those land in sprints 11+).
 */
function makeTerraformEffect(op: MutationOp, duration: number | null = null): TerraformTargetCardEffect {
  return { type: 'terraform_target', op, duration };
}

/**
 * Synthetic CardId reserved for terraform infrastructure tests.
 * Cast to CardId because CardId is a string-backed enum; any string value
 * round-trips through `getCardDefinition()` as long as CARD_DEFINITIONS has
 * an entry for the key. Chosen prefix `__TEST_TF_` is guaranteed unused by
 * real content (the enum members are all uppercase, no leading underscore).
 *
 * Rationale for NOT borrowing a real CardId (e.g. SCOUT_AHEAD): overwriting
 * a real definition leaks across specs — e.g. card-definitions.spec.ts
 * asserts `SCOUT_AHEAD.archetype === 'cartographer'` (sprint 13) and a stale
 * override from this file was flipping that test to failure.
 */
const TEST_TERRAFORM_CARD_ID = '__TEST_TF_CARD__' as CardId;

/**
 * Register a synthetic terraform CardDefinition under TEST_TERRAFORM_CARD_ID.
 * Paired with unregisterTerraformDef() in afterEach.
 */
function registerTerraformDef(energyCost: number, op: MutationOp, duration: number | null = null): void {
  (CARD_DEFINITIONS as Record<string, unknown>)[TEST_TERRAFORM_CARD_ID] = {
    id: TEST_TERRAFORM_CARD_ID,
    name: 'Test Terraform',
    description: 'Test',
    type: 'terraform' as const,
    rarity: 'common' as const,
    energyCost,
    effect: makeTerraformEffect(op, duration),
    upgradedEffect: undefined,
    upgraded: false,
    archetype: 'cartographer' as const,
    terraform: true,
  };
}

/** Remove the synthetic terraform CardDefinition — no real card is touched. */
function unregisterTerraformDef(): void {
  delete (CARD_DEFINITIONS as Record<string, unknown>)[TEST_TERRAFORM_CARD_ID];
}

/** Convenience: a test CardInstance using the synthetic terraform CardId. */
function makeTerraformInstance(instanceId = 'tf-1'): CardInstance {
  return { instanceId, cardId: TEST_TERRAFORM_CARD_ID, upgraded: false };
}

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
  let pathMutationSpy: jasmine.SpyObj<PathMutationService>;

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
      'applySpell', 'applyModifier', 'reset', 'hasActiveModifier',
    ]);
    // Default: no modifiers active. Sprint-17 CARTOGRAPHER_SEAL specs override this.
    cardEffectSpy.hasActiveModifier.and.returnValue(false);

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
    enemySpy = jasmine.createSpyObj<EnemyService>('EnemyService', [
      'repathAffectedEnemies',
      'getEnemies',
      'damageEnemy',
    ]);
    // Default to empty enemy set; COLLAPSE damage specs override per-test.
    enemySpy.getEnemies.and.returnValue(new Map() as never);

    sceneSpy = createSceneServiceSpy();

    statusEffectSpy = jasmine.createSpyObj<StatusEffectService>('StatusEffectService', ['apply']);
    combatLoopSpy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', ['getTurnNumber']);
    combatLoopSpy.getTurnNumber.and.returnValue(1);
    wavePreviewSpy = jasmine.createSpyObj<WavePreviewService>('WavePreviewService', [
      'addOneShotBonus', 'getPreviewDepth', 'getFutureWavesSummary', 'resetForEncounter',
    ]);

    // Phase 1 closer (Finding 3) — RunService is injected for nextRandom().
    // Spy returns 0 by default so deterministic tests pick index 0; specs that
    // care about non-zero RNG can rebind via runServiceSpy.nextRandom.and.returnValue(...).
    const runServiceSpy = jasmine.createSpyObj<RunService>('RunService', ['nextRandom']);
    runServiceSpy.nextRandom.and.returnValue(0);

    pathMutationSpy = jasmine.createSpyObj<PathMutationService>('PathMutationService', [
      'build', 'block', 'destroy', 'bridgehead',
    ]);
    // Default: successful mutation — overridden per test as needed.
    const defaultMutationOk: MutationResult = { ok: true, mutation: { id: '0', op: 'build', row: 0, col: 0, appliedOnTurn: 1, expiresOnTurn: null, priorType: 1 as never, source: 'card', sourceId: 'tf-1' } };
    pathMutationSpy.build.and.returnValue(defaultMutationOk);
    pathMutationSpy.block.and.returnValue(defaultMutationOk);
    pathMutationSpy.destroy.and.returnValue(defaultMutationOk);
    pathMutationSpy.bridgehead.and.returnValue(defaultMutationOk);

    // ElevationService: default spy returning successful ops.
    // Tests that exercise the elevation branch override per-test.
    const defaultElevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', [
      'raise', 'depress', 'getElevation', 'getMaxElevation', 'getElevationMap',
      'getActiveChanges', 'tickTurn', 'reset', 'serialize', 'restore', 'setAbsolute', 'collapse',
    ]);
    defaultElevationSpy.raise.and.returnValue({ ok: true, newElevation: 1 });
    defaultElevationSpy.depress.and.returnValue({ ok: true, newElevation: -1 });

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
        { provide: RunService, useValue: runServiceSpy },
        { provide: PathMutationService, useValue: pathMutationSpy },
        { provide: ElevationService, useValue: defaultElevationSpy },
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

    // Sprint 24 red-team Finding 1 — hasPendingCard must cover tile-target
    // mode so endTurn's hasPendingCard guard blocks turn resolution while a
    // terraform card is mid-resolution (otherwise the card gets discarded
    // but the pending pointer survives, enabling a free mutation on the
    // next tile click).
    it('returns true when a terraform card is pending (tile-target mode)', () => {
      service['pendingTileTargetCard'] = {
        instanceId: 'tf-1',
        cardId: CardId.LAY_TILE,
        upgraded: false,
      };
      expect(service.hasPendingCard()).toBeTrue();
    });

    it('returns true when BOTH a tower and a terraform card are pending (defensive)', () => {
      service['pendingTowerCard'] = {
        instanceId: 'tw-1',
        cardId: CardId.TOWER_BASIC,
        upgraded: false,
      };
      service['pendingTileTargetCard'] = {
        instanceId: 'tf-1',
        cardId: CardId.LAY_TILE,
        upgraded: false,
      };
      expect(service.hasPendingCard()).toBeTrue();
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

    // Phase 1 closer Finding 3 — FORTIFY must thread through the seeded run RNG.
    it('FORTIFY draws random tower index from RunService.nextRandom (seeded)', () => {
      const tower = { row: 0, col: 0, level: 1, type: TowerType.BASIC, totalInvested: 50 };
      const placedMap = new Map<string, typeof tower>();
      placedMap.set('0-0', tower as never);
      towerCombatSpy.getPlacedTowers.and.returnValue(placedMap as never);
      towerCombatSpy.upgradeTower.and.returnValue(tower as never);

      const runServiceSpy = TestBed.inject(RunService) as jasmine.SpyObj<RunService>;
      runServiceSpy.nextRandom.calls.reset();

      const card: CardInstance = { instanceId: 'fort-rng', cardId: CardId.FORTIFY, upgraded: false };
      service.onCardPlayed(card);

      expect(runServiceSpy.nextRandom).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should clear pending tower card state', () => {
      service['pendingTowerCard'] = { instanceId: 'x', cardId: CardId.TOWER_BASIC, upgraded: false };
      service.reset();
      expect(service.hasPendingCard()).toBeFalse();
      expect(service.getPendingCard()).toBeNull();
    });

    it('should clear pending tile-target state', () => {
      service['pendingTileTargetCard'] = makeTerraformInstance();
      service['pendingTileTargetEffect'] = makeTerraformEffect('build');
      service.reset();
      expect(service.getPendingTileTargetCard()).toBeNull();
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

  // ── Terraform tile-target infrastructure ────────────────────────────────────

  describe('isTerraformTargetEffect (type guard)', () => {
    it('returns true for terraform_target effects', () => {
      expect(isTerraformTargetEffect(makeTerraformEffect('build'))).toBeTrue();
    });

    it('returns false for non-terraform effects', () => {
      const spell = { type: 'spell' as const, spellId: 'gold_rush', value: 0 };
      expect(isTerraformTargetEffect(spell)).toBeFalse();
    });
  });

  describe('getPendingTileTargetCard', () => {
    it('returns null initially', () => {
      expect(service.getPendingTileTargetCard()).toBeNull();
    });

    it('returns the card after entering tile-target mode', () => {
      const card = makeTerraformInstance();
      service['pendingTileTargetCard'] = card;
      expect(service.getPendingTileTargetCard()).toBe(card);
    });
  });

  describe('onCardPlayed — terraform_target branch', () => {
    beforeEach(() => {
      // Register a terraform_target definition under SCOUT_AHEAD so that
      // getCardDefinition(CardId.SCOUT_AHEAD) returns a terraform effect.
      // Cost = 2 so the "insufficient energy" test can set current = 1.
      registerTerraformDef(2, 'build', null);
    });

    afterEach(() => {
      // Restore the real SCOUT_AHEAD definition for all other tests.
      unregisterTerraformDef();
    });

    it('does NOT spend energy — enters pending mode instead', () => {
      const onEnterTileTargetMode = jasmine.createSpy('onEnterTileTargetMode');
      service.init({
        onEnterPlacementMode: jasmine.createSpy(),
        onRefreshUI: jasmine.createSpy(),
        onSalvageComplete: jasmine.createSpy(),
        onEnterTileTargetMode,
      });

      service.onCardPlayed(makeTerraformInstance());

      expect(deckSpy.playCard).not.toHaveBeenCalled();
      expect(service.getPendingTileTargetCard()).not.toBeNull();
    });

    it('fires onEnterTileTargetMode callback with card and op', () => {
      const onEnterTileTargetMode = jasmine.createSpy('onEnterTileTargetMode');
      service.init({
        onEnterPlacementMode: jasmine.createSpy(),
        onRefreshUI: jasmine.createSpy(),
        onSalvageComplete: jasmine.createSpy(),
        onEnterTileTargetMode,
      });

      const card = makeTerraformInstance('tf-cb');
      service.onCardPlayed(card);

      expect(onEnterTileTargetMode).toHaveBeenCalledWith(card, 'build');
    });

    it('returns early (no pending state) when energy is insufficient', () => {
      deckSpy.getEnergy.and.returnValue({ current: 1, max: 3 } as EnergyState); // cost=2, energy=1
      const onEnterTileTargetMode = jasmine.createSpy('onEnterTileTargetMode');
      service.init({
        onEnterPlacementMode: jasmine.createSpy(),
        onRefreshUI: jasmine.createSpy(),
        onSalvageComplete: jasmine.createSpy(),
        onEnterTileTargetMode,
      });

      service.onCardPlayed(makeTerraformInstance());

      expect(service.getPendingTileTargetCard()).toBeNull();
      expect(onEnterTileTargetMode).not.toHaveBeenCalled();
    });

    it('cancels a pending tower card when a terraform card is played', () => {
      service.init({
        onEnterPlacementMode: jasmine.createSpy(),
        onRefreshUI: jasmine.createSpy(),
        onSalvageComplete: jasmine.createSpy(),
        onEnterTileTargetMode: jasmine.createSpy(),
      });

      // Put a tower card in pending state
      service['pendingTowerCard'] = { instanceId: 'tower-pending', cardId: CardId.TOWER_BASIC, upgraded: false };
      expect(service.hasPendingCard()).toBeTrue();

      // Play a terraform card — it should clear the tower card and swap
      // in a pending tile-target card. After the preemption:
      //   - pendingTowerCard is null (tower card was cancelled)
      //   - pendingTileTargetCard holds the new terraform card
      //   - hasPendingCard() still returns true because tile-target mode is
      //     now active (sprint-24 red-team Finding 1 broadened the getter).
      service.onCardPlayed(makeTerraformInstance());

      expect(service['pendingTowerCard']).toBeNull();
      expect(service.getPendingTileTargetCard()).not.toBeNull();
      expect(service.getPendingTileTargetCard()).not.toBeNull();
    });

    it('re-clicking the pending terraform card cancels tile-target mode', () => {
      const onExitTileTargetMode = jasmine.createSpy('onExitTileTargetMode');
      const onRefreshUI = jasmine.createSpy('onRefreshUI');
      service.init({
        onEnterPlacementMode: jasmine.createSpy(),
        onRefreshUI,
        onSalvageComplete: jasmine.createSpy(),
        onExitTileTargetMode,
      });

      const card = makeTerraformInstance('tf-cancel');
      // Put the card in pending state directly (simulates a prior onCardPlayed)
      service['pendingTileTargetCard'] = card;
      service['pendingTileTargetEffect'] = makeTerraformEffect('build');

      service.onCardPlayed(card);

      expect(service.getPendingTileTargetCard()).toBeNull();
      expect(onExitTileTargetMode).toHaveBeenCalled();
      expect(onRefreshUI).toHaveBeenCalled();
    });
  });

  describe('resolveTileTarget', () => {
    const mockScene = new THREE.Scene();
    const currentTurn = 5;

    // Each test that calls resolveTileTarget must have a registered def.
    // We set it per-test (different ops/durations) via registerTerraformDef().

    afterEach(() => {
      // Restore SCOUT_AHEAD so later non-terraform tests use the real def.
      unregisterTerraformDef();
    });

    it('returns no-pending-card when no card is awaiting a tile', () => {
      const result = service.resolveTileTarget(0, 0, mockScene, currentTurn);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('no-pending-card');
    });

    it('returns insufficient-energy and clears state when energy drops before tile pick', () => {
      registerTerraformDef(1, 'build', null);
      service['pendingTileTargetCard'] = makeTerraformInstance();
      service['pendingTileTargetEffect'] = makeTerraformEffect('build');
      // energy dropped to 0 between card click and tile click
      deckSpy.getEnergy.and.returnValue({ current: 0, max: 3 } as EnergyState);
      const result = service.resolveTileTarget(0, 0, mockScene, currentTurn);
      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('insufficient-energy');
      expect(service.getPendingTileTargetCard()).toBeNull();
    });

    it('routes build op → pathMutationService.build with correct args', () => {
      registerTerraformDef(1, 'build', null);
      const card = makeTerraformInstance('tf-build');
      service['pendingTileTargetCard'] = card;
      service['pendingTileTargetEffect'] = makeTerraformEffect('build', null);
      deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

      const result = service.resolveTileTarget(2, 3, mockScene, currentTurn);

      expect(result.ok).toBeTrue();
      expect(pathMutationSpy.build).toHaveBeenCalledWith(2, 3, null, 'tf-build', currentTurn, mockScene);
    });

    it('routes block op → pathMutationService.block with duration default (2) when null', () => {
      registerTerraformDef(1, 'block', null);
      const card = makeTerraformInstance('tf-block');
      service['pendingTileTargetCard'] = card;
      service['pendingTileTargetEffect'] = makeTerraformEffect('block', null); // null → default 2
      deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

      service.resolveTileTarget(1, 1, mockScene, currentTurn);

      expect(pathMutationSpy.block).toHaveBeenCalledWith(1, 1, 2, 'tf-block', currentTurn, mockScene);
    });

    it('routes block op with explicit duration (4)', () => {
      registerTerraformDef(1, 'block', 4);
      const card = makeTerraformInstance('tf-block-dur');
      service['pendingTileTargetCard'] = card;
      service['pendingTileTargetEffect'] = makeTerraformEffect('block', 4);
      deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

      service.resolveTileTarget(1, 1, mockScene, currentTurn);

      expect(pathMutationSpy.block).toHaveBeenCalledWith(1, 1, 4, 'tf-block-dur', currentTurn, mockScene);
    });

    it('routes destroy op → pathMutationService.destroy', () => {
      registerTerraformDef(1, 'destroy', null);
      const card = makeTerraformInstance('tf-destroy');
      service['pendingTileTargetCard'] = card;
      service['pendingTileTargetEffect'] = makeTerraformEffect('destroy', null);
      deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

      service.resolveTileTarget(3, 2, mockScene, currentTurn);

      expect(pathMutationSpy.destroy).toHaveBeenCalledWith(3, 2, 'tf-destroy', currentTurn, mockScene);
    });

    it('routes bridgehead op → pathMutationService.bridgehead with duration default (3) when null', () => {
      registerTerraformDef(1, 'bridgehead', null);
      const card = makeTerraformInstance('tf-bridge');
      service['pendingTileTargetCard'] = card;
      service['pendingTileTargetEffect'] = makeTerraformEffect('bridgehead', null); // null → default 3
      deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

      service.resolveTileTarget(0, 5, mockScene, currentTurn);

      expect(pathMutationSpy.bridgehead).toHaveBeenCalledWith(0, 5, 3, 'tf-bridge', currentTurn, mockScene);
    });

    it('on success: consumes card, clears pending state, fires onExitTileTargetMode', () => {
      registerTerraformDef(1, 'build', null);
      const onExitTileTargetMode = jasmine.createSpy('onExitTileTargetMode');
      service.init({
        onEnterPlacementMode: jasmine.createSpy(),
        onRefreshUI: jasmine.createSpy(),
        onSalvageComplete: jasmine.createSpy(),
        onExitTileTargetMode,
      });

      const card = makeTerraformInstance('tf-ok');
      service['pendingTileTargetCard'] = card;
      service['pendingTileTargetEffect'] = makeTerraformEffect('build', null);
      deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);
      pathMutationSpy.build.and.returnValue({ ok: true } as MutationResult);

      const result = service.resolveTileTarget(0, 0, mockScene, currentTurn);

      expect(result.ok).toBeTrue();
      expect(deckSpy.playCard).toHaveBeenCalledWith('tf-ok');
      expect(service.getPendingTileTargetCard()).toBeNull();
      expect(onExitTileTargetMode).toHaveBeenCalled();
    });

    it('on mutation rejection: does NOT clear pending state, does NOT spend energy', () => {
      registerTerraformDef(1, 'block', null);
      const rejection: MutationResult = { ok: false, reason: 'would-block-all-paths' };
      pathMutationSpy.block.and.returnValue(rejection);

      const card = makeTerraformInstance('tf-reject');
      service['pendingTileTargetCard'] = card;
      service['pendingTileTargetEffect'] = makeTerraformEffect('block', null);
      deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

      const result = service.resolveTileTarget(1, 1, mockScene, currentTurn);

      expect(result.ok).toBeFalse();
      expect(result.reason).toBe('would-block-all-paths');
      // Pending state preserved so player can pick a different tile
      expect(service.getPendingTileTargetCard()).not.toBeNull();
      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });

    // Phase 2 Sprint 17 — CARTOGRAPHER_SEAL (TERRAFORM_ANCHOR modifier)
    describe('TERRAFORM_ANCHOR modifier (CARTOGRAPHER_SEAL)', () => {
      beforeEach(() => {
        cardEffectSpy.hasActiveModifier.and.returnValue(true); // anchor active
      });

      it('forces build duration to null regardless of the card effect value', () => {
        registerTerraformDef(1, 'build', 2);  // nominal duration=2
        service['pendingTileTargetCard'] = makeTerraformInstance('tf-seal-build');
        service['pendingTileTargetEffect'] = makeTerraformEffect('build', 2);
        deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);
        pathMutationSpy.build.and.returnValue({ ok: true } as MutationResult);

        service.resolveTileTarget(2, 2, mockScene, currentTurn);

        expect(pathMutationSpy.build).toHaveBeenCalledWith(
          2, 2, null, 'tf-seal-build', currentTurn, mockScene,
        );
      });

      it('forces block duration to MAX_SAFE_INTEGER when anchored (effectively permanent)', () => {
        registerTerraformDef(1, 'block', 3);
        service['pendingTileTargetCard'] = makeTerraformInstance('tf-seal-block');
        service['pendingTileTargetEffect'] = makeTerraformEffect('block', 3);
        deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);
        pathMutationSpy.block.and.returnValue({ ok: true } as MutationResult);

        service.resolveTileTarget(0, 3, mockScene, currentTurn);

        expect(pathMutationSpy.block).toHaveBeenCalledWith(
          0, 3, Number.MAX_SAFE_INTEGER, 'tf-seal-block', currentTurn, mockScene,
        );
      });

      it('forces bridgehead duration to MAX_SAFE_INTEGER when anchored', () => {
        registerTerraformDef(2, 'bridgehead', 3);
        service['pendingTileTargetCard'] = makeTerraformInstance('tf-seal-bridge');
        service['pendingTileTargetEffect'] = makeTerraformEffect('bridgehead', 3);
        deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);
        pathMutationSpy.bridgehead.and.returnValue({ ok: true } as MutationResult);

        service.resolveTileTarget(2, 2, mockScene, currentTurn);

        expect(pathMutationSpy.bridgehead).toHaveBeenCalledWith(
          2, 2, Number.MAX_SAFE_INTEGER, 'tf-seal-bridge', currentTurn, mockScene,
        );
      });

      it('destroy op is unchanged — already permanent', () => {
        registerTerraformDef(2, 'destroy', null);
        service['pendingTileTargetCard'] = makeTerraformInstance('tf-seal-destroy');
        service['pendingTileTargetEffect'] = makeTerraformEffect('destroy', null);
        deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);
        pathMutationSpy.destroy.and.returnValue({ ok: true } as MutationResult);

        service.resolveTileTarget(0, 3, mockScene, currentTurn);

        // destroy() signature takes no duration — anchor state doesn't change the call.
        expect(pathMutationSpy.destroy).toHaveBeenCalledWith(
          0, 3, 'tf-seal-destroy', currentTurn, mockScene,
        );
      });

      it('when anchor is NOT active, block passes through the card-specified duration', () => {
        cardEffectSpy.hasActiveModifier.and.returnValue(false);
        registerTerraformDef(1, 'block', 3);
        service['pendingTileTargetCard'] = makeTerraformInstance('tf-no-seal');
        service['pendingTileTargetEffect'] = makeTerraformEffect('block', 3);
        deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);
        pathMutationSpy.block.and.returnValue({ ok: true } as MutationResult);

        service.resolveTileTarget(0, 3, mockScene, currentTurn);

        expect(pathMutationSpy.block).toHaveBeenCalledWith(
          0, 3, 3, 'tf-no-seal', currentTurn, mockScene,
        );
      });
    });

    // Phase 2 Sprint 16 — COLLAPSE damage-on-hit rider
    describe('damageOnHit rider (COLLAPSE)', () => {
      it('damages enemies on the tile when mutation succeeds', () => {
        registerTerraformDef(2, 'destroy', null);
        pathMutationSpy.destroy.and.returnValue({ ok: true } as MutationResult);

        const enemyOnTile = {
          id: 'e1',
          maxHealth: 200,
          gridPosition: { row: 4, col: 5 },
          dying: false,
        };
        const enemyOffTile = {
          id: 'e2',
          maxHealth: 200,
          gridPosition: { row: 0, col: 0 },
          dying: false,
        };
        const enemyMap = new Map<string, unknown>([['e1', enemyOnTile], ['e2', enemyOffTile]]);
        enemySpy.getEnemies.and.returnValue(enemyMap as never);

        const card = makeTerraformInstance('tf-collapse');
        service['pendingTileTargetCard'] = card;
        service['pendingTileTargetEffect'] = {
          type: 'terraform_target',
          op: 'destroy',
          duration: null,
          damageOnHit: { pctMaxHp: 0.5 },
        };
        deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

        const result = service.resolveTileTarget(4, 5, mockScene, currentTurn);

        expect(result.ok).toBeTrue();
        // floor(200 * 0.5) = 100
        expect(enemySpy.damageEnemy).toHaveBeenCalledWith('e1', 100);
        // Enemy off the tile was NOT damaged
        expect(enemySpy.damageEnemy).not.toHaveBeenCalledWith('e2', jasmine.anything());
      });

      it('skips dying enemies (already counted as killed)', () => {
        registerTerraformDef(2, 'destroy', null);
        pathMutationSpy.destroy.and.returnValue({ ok: true } as MutationResult);

        const dyingEnemy = {
          id: 'dying',
          maxHealth: 200,
          gridPosition: { row: 4, col: 5 },
          dying: true,
        };
        const enemyMap = new Map<string, unknown>([['dying', dyingEnemy]]);
        enemySpy.getEnemies.and.returnValue(enemyMap as never);

        service['pendingTileTargetCard'] = makeTerraformInstance('tf-collapse-dying');
        service['pendingTileTargetEffect'] = {
          type: 'terraform_target',
          op: 'destroy',
          duration: null,
          damageOnHit: { pctMaxHp: 0.5 },
        };
        deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

        service.resolveTileTarget(4, 5, mockScene, currentTurn);

        expect(enemySpy.damageEnemy).not.toHaveBeenCalled();
      });

      it('does NOT damage when mutation is rejected', () => {
        registerTerraformDef(2, 'destroy', null);
        pathMutationSpy.destroy.and.returnValue({ ok: false, reason: 'spawner-or-exit' });

        const enemyMap = new Map<string, unknown>([[
          'e1',
          { id: 'e1', maxHealth: 200, gridPosition: { row: 0, col: 0 }, dying: false },
        ]]);
        enemySpy.getEnemies.and.returnValue(enemyMap as never);

        service['pendingTileTargetCard'] = makeTerraformInstance('tf-collapse-reject');
        service['pendingTileTargetEffect'] = {
          type: 'terraform_target',
          op: 'destroy',
          duration: null,
          damageOnHit: { pctMaxHp: 0.5 },
        };
        deckSpy.getEnergy.and.returnValue({ current: 3, max: 3 } as EnergyState);

        const result = service.resolveTileTarget(0, 0, mockScene, currentTurn);

        expect(result.ok).toBeFalse();
        expect(enemySpy.damageEnemy).not.toHaveBeenCalled();
      });
    });
  });

  describe('cancelTileTarget', () => {
    it('clears pending state and fires onExitTileTargetMode', () => {
      const onExitTileTargetMode = jasmine.createSpy('onExitTileTargetMode');
      service.init({
        onEnterPlacementMode: jasmine.createSpy(),
        onRefreshUI: jasmine.createSpy(),
        onSalvageComplete: jasmine.createSpy(),
        onExitTileTargetMode,
      });

      service['pendingTileTargetCard'] = makeTerraformInstance();
      service['pendingTileTargetEffect'] = makeTerraformEffect('build');

      service.cancelTileTarget();

      expect(service.getPendingTileTargetCard()).toBeNull();
      expect(onExitTileTargetMode).toHaveBeenCalled();
    });

    it('does NOT spend energy on cancel', () => {
      service['pendingTileTargetCard'] = makeTerraformInstance();
      service['pendingTileTargetEffect'] = makeTerraformEffect('destroy');

      service.cancelTileTarget();

      expect(deckSpy.playCard).not.toHaveBeenCalled();
    });

    it('is a safe no-op when no card is pending', () => {
      expect(() => service.cancelTileTarget()).not.toThrow();
    });
  });

  // ── Phase 3 Highground — elevation-target card tests (Sprints 27/28) ──────

  describe('elevation-target card flow', () => {
    const mockScene = new THREE.Scene();
    const currentTurn = 3;

    let elevationSpy: jasmine.SpyObj<ElevationService>;

    // Synthetic CardId for elevation tests — avoids polluting real CARD_DEFINITIONS.
    const TEST_ELEVATION_CARD_ID = '__TEST_ELEV_CARD__' as CardId;

    function registerElevationDef(
      energyCost: number,
      op: 'raise' | 'depress',
      amount: number,
      duration: number | null,
      exposeEnemies?: boolean,
    ): void {
      (CARD_DEFINITIONS as Record<string, unknown>)[TEST_ELEVATION_CARD_ID] = {
        id: TEST_ELEVATION_CARD_ID,
        name: 'Test Elevation',
        description: 'Test',
        type: 'spell' as const,
        rarity: 'common' as const,
        energyCost,
        effect: { type: 'elevation_target', op, amount, duration, exposeEnemies },
        upgradedEffect: undefined,
        upgraded: false,
        archetype: 'highground' as const,
        terraform: true,
      };
    }

    function unregisterElevationDef(): void {
      delete (CARD_DEFINITIONS as Record<string, unknown>)[TEST_ELEVATION_CARD_ID];
    }

    function makeElevationInstance(instanceId = 'elev-1'): CardInstance {
      return { instanceId, cardId: TEST_ELEVATION_CARD_ID, upgraded: false };
    }

    beforeEach(() => {
      elevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', [
        'raise', 'depress', 'getElevation', 'getMaxElevation', 'getElevationMap',
        'getActiveChanges', 'tickTurn', 'reset', 'serialize', 'restore', 'setAbsolute', 'collapse',
      ]);
      // Default: successful elevation op.
      const okResult = { ok: true, newElevation: 1 };
      elevationSpy.raise.and.returnValue(okResult);
      elevationSpy.depress.and.returnValue({ ok: true, newElevation: -1 });

      // Inject elevationSpy into the service via private field (mirrors terraform test pattern).
      (service as unknown as { elevationService: ElevationService }).elevationService = elevationSpy;
    });

    afterEach(() => {
      unregisterElevationDef();
    });

    describe('onCardPlayed — entering elevation-target mode', () => {
      it('sets pending elevation state when a raise card is played', () => {
        registerElevationDef(1, 'raise', 1, null);
        const card = makeElevationInstance();

        service.onCardPlayed(card);

        expect(service['pendingElevationTargetCard']).toBe(card);
        expect(service['pendingElevationTargetEffect']?.op).toBe('raise');
      });

      it('sets pending elevation state when a depress card is played', () => {
        registerElevationDef(1, 'depress', 1, null, true);
        const card = makeElevationInstance();

        service.onCardPlayed(card);

        expect(service['pendingElevationTargetCard']).toBe(card);
        expect(service['pendingElevationTargetEffect']?.op).toBe('depress');
        expect(service['pendingElevationTargetEffect']?.exposeEnemies).toBeTrue();
      });

      it('does NOT enter elevation mode when energy is insufficient', () => {
        registerElevationDef(2, 'raise', 1, null);
        deckSpy.getEnergy.and.returnValue({ current: 1, max: 3 } as EnergyState);

        service.onCardPlayed(makeElevationInstance());

        expect(service['pendingElevationTargetCard']).toBeNull();
      });

      it('cancels pending tower card when elevation card is played', () => {
        const fakeTowerCard = { instanceId: 'tower-1', cardId: CardId.TOWER_BASIC, upgraded: false };
        service['pendingTowerCard'] = fakeTowerCard;

        registerElevationDef(1, 'raise', 1, null);
        service.onCardPlayed(makeElevationInstance());

        expect(service['pendingTowerCard']).toBeNull();
      });

      it('hasPendingCard returns true when elevation card is in limbo', () => {
        registerElevationDef(1, 'raise', 1, null);
        service.onCardPlayed(makeElevationInstance());

        expect(service.hasPendingCard()).toBeTrue();
      });
    });

    describe('resolveTileTarget — elevation branch', () => {
      it('routes raise op → elevationService.raise with correct args', () => {
        registerElevationDef(1, 'raise', 1, null);
        const card = makeElevationInstance('elev-raise');
        service['pendingElevationTargetCard'] = card;
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'raise', amount: 1, duration: null };

        const result = service.resolveTileTarget(2, 4, mockScene, currentTurn);

        expect(result.ok).toBeTrue();
        expect(elevationSpy.raise).toHaveBeenCalledWith(2, 4, 1, null, 'elev-raise', currentTurn);
      });

      it('routes depress op → elevationService.depress with correct args', () => {
        registerElevationDef(1, 'depress', 1, null, true);
        const card = makeElevationInstance('elev-depress');
        service['pendingElevationTargetCard'] = card;
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'depress', amount: 1, duration: null, exposeEnemies: true };

        const result = service.resolveTileTarget(3, 1, mockScene, currentTurn);

        expect(result.ok).toBeTrue();
        expect(elevationSpy.depress).toHaveBeenCalledWith(3, 1, 1, null, 'elev-depress', currentTurn);
      });

      it('consumes the card (calls deckService.playCard) on success', () => {
        registerElevationDef(1, 'raise', 1, null);
        service['pendingElevationTargetCard'] = makeElevationInstance('elev-consume');
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'raise', amount: 1, duration: null };

        service.resolveTileTarget(0, 0, mockScene, currentTurn);

        expect(deckSpy.playCard).toHaveBeenCalledWith('elev-consume');
      });

      it('clears pending elevation state on success', () => {
        registerElevationDef(1, 'raise', 1, null);
        service['pendingElevationTargetCard'] = makeElevationInstance();
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'raise', amount: 1, duration: null };

        service.resolveTileTarget(0, 0, mockScene, currentTurn);

        expect(service['pendingElevationTargetCard']).toBeNull();
        expect(service['pendingElevationTargetEffect']).toBeNull();
      });

      it('keeps pending state on board rejection so player can retry', () => {
        registerElevationDef(1, 'raise', 1, null);
        elevationSpy.raise.and.returnValue({ ok: false, reason: 'out-of-range' });

        const card = makeElevationInstance();
        service['pendingElevationTargetCard'] = card;
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'raise', amount: 1, duration: null };

        const result = service.resolveTileTarget(0, 0, mockScene, currentTurn);

        expect(result.ok).toBeFalse();
        expect(result.reason).toBe('out-of-range');
        // Pending state is preserved — player can pick another tile.
        expect(service['pendingElevationTargetCard']).toBe(card);
      });

      it('returns insufficient-energy and clears state when energy drops before tile pick', () => {
        registerElevationDef(2, 'raise', 1, null);
        service['pendingElevationTargetCard'] = makeElevationInstance();
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'raise', amount: 1, duration: null };
        deckSpy.getEnergy.and.returnValue({ current: 1, max: 3 } as EnergyState);

        const result = service.resolveTileTarget(0, 0, mockScene, currentTurn);

        expect(result.ok).toBeFalse();
        expect(result.reason).toBe('insufficient-energy');
        expect(service['pendingElevationTargetCard']).toBeNull();
      });

      it('does NOT call deckService.playCard on board rejection', () => {
        registerElevationDef(1, 'raise', 1, null);
        elevationSpy.raise.and.returnValue({ ok: false, reason: 'spawner-or-exit' });

        service['pendingElevationTargetCard'] = makeElevationInstance();
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'raise', amount: 1, duration: null };

        service.resolveTileTarget(0, 0, mockScene, currentTurn);

        expect(deckSpy.playCard).not.toHaveBeenCalled();
      });
    });

    describe('cancelTileTarget — covers elevation state', () => {
      it('clears pending elevation card on cancel', () => {
        service['pendingElevationTargetCard'] = makeElevationInstance();
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'raise', amount: 1, duration: null };

        service.cancelTileTarget();

        expect(service['pendingElevationTargetCard']).toBeNull();
        expect(service['pendingElevationTargetEffect']).toBeNull();
      });

      it('hasPendingCard returns false after cancel', () => {
        service['pendingElevationTargetCard'] = makeElevationInstance();
        service['pendingElevationTargetEffect'] = { type: 'elevation_target', op: 'raise', amount: 1, duration: null };

        service.cancelTileTarget();

        expect(service.hasPendingCard()).toBeFalse();
      });
    });
  });
});

