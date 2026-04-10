import { TestBed, fakeAsync } from '@angular/core/testing';
import { RunService } from './run.service';
import { NodeMapGeneratorService } from './node-map-generator.service';
import { EncounterService } from './encounter.service';
import { RelicService } from './relic.service';
import { RunPersistenceService } from './run-persistence.service';
import { RunEventBusService } from './run-event-bus.service';
import { RunStatus, DEFAULT_RUN_CONFIG, EncounterResult } from '../models/run-state.model';
import { NodeMap, MapNode, NodeType } from '../models/node-map.model';
import { EncounterConfig } from '../models/encounter.model';
import { RelicId } from '../models/relic.model';

// ── Test fixtures ───────────────────────────────────────────────

function makeNodeMap(bossNodeId = 'boss_0'): NodeMap {
  return {
    actIndex: 0,
    nodes: [
      {
        id: 'node_0_0',
        type: NodeType.COMBAT,
        row: 0,
        column: 0,
        connections: ['node_1_0'],
        campaignMapId: 'campaign_01',
        visited: false,
      },
      {
        id: 'node_1_0',
        type: NodeType.REST,
        row: 1,
        column: 0,
        connections: [bossNodeId],
        campaignMapId: 'campaign_02',
        visited: false,
      },
      {
        id: bossNodeId,
        type: NodeType.BOSS,
        row: 2,
        column: 0,
        connections: [],
        campaignMapId: 'campaign_03',
        visited: false,
      },
    ],
    startNodeIds: ['node_0_0'],
    bossNodeId,
    rows: 3,
  };
}

function makeEncounterConfig(overrides: Partial<EncounterConfig> = {}): EncounterConfig {
  return {
    nodeId: 'node_0_0',
    nodeType: NodeType.COMBAT,
    campaignMapId: 'campaign_01',
    waves: [],
    goldReward: 40,
    isElite: false,
    isBoss: false,
    ...overrides,
  };
}

function makeEncounterResult(overrides: Partial<EncounterResult> = {}): EncounterResult {
  return {
    nodeId: 'node_0_0',
    nodeType: NodeType.COMBAT,
    victory: true,
    livesLost: 2,
    goldEarned: 80,
    enemiesKilled: 10,
    wavesCompleted: 4,
    ...overrides,
  };
}

describe('RunService', () => {
  let service: RunService;
  let nodeMapGenerator: jasmine.SpyObj<NodeMapGeneratorService>;
  let encounterService: jasmine.SpyObj<EncounterService>;
  let relicService: jasmine.SpyObj<RelicService>;
  let persistence: jasmine.SpyObj<RunPersistenceService>;
  let eventBus: jasmine.SpyObj<RunEventBusService>;

  beforeEach(() => {
    const stubMap = makeNodeMap();

    nodeMapGenerator = jasmine.createSpyObj('NodeMapGeneratorService', ['generateActMap']);
    encounterService = jasmine.createSpyObj('EncounterService', [
      'prepareEncounter',
      'loadEncounterMap',
    ]);
    relicService = jasmine.createSpyObj('RelicService', [
      'clearRelics',
      'setActiveRelics',
      'resetEncounterState',
      'getAvailableRelics',
    ]);
    persistence = jasmine.createSpyObj('RunPersistenceService', [
      'clearSavedRun',
      'saveRunState',
      'loadRunState',
      'loadNodeMap',
      'hasSavedRun',
      'getMaxAscension',
      'setMaxAscension',
    ]);
    eventBus = jasmine.createSpyObj('RunEventBusService', ['emit']);

    nodeMapGenerator.generateActMap.and.returnValue(stubMap);
    encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
    encounterService.loadEncounterMap.and.stub();
    relicService.getAvailableRelics.and.returnValue([]);
    persistence.hasSavedRun.and.returnValue(false);
    persistence.getMaxAscension.and.returnValue(0);
    persistence.saveRunState.and.stub();
    persistence.clearSavedRun.and.stub();

    TestBed.configureTestingModule({
      providers: [
        RunService,
        { provide: NodeMapGeneratorService, useValue: nodeMapGenerator },
        { provide: EncounterService, useValue: encounterService },
        { provide: RelicService, useValue: relicService },
        { provide: RunPersistenceService, useValue: persistence },
        { provide: RunEventBusService, useValue: eventBus },
      ],
    });

    service = TestBed.inject(RunService);
  });

  // ── startNewRun ───────────────────────────────────────────────

  it('startNewRun() creates a RunState with IN_PROGRESS status', fakeAsync(() => {
    service.startNewRun();
    expect(service.runState).not.toBeNull();
    expect(service.runState!.status).toBe(RunStatus.IN_PROGRESS);
  }));

  it('startNewRun() initialises gold and lives from default config', fakeAsync(() => {
    service.startNewRun(0);
    expect(service.runState!.gold).toBe(DEFAULT_RUN_CONFIG.startingGold);
    expect(service.runState!.lives).toBe(DEFAULT_RUN_CONFIG.startingLives);
  }));

  it('startNewRun() generates act 0 node map', fakeAsync(() => {
    service.startNewRun();
    expect(nodeMapGenerator.generateActMap).toHaveBeenCalledWith(0, jasmine.any(Number));
    expect(service.nodeMap).not.toBeNull();
  }));

  it('startNewRun() clears relics and saved run', fakeAsync(() => {
    service.startNewRun();
    expect(persistence.clearSavedRun).toHaveBeenCalled();
    expect(relicService.clearRelics).toHaveBeenCalled();
  }));

  it('isInRun() returns true after startNewRun()', fakeAsync(() => {
    service.startNewRun();
    expect(service.isInRun()).toBeTrue();
  }));

  // ── Ascension modifiers ───────────────────────────────────────

  it('ascension level 3 reduces starting gold by 20', fakeAsync(() => {
    // Level 3 effect: STARTING_GOLD_REDUCTION = 20
    service.startNewRun(3);
    expect(service.runState!.gold).toBe(DEFAULT_RUN_CONFIG.startingGold - 20);
  }));

  it('ascension level 4 reduces starting lives by 2', fakeAsync(() => {
    // Level 4 effects: gold -20 (L3) + lives -2 (L4)
    service.startNewRun(4);
    expect(service.runState!.lives).toBe(DEFAULT_RUN_CONFIG.startingLives - 2);
  }));

  // ── selectNode ────────────────────────────────────────────────

  it('selectNode() updates currentNodeId on the run state', fakeAsync(() => {
    service.startNewRun();
    service.selectNode('node_0_0');
    expect(service.runState!.currentNodeId).toBe('node_0_0');
  }));

  it('selectNode() marks the node as visited in the nodeMap', fakeAsync(() => {
    service.startNewRun();
    service.selectNode('node_0_0');
    const node = service.nodeMap!.nodes.find(n => n.id === 'node_0_0');
    expect(node!.visited).toBeTrue();
  }));

  it('selectNode() ignores an unknown node ID', fakeAsync(() => {
    service.startNewRun();
    service.selectNode('nonexistent_node');
    expect(service.runState!.currentNodeId).toBeNull();
  }));

  // ── prepareEncounter ──────────────────────────────────────────

  it('prepareEncounter() delegates to EncounterService', fakeAsync(() => {
    service.startNewRun();
    const node = service.nodeMap!.nodes[0];
    service.prepareEncounter(node);
    expect(encounterService.prepareEncounter).toHaveBeenCalledWith(node, service.runState!);
    expect(encounterService.loadEncounterMap).toHaveBeenCalled();
  }));

  it('prepareEncounter() resets encounter state on RelicService', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);
    expect(relicService.resetEncounterState).toHaveBeenCalled();
  }));

  // ── recordEncounterResult / consumePendingEncounterResult ─────

  it('recordEncounterResult() stores a pending result', fakeAsync(() => {
    service.startNewRun();
    const result = makeEncounterResult();
    service.recordEncounterResult(result);
    expect(service.hasPendingEncounterResult()).toBeTrue();
  }));

  it('consumePendingEncounterResult() on victory: updates gold and score', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);

    const goldBefore = service.runState!.gold;
    const result = makeEncounterResult({ victory: true, goldEarned: 80, livesLost: 0, enemiesKilled: 10 });
    service.recordEncounterResult(result);
    service.consumePendingEncounterResult();

    // goldEarned(80) + goldReward from encounter config(40) = 120 added
    expect(service.runState!.gold).toBe(goldBefore + 80 + 40);
    // score: goldEarned + enemiesKilled * 10
    expect(service.runState!.score).toBe(80 + 10 * 10);
  }));

  it('consumePendingEncounterResult() on victory: adds node to completedNodeIds', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);
    const result = makeEncounterResult({ victory: true, nodeId: 'node_0_0' });
    service.recordEncounterResult(result);
    service.consumePendingEncounterResult();

    expect(service.runState!.completedNodeIds).toContain('node_0_0');
  }));

  it('consumePendingEncounterResult() on victory: deducts livesLost', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);
    const livesBefore = service.runState!.lives;
    const result = makeEncounterResult({ victory: true, livesLost: 3 });
    service.recordEncounterResult(result);
    service.consumePendingEncounterResult();

    expect(service.runState!.lives).toBe(livesBefore - 3);
  }));

  it('consumePendingEncounterResult() on defeat: sets DEFEAT status', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);
    const result = makeEncounterResult({ victory: false });
    service.recordEncounterResult(result);
    service.consumePendingEncounterResult();

    expect(service.runState!.status).toBe(RunStatus.DEFEAT);
    expect(service.runState!.lives).toBe(0);
  }));

  it('consumePendingEncounterResult() clears the pending result', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);
    service.recordEncounterResult(makeEncounterResult());
    service.consumePendingEncounterResult();
    expect(service.hasPendingEncounterResult()).toBeFalse();
  }));

  // ── restHeal ──────────────────────────────────────────────────

  it('restHeal() increases lives by at least REST_CONFIG.minHeal', fakeAsync(() => {
    service.startNewRun();
    // Burn some lives first
    service.prepareEncounter(service.nodeMap!.nodes[0]);
    const result = makeEncounterResult({ victory: true, livesLost: 10 });
    service.recordEncounterResult(result);
    service.consumePendingEncounterResult();

    const livesBefore = service.runState!.lives;
    service.selectNode('node_1_0');
    service.restHeal();

    expect(service.runState!.lives).toBeGreaterThan(livesBefore);
  }));

  it('restHeal() does not exceed maxLives', fakeAsync(() => {
    service.startNewRun(); // lives == maxLives == 20
    service.selectNode('node_1_0');
    service.restHeal();
    expect(service.runState!.lives).toBeLessThanOrEqual(service.runState!.maxLives);
  }));

  // ── collectReward ─────────────────────────────────────────────

  it('collectReward() with gold reward increases gold', fakeAsync(() => {
    service.startNewRun();
    const goldBefore = service.runState!.gold;
    service.collectReward({ type: 'gold', amount: 50 });
    expect(service.runState!.gold).toBe(goldBefore + 50);
  }));

  it('collectReward() with relic reward adds relicId to state', fakeAsync(() => {
    service.startNewRun();
    service.collectReward({ type: 'relic', relicId: RelicId.QUICK_DRAW });
    expect(service.runState!.relicIds).toContain(RelicId.QUICK_DRAW);
  }));

  it('collectReward() with IRON_HEART increases maxLives and lives by 3', fakeAsync(() => {
    service.startNewRun();
    const maxLivesBefore = service.runState!.maxLives;
    const livesBefore = service.runState!.lives;
    service.collectReward({ type: 'relic', relicId: RelicId.IRON_HEART });
    expect(service.runState!.maxLives).toBe(maxLivesBefore + 3);
    expect(service.runState!.lives).toBe(livesBefore + 3);
  }));

  it('collectReward() with relic updates RelicService active relics', fakeAsync(() => {
    service.startNewRun();
    service.collectReward({ type: 'relic', relicId: RelicId.COMMANDERS_BANNER });
    expect(relicService.setActiveRelics).toHaveBeenCalledWith(
      jasmine.arrayContaining([RelicId.COMMANDERS_BANNER]),
    );
  }));

  // ── advanceAct ────────────────────────────────────────────────

  it('advanceAct() generates the next act map when not the final act', fakeAsync(() => {
    service.startNewRun();
    nodeMapGenerator.generateActMap.calls.reset();

    service.advanceAct();

    expect(nodeMapGenerator.generateActMap).toHaveBeenCalledWith(1, jasmine.any(Number));
    expect(service.runState!.actIndex).toBe(1);
  }));

  it('advanceAct() sets VICTORY status when final act (actsCount=2) is complete', fakeAsync(() => {
    service.startNewRun();
    service.advanceAct(); // move to act 1
    service.advanceAct(); // act 1 → complete (actsCount=2)
    expect(service.runState!.status).toBe(RunStatus.VICTORY);
  }));

  it('advanceAct() calls persistence.setMaxAscension() on victory', fakeAsync(() => {
    service.startNewRun(); // ascensionLevel = 0
    service.advanceAct();
    service.advanceAct(); // triggers victory at level 0 → records level 1
    expect(persistence.setMaxAscension).toHaveBeenCalledWith(1);
  }));

  // ── abandonRun ───────────────────────────────────────────────

  it('abandonRun() sets ABANDONED status', fakeAsync(() => {
    service.startNewRun();
    service.abandonRun();
    expect(service.runState!.status).toBe(RunStatus.ABANDONED);
  }));

  it('abandonRun() is a no-op when no run is active', fakeAsync(() => {
    expect(() => service.abandonRun()).not.toThrow();
  }));

  // ── hasSavedRun / resumeRun ───────────────────────────────────

  it('hasSavedRun() delegates to persistence', fakeAsync(() => {
    persistence.hasSavedRun.and.returnValue(true);
    expect(service.hasSavedRun()).toBeTrue();
    expect(persistence.hasSavedRun).toHaveBeenCalled();
  }));

  it('resumeRun() restores state from persistence', fakeAsync(() => {
    const savedState = {
      id: 'run_saved',
      seed: 42,
      ascensionLevel: 1,
      config: DEFAULT_RUN_CONFIG,
      actIndex: 0,
      currentNodeId: null,
      completedNodeIds: ['node_0_0'],
      lives: 15,
      maxLives: 20,
      gold: 200,
      relicIds: [RelicId.QUICK_DRAW],
      encounterResults: [],
      status: RunStatus.IN_PROGRESS,
      startedAt: 999,
      score: 0,
    };
    const savedMap = makeNodeMap();

    persistence.loadRunState.and.returnValue(savedState);
    persistence.loadNodeMap.and.returnValue(savedMap);

    service.resumeRun();

    expect(service.runState!.id).toBe('run_saved');
    expect(service.runState!.gold).toBe(200);
    expect(service.nodeMap).toEqual(savedMap);
    expect(relicService.setActiveRelics).toHaveBeenCalledWith([RelicId.QUICK_DRAW]);
  }));

  it('resumeRun() is a no-op if persistence returns null', fakeAsync(() => {
    persistence.loadRunState.and.returnValue(null);
    persistence.loadNodeMap.and.returnValue(null);

    service.resumeRun();
    expect(service.runState).toBeNull();
  }));
});
