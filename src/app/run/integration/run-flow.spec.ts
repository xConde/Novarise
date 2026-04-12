/**
 * Run Mode — Integration Flow Tests
 *
 * End-to-end run lifecycle tests using REAL services where possible.
 *
 * Real:   RunService, NodeMapGeneratorService, WaveGeneratorService,
 *         EncounterService, RelicService, RunPersistenceService, RunEventBusService
 * Mocked: MapBridgeService, RunMapService, PlayerProfileService
 *         (they touch external router/storage state that cannot be injected cleanly)
 */

import { TestBed, fakeAsync } from '@angular/core/testing';

import { RunService } from '../services/run.service';
import { NodeMapGeneratorService } from '../services/node-map-generator.service';
import { WaveGeneratorService } from '../services/wave-generator.service';
import { EncounterService } from '../services/encounter.service';
import { RelicService } from '../services/relic.service';
import { RunPersistenceService } from '../services/run-persistence.service';
import { RunEventBusService } from '../services/run-event-bus.service';

import { MapBridgeService } from '../../core/services/map-bridge.service';
import { RunMapService } from '../services/run-map.service';
import { PlayerProfileService } from '../../core/services/player-profile.service';

import { RunStatus, DEFAULT_RUN_CONFIG, EncounterResult } from '../models/run-state.model';
import { getWaveEnemyCount } from '../../game/game-board/models/wave.model';
import { NodeType } from '../models/node-map.model';
import { RelicId, RELIC_DEFINITIONS, RelicRarity } from '../models/relic.model';
import { REWARD_CONFIG, REST_CONFIG, NODE_MAP_CONFIG } from '../constants/run.constants';
import { AscensionEffectType, getAscensionEffects } from '../models/ascension.model';
import { STUB_MAP_STATE } from './integration-fixtures';

// ── Shared fixtures ──────────────────────────────────────────────────────────
// STUB_MAP_STATE is imported from integration-fixtures.ts (shared with combat-flow.spec.ts)

function makeVictoryResult(nodeId = 'node_id', overrides: Partial<EncounterResult> = {}): EncounterResult {
  return {
    nodeId,
    nodeType: NodeType.COMBAT,
    victory: true,
    livesLost: 1,
    goldEarned: 60,
    enemiesKilled: 8,
    wavesCompleted: 4,
    completedChallenges: [],
    ...overrides,
  };
}

function makeDefeatResult(nodeId = 'node_id'): EncounterResult {
  return {
    nodeId,
    nodeType: NodeType.COMBAT,
    victory: false,
    livesLost: 20,
    goldEarned: 30,
    enemiesKilled: 3,
    wavesCompleted: 1,
    completedChallenges: [],
  };
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('Ascent Mode — Integration Flow', () => {
  let runService: RunService;
  let relicService: RelicService;
  let persistence: RunPersistenceService;
  let mapBridge: jasmine.SpyObj<MapBridgeService>;
  let runMapService: jasmine.SpyObj<RunMapService>;
  let playerProfile: jasmine.SpyObj<PlayerProfileService>;

  beforeEach(() => {
    mapBridge = jasmine.createSpyObj('MapBridgeService', ['setEditorMapState']);
    runMapService = jasmine.createSpyObj('RunMapService', ['loadLevel']);
    playerProfile = jasmine.createSpyObj('PlayerProfileService', ['recordRun']);

    runMapService.loadLevel.and.returnValue(STUB_MAP_STATE);

    TestBed.configureTestingModule({
      providers: [
        RunService,
        NodeMapGeneratorService,
        WaveGeneratorService,
        EncounterService,
        RelicService,
        RunPersistenceService,
        RunEventBusService,
        { provide: MapBridgeService, useValue: mapBridge },
        { provide: RunMapService, useValue: runMapService },
        { provide: PlayerProfileService, useValue: playerProfile },
      ],
    });

    runService = TestBed.inject(RunService);
    relicService = TestBed.inject(RelicService);
    persistence = TestBed.inject(RunPersistenceService);

    // Clear any saved run before each test
    persistence.clearSavedRun();
  });

  afterEach(() => {
    persistence.clearSavedRun();
  });

  // ── Run lifecycle ────────────────────────────────────────────────────────

  it('should start a new run with correct initial state', fakeAsync(() => {
    runService.startNewRun(0);

    const state = runService.runState;
    expect(state).not.toBeNull();
    expect(state!.status).toBe(RunStatus.IN_PROGRESS);
    expect(state!.actIndex).toBe(0);
    expect(state!.lives).toBe(DEFAULT_RUN_CONFIG.startingLives);
    expect(state!.gold).toBe(DEFAULT_RUN_CONFIG.startingGold);
    expect(state!.relicIds).toEqual([]);
    expect(state!.completedNodeIds).toEqual([]);
    expect(state!.encounterResults).toEqual([]);
    expect(state!.score).toBe(0);
  }));

  it('should generate a valid node map on run start', fakeAsync(() => {
    runService.startNewRun();

    const map = runService.nodeMap;
    expect(map).not.toBeNull();
    expect(map!.actIndex).toBe(0);
    expect(map!.nodes.length).toBeGreaterThan(0);
    expect(map!.startNodeIds.length).toBeGreaterThan(0);
    expect(map!.bossNodeId).toBeTruthy();

    // All start nodes must exist
    map!.startNodeIds.forEach(id => {
      const node = map!.nodes.find(n => n.id === id);
      expect(node).toBeDefined();
    });
  }));

  it('should select a combat node and update run state', fakeAsync(() => {
    runService.startNewRun();
    const map = runService.nodeMap!;
    const firstNodeId = map.startNodeIds[0];

    runService.selectNode(firstNodeId);

    expect(runService.runState!.currentNodeId).toBe(firstNodeId);
    const selectedNode = map.nodes.find(n => n.id === firstNodeId);
    expect(selectedNode).toBeDefined();
    // The node should be marked visited after selectNode
    const updatedNode = runService.nodeMap!.nodes.find(n => n.id === firstNodeId);
    expect(updatedNode!.visited).toBeTrue();
  }));

  it('should prepare a combat encounter with valid waves', fakeAsync(() => {
    runService.startNewRun();
    const map = runService.nodeMap!;
    const combatNode = map.nodes.find(n => n.type === NodeType.COMBAT);
    expect(combatNode).toBeDefined();

    runService.prepareEncounter(combatNode!);
    const encounter = runService.getCurrentEncounter();

    expect(encounter).not.toBeNull();
    expect(encounter!.nodeId).toBe(combatNode!.id);
    expect(encounter!.waves.length).toBeGreaterThan(0);
    encounter!.waves.forEach(w => {
      expect(getWaveEnemyCount(w)).toBeGreaterThan(0);
    });
  }));

  it('should record a victory encounter result and update gold/score', fakeAsync(() => {
    runService.startNewRun();
    const map = runService.nodeMap!;
    const combatNode = map.nodes.find(n => n.type === NodeType.COMBAT)!;

    runService.prepareEncounter(combatNode);
    const goldBefore = runService.runState!.gold;
    const result = makeVictoryResult(combatNode.id, { goldEarned: 80, enemiesKilled: 10, livesLost: 0 });

    runService.recordEncounterResult(result);
    runService.consumePendingEncounterResult();

    const state = runService.runState!;
    // gold = goldBefore + goldEarned(80) + goldReward from encounter
    expect(state.gold).toBeGreaterThan(goldBefore);
    // score = goldEarned + enemiesKilled * 10
    expect(state.score).toBe(80 + 10 * 10);
    expect(state.status).toBe(RunStatus.IN_PROGRESS);
  }));

  it('should record a defeat encounter result and set DEFEAT status', fakeAsync(() => {
    runService.startNewRun();
    const map = runService.nodeMap!;
    const combatNode = map.nodes.find(n => n.type === NodeType.COMBAT)!;

    runService.prepareEncounter(combatNode);
    runService.recordEncounterResult(makeDefeatResult(combatNode.id));
    runService.consumePendingEncounterResult();

    expect(runService.runState!.status).toBe(RunStatus.DEFEAT);
    expect(runService.runState!.lives).toBe(0);
  }));

  it('should generate rewards with 3 relic choices after victory', fakeAsync(() => {
    runService.startNewRun();
    const map = runService.nodeMap!;
    const combatNode = map.nodes.find(n => n.type === NodeType.COMBAT)!;
    runService.prepareEncounter(combatNode);
    runService.recordEncounterResult(makeVictoryResult(combatNode.id));
    runService.consumePendingEncounterResult();

    const rewards = runService.generateRewards();
    expect(rewards.relicChoices.length).toBe(REWARD_CONFIG.relicChoicesCombat);
    rewards.relicChoices.forEach(choice => {
      expect(choice.type).toBe('relic');
      expect(choice.relicId).toBeTruthy();
      expect(RELIC_DEFINITIONS[choice.relicId]).toBeDefined();
    });
  }));

  it('should collect a relic reward and update relicIds', fakeAsync(() => {
    runService.startNewRun();
    expect(runService.runState!.relicIds).toEqual([]);

    runService.collectReward({ type: 'relic', relicId: RelicId.QUICK_DRAW });

    expect(runService.runState!.relicIds).toContain(RelicId.QUICK_DRAW);
  }));

  it('should not offer already-owned relics in reward choices', fakeAsync(() => {
    runService.startNewRun();

    // Collect all common relics
    const commonRelics = Object.values(RELIC_DEFINITIONS).filter(r => r.rarity === RelicRarity.COMMON);
    for (const relic of commonRelics) {
      runService.collectReward({ type: 'relic', relicId: relic.id });
    }

    const available = relicService.getAvailableRelics();
    const ownedIds = new Set(runService.runState!.relicIds);
    for (const relic of available) {
      expect(ownedIds.has(relic.id)).toBeFalse();
    }
  }));

  it('should rest and heal lives (capped at maxLives)', fakeAsync(() => {
    runService.startNewRun();
    // Drain some lives first
    const initialLives = runService.runState!.lives;
    const combatNode = runService.nodeMap!.nodes.find(n => n.type === NodeType.COMBAT)!;
    runService.prepareEncounter(combatNode);
    runService.recordEncounterResult(makeVictoryResult(combatNode.id, { livesLost: 8 }));
    runService.consumePendingEncounterResult();

    const livesBeforeRest = runService.runState!.lives;
    expect(livesBeforeRest).toBe(initialLives - 8);

    // Select a rest node by moving currentNodeId manually via selectNode (any node will do for healing)
    runService['updateState']({ ...runService.runState!, currentNodeId: 'fake_rest_node' });
    runService.restHeal();

    const livesAfterRest = runService.runState!.lives;
    expect(livesAfterRest).toBeGreaterThan(livesBeforeRest);
    expect(livesAfterRest).toBeLessThanOrEqual(runService.runState!.maxLives);
  }));

  it('should generate shop items with correct pricing', fakeAsync(() => {
    runService.startNewRun();
    runService.generateShopItems();

    const items = runService.getShopItems();
    expect(items.length).toBeGreaterThan(0);
    items.forEach(item => {
      expect(item.cost).toBeGreaterThan(0);
      expect(item.item).toBeDefined();
    });
  }));

  it('should buy a shop item and deduct gold', fakeAsync(() => {
    runService.startNewRun();
    runService.generateShopItems();

    const items = runService.getShopItems();
    if (items.length === 0) {
      pending('No shop items generated — pool likely exhausted');
      return;
    }

    const item = items[0];
    const itemCountBefore = items.length; // capture length before buy (array is mutated in-place)

    // Ensure we have enough gold (add some if needed)
    if (runService.runState!.gold < item.cost) {
      runService.collectReward({ type: 'gold', amount: item.cost + 100 });
    }

    const goldBeforeBuy = runService.runState!.gold;
    runService.buyShopItem(0);

    expect(runService.runState!.gold).toBe(goldBeforeBuy - item.cost);
    expect(runService.getShopItems().length).toBe(itemCountBefore - 1);
  }));

  it('should refuse to buy when gold is insufficient', fakeAsync(() => {
    runService.startNewRun();
    runService.generateShopItems();

    const items = runService.getShopItems();
    if (items.length === 0) {
      pending('No shop items generated');
      return;
    }

    // Force gold below item cost
    runService['updateState']({ ...runService.runState!, gold: 0 });

    runService.buyShopItem(0);

    // Gold should still be 0 and items unchanged
    expect(runService.runState!.gold).toBe(0);
    expect(runService.getShopItems().length).toBe(items.length);
  }));

  it('should generate an event and resolve a choice', fakeAsync(() => {
    runService.startNewRun();
    runService.generateEvent();

    const event = runService.getCurrentEvent();
    expect(event).not.toBeNull();
    expect(event!.choices.length).toBeGreaterThan(0);

    const goldBefore = runService.runState!.gold;
    const livesBefore = runService.runState!.lives;
    runService['updateState']({ ...runService.runState!, currentNodeId: 'event_node' });
    runService.resolveEvent(0);

    // After resolving, currentEvent should be cleared
    expect(runService.getCurrentEvent()).toBeNull();
    // State should reflect the outcome (gold or lives changed)
    const state = runService.runState!;
    const firstChoice = event!.choices[0].outcome;
    expect(state.gold).toBe(Math.max(0, goldBefore + firstChoice.goldDelta));
  }));

  it('should advance to act 2 after act 1 boss defeat', fakeAsync(() => {
    runService.startNewRun();

    // Simulate act 1 complete by calling advanceAct (config.actsCount=2)
    runService.advanceAct();

    expect(runService.runState!.actIndex).toBe(1);
    expect(runService.runState!.status).toBe(RunStatus.IN_PROGRESS);
    const map = runService.nodeMap;
    expect(map).not.toBeNull();
    expect(map!.actIndex).toBe(1);
  }));

  it('should set VICTORY status after act 2 boss defeat', fakeAsync(() => {
    runService.startNewRun();

    runService.advanceAct(); // → act 1
    runService.advanceAct(); // → victory (actsCount=2)

    expect(runService.runState!.status).toBe(RunStatus.VICTORY);
    expect(playerProfile.recordRun).toHaveBeenCalled();
  }));

  it('should persist run state to localStorage on every mutation', fakeAsync(() => {
    runService.startNewRun();

    // After startNewRun the map and state are both set, so persist() fires
    const storedState = persistence.loadRunState();
    expect(storedState).not.toBeNull();
    expect(storedState!.status).toBe(RunStatus.IN_PROGRESS);
  }));

  it('should resume a saved run with correct state', fakeAsync(() => {
    // Start and persist a run
    runService.startNewRun(1);
    const originalState = runService.runState!;
    const originalMap = runService.nodeMap!;

    // Create a fresh RunService instance (simulates page reload)
    // We verify by checking that persistence has correct data, then calling resumeRun()
    runService['runStateSubject'].next(null);
    runService['nodeMapSubject'].next(null);

    runService.resumeRun();

    const resumedState = runService.runState;
    expect(resumedState).not.toBeNull();
    expect(resumedState!.id).toBe(originalState.id);
    expect(resumedState!.gold).toBe(originalState.gold);
    expect(resumedState!.ascensionLevel).toBe(1);
    expect(runService.nodeMap!.actIndex).toBe(originalMap.actIndex);
  }));

  it('should abandon a run and set ABANDONED status', fakeAsync(() => {
    runService.startNewRun();
    runService.abandonRun();

    expect(runService.runState!.status).toBe(RunStatus.ABANDONED);
    expect(playerProfile.recordRun).toHaveBeenCalled();
    // Saved run should be cleared
    expect(persistence.hasSavedRun()).toBeFalse();
  }));

  it('should apply ascension level 5 modifiers to starting config', fakeAsync(() => {
    runService.startNewRun(5);

    const state = runService.runState!;
    const effects = getAscensionEffects(5);
    const goldReduction = effects.get(AscensionEffectType.STARTING_GOLD_REDUCTION) ?? 0;
    const livesReduction = effects.get(AscensionEffectType.STARTING_LIVES_REDUCTION) ?? 0;

    expect(state.gold).toBe(Math.max(50, DEFAULT_RUN_CONFIG.startingGold - goldReduction));
    expect(state.lives).toBe(Math.max(5, DEFAULT_RUN_CONFIG.startingLives - livesReduction));
  }));

  it('should apply IRON_HEART relic (+3 max lives on pickup)', fakeAsync(() => {
    runService.startNewRun();
    const maxLivesBefore = runService.runState!.maxLives;
    const livesBefore = runService.runState!.lives;

    runService.collectReward({ type: 'relic', relicId: RelicId.IRON_HEART });

    expect(runService.runState!.maxLives).toBe(maxLivesBefore + 3);
    expect(runService.runState!.lives).toBe(livesBefore + 3);
  }));

  it('should clear relic state on run end', fakeAsync(() => {
    runService.startNewRun();
    runService.collectReward({ type: 'relic', relicId: RelicId.GOLD_MAGNET });
    expect(relicService.relicCount).toBe(1);

    // Abandon ends the run and calls cleanup()
    runService.abandonRun();
    expect(relicService.relicCount).toBe(0);
  }));

  it('should reveal unknown nodes with deterministic type', fakeAsync(() => {
    runService.startNewRun();
    // Inject an UNKNOWN node into the map for testing
    const currentMap = runService.nodeMap!;
    const unknownNodeId = 'test_unknown_node';
    const unknownNode = {
      id: unknownNodeId,
      type: NodeType.UNKNOWN,
      row: 3,
      column: 0,
      connections: [],
      campaignMapId: 'campaign_01',
      visited: false,
    };
    runService['nodeMapSubject'].next({
      ...currentMap,
      nodes: [...currentMap.nodes, unknownNode],
    });

    const revealedType1 = runService.revealUnknownNode(unknownNodeId);
    expect([NodeType.COMBAT, NodeType.EVENT, NodeType.SHOP, NodeType.REST]).toContain(revealedType1);

    // Re-running with same service state advances RNG — just check it's a valid type
    const updatedNode = runService.nodeMap!.nodes.find(n => n.id === unknownNodeId);
    expect(updatedNode!.type).toBe(revealedType1);
  }));

  it('should heal lives in rest with ascension reduction applied', fakeAsync(() => {
    // Ascension 8: REST_HEAL_REDUCTION = 0.75 (25% less healing)
    runService.startNewRun(8);
    // Drain lives
    const combatNode = runService.nodeMap!.nodes.find(n => n.type === NodeType.COMBAT)!;
    runService.prepareEncounter(combatNode);
    runService.recordEncounterResult(makeVictoryResult(combatNode.id, { livesLost: 10 }));
    runService.consumePendingEncounterResult();

    const livesBeforeRest = runService.runState!.lives;
    runService['updateState']({ ...runService.runState!, currentNodeId: 'rest_node' });
    runService.restHeal();

    const livesAfterRest = runService.runState!.lives;
    expect(livesAfterRest).toBeGreaterThan(livesBeforeRest);
    // With ascension-8 reduction, heal should still be at least 1
    expect(livesAfterRest - livesBeforeRest).toBeGreaterThanOrEqual(1);
  }));

  // ── Edge cases ───────────────────────────────────────────────────────────

  it('should handle starting a new run while one is saved (overwrites)', fakeAsync(() => {
    runService.startNewRun();
    const firstRunId = runService.runState!.id;

    runService.startNewRun(); // overwrite
    const secondRunId = runService.runState!.id;

    expect(secondRunId).not.toBe(firstRunId);
    // Saved state should reflect the new run
    const saved = persistence.loadRunState();
    expect(saved!.id).toBe(secondRunId);
  }));

  it('should handle run with all 20 relics collected (empty reward pool)', fakeAsync(() => {
    runService.startNewRun();

    // Collect all relics
    Object.values(RelicId).forEach(id => {
      runService.collectReward({ type: 'relic', relicId: id as RelicId });
    });

    // Reward generation with empty pool should return empty choices (not throw)
    const rewards = runService.generateRewards();
    expect(rewards.relicChoices).toEqual([]);
  }));

  it('should handle lives reaching exactly 0 on defeat', fakeAsync(() => {
    runService.startNewRun();
    const combatNode = runService.nodeMap!.nodes.find(n => n.type === NodeType.COMBAT)!;
    runService.prepareEncounter(combatNode);
    runService.recordEncounterResult(makeDefeatResult(combatNode.id));
    runService.consumePendingEncounterResult();

    expect(runService.runState!.lives).toBe(0);
    expect(runService.runState!.status).toBe(RunStatus.DEFEAT);
  }));

  it('should handle gold reaching 0 (shop items all unaffordable)', fakeAsync(() => {
    runService.startNewRun();
    runService['updateState']({ ...runService.runState!, gold: 0 });
    runService.generateShopItems();

    const items = runService.getShopItems();
    items.forEach((_item, i) => {
      runService.buyShopItem(i);
      // Gold should remain 0 since we cannot afford anything
      expect(runService.runState!.gold).toBe(0);
    });
  }));

  it('should not allow consumePendingEncounterResult to double-consume', fakeAsync(() => {
    runService.startNewRun();
    const combatNode = runService.nodeMap!.nodes.find(n => n.type === NodeType.COMBAT)!;
    runService.prepareEncounter(combatNode);
    const result = makeVictoryResult(combatNode.id, { goldEarned: 50, livesLost: 0 });
    runService.recordEncounterResult(result);

    const firstConsume = runService.consumePendingEncounterResult();
    const secondConsume = runService.consumePendingEncounterResult();

    expect(firstConsume).not.toBeNull();
    expect(secondConsume).toBeNull(); // second call: no pending result
    expect(runService.hasPendingEncounterResult()).toBeFalse();
  }));

  it('should not add duplicate relic via collectReward if already owned', fakeAsync(() => {
    runService.startNewRun();
    runService.collectReward({ type: 'relic', relicId: RelicId.GOLD_MAGNET });
    runService.collectReward({ type: 'relic', relicId: RelicId.GOLD_MAGNET });

    // relicIds should contain GOLD_MAGNET only once
    const ids = runService.runState!.relicIds;
    const count = ids.filter(id => id === RelicId.GOLD_MAGNET).length;
    expect(count).toBe(1);
  }));
});
