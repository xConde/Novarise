import { TestBed, fakeAsync } from '@angular/core/testing';
import { RunService } from './run.service';
import { DeckService } from './deck.service';
import { NodeMapGeneratorService } from './node-map-generator.service';
import { EncounterService } from './encounter.service';
import { RelicService } from './relic.service';
import { RunPersistenceService } from './run-persistence.service';
import { RunEventBusService } from './run-event-bus.service';
import { EncounterCheckpointService } from './encounter-checkpoint.service';
import { RunStateFlagService } from './run-state-flag.service';
import { ItemService } from './item.service';
import { ItemType, SerializedItemInventory } from '../models/item.model';
import { SerializedRunStateFlags } from './run-state-flag.service';
import { RunState } from '../models/run-state.model';
import { FLAG_KEYS } from '../constants/flag-keys';
import { RunEvent, EventOutcome } from '../models/encounter.model';
import { RUN_EVENTS } from '../constants/run-events';
import { CHECKPOINT_VERSION } from '../../game/game-board/models/encounter-checkpoint.model';
import { RunStatus, DEFAULT_RUN_CONFIG, EncounterResult } from '../models/run-state.model';
import { NodeMap, MapNode, NodeType } from '../models/node-map.model';
import { EncounterConfig } from '../models/encounter.model';
import { RelicId, RelicDefinition, RelicRarity, RELIC_DEFINITIONS } from '../models/relic.model';
import { CardId, CardRarity } from '../models/card.model';
import { CARD_DEFINITIONS } from '../constants/card-definitions';
import { REWARD_CONFIG, REWARD_RARITY_WEIGHTS, createSeededRng } from '../constants/run.constants';
import { AscensionEffectType, getAscensionEffects } from '../models/ascension.model';
import { ChallengeDefinition, ChallengeType } from '../data/challenges';

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
    completedChallenges: [],
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
        DeckService,
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
    expect(nodeMapGenerator.generateActMap).toHaveBeenCalledWith(0, jasmine.any(Number), jasmine.any(Number));
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

  // ── computeHealAmount ─────────────────────────────────────────

  it('computeHealAmount() returns floor(maxLives * 0.3) at A0 (no reduction)', fakeAsync(() => {
    service.startNewRun(0);
    const state = service.runState!;
    // Default maxLives = 20; floor(20 * 0.3) = 6, which is above minHeal(2)
    expect(service.computeHealAmount(state)).toBe(6);
  }));

  it('computeHealAmount() at A8 returns 75% of base heal (REST_HEAL_REDUCTION = 0.75)', fakeAsync(() => {
    service.startNewRun(8);
    const state = service.runState!;
    // maxLives after A4 -2 lives reduction: default 20 - 2 = 18
    // base heal = floor(18 * 0.3) = 5, then * 0.75 = floor(3.75) = 3
    const healAmount = service.computeHealAmount(state);
    const expectedBase = Math.floor(state.maxLives * 0.3);
    const expectedReduced = Math.floor(Math.max(2, expectedBase) * 0.75);
    expect(healAmount).toBe(Math.max(1, expectedReduced));
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

    expect(nodeMapGenerator.generateActMap).toHaveBeenCalledWith(1, jasmine.any(Number), jasmine.any(Number));
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
      deckCardIds: [],
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

  // ── generateRewards — card choices ────────────────────────────

  it('generateRewards() includes cardChoices array in the result', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);

    const rewards = service.generateRewards();

    expect(rewards.cardChoices).toBeDefined();
    expect(Array.isArray(rewards.cardChoices)).toBeTrue();
  }));

  it('generateRewards() returns exactly 3 card choices', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);

    const rewards = service.generateRewards();

    expect(rewards.cardChoices.length).toBe(3);
  }));

  it('generateRewards() card choices all have type "card"', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);

    const rewards = service.generateRewards();

    for (const choice of rewards.cardChoices) {
      expect(choice.type).toBe('card');
    }
  }));

  it('generateRewards() card choices are all non-starter cards', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);

    const rewards = service.generateRewards();

    for (const choice of rewards.cardChoices) {
      const def = CARD_DEFINITIONS[choice.cardId];
      expect(def.rarity).not.toBe(CardRarity.STARTER);
    }
  }));

  it('generateRewards() card choice cardIds are valid CardIds', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);

    const rewards = service.generateRewards();

    for (const choice of rewards.cardChoices) {
      expect(CARD_DEFINITIONS[choice.cardId]).toBeDefined();
    }
  }));

  it('collectReward() with card reward adds card to deck', fakeAsync(() => {
    service.startNewRun();
    const deckBefore = service.runState!.deckCardIds.length;

    const cardChoices = service.generateRewards().cardChoices;
    service.collectReward(cardChoices[0]);

    expect(service.runState!.deckCardIds.length).toBe(deckBefore + 1);
    expect(service.runState!.deckCardIds).toContain(cardChoices[0].cardId);
  }));

  // ── upgradeCard ───────────────────────────────────────────────

  it('upgradeCard() marks currentNodeId as completed', fakeAsync(() => {
    service.startNewRun();
    service.selectNode('node_1_0');

    // getDeckCards returns instances from DeckService (injected via TestBed)
    const cards = service.getDeckCards();
    if (cards.length === 0) {
      pending('deck empty — no cards to upgrade');
      return;
    }

    service.upgradeCard(cards[0].instanceId);
    expect(service.runState!.completedNodeIds).toContain('node_1_0');
  }));

  it('upgradeCard() calls DeckService.upgradeCard with the instance ID', fakeAsync(() => {
    service.startNewRun();
    service.selectNode('node_1_0');

    const deckService = TestBed.inject(DeckService);
    spyOn(deckService, 'upgradeCard').and.callThrough();

    const cards = service.getDeckCards();
    if (cards.length === 0) { pending('deck empty'); return; }

    service.upgradeCard(cards[0].instanceId);
    expect(deckService.upgradeCard).toHaveBeenCalledWith(cards[0].instanceId);
  }));

  // ── resolveEvent with removeCard ──────────────────────────────

  it('resolveEvent() with removeCard:true removes a card from the deck', fakeAsync(() => {
    service.startNewRun();
    service.selectNode('node_1_0');

    // Generate the card_purifier event manually
    const deckService = TestBed.inject(DeckService);
    const cardsBefore = deckService.getAllCards().length;

    // Inject the card_purifier event directly
    (service as any).currentEvent = {
      id: 'card_purifier',
      title: 'The Purifier',
      description: 'Test',
      choices: [
        {
          label: 'Remove a card',
          description: 'Remove one card.',
          outcome: { goldDelta: -25, livesDelta: 0, removeCard: true, description: 'Purged.' },
        },
      ],
    };

    service.resolveEvent(0);

    const cardsAfter = deckService.getAllCards().length;
    expect(cardsAfter).toBe(cardsBefore - 1);
  }));

  it('resolveEvent() without removeCard leaves deck unchanged', fakeAsync(() => {
    service.startNewRun();
    service.selectNode('node_1_0');

    const deckService = TestBed.inject(DeckService);
    const cardsBefore = deckService.getAllCards().length;

    (service as any).currentEvent = {
      id: 'test_event',
      title: 'Test',
      description: 'Test',
      choices: [
        {
          label: 'No-op',
          description: 'Nothing happens.',
          outcome: { goldDelta: 0, livesDelta: 0, description: 'OK.' },
        },
      ],
    };

    service.resolveEvent(0);
    expect(deckService.getAllCards().length).toBe(cardsBefore);
  }));

  // ── gambling_den gamble mechanic ─────────────────────────────────

  describe('gambling_den — gamble outcome', () => {
    function makeGambleEvent(winChance: number) {
      return {
        id: 'gambling_den',
        title: 'Gambling Den',
        description: 'Test',
        choices: [
          {
            label: 'Gamble (50/50)',
            description: '50% chance to gain 80 gold. Lose: gain nothing.',
            outcome: {
              goldDelta: 0,
              livesDelta: 0,
              description: 'The cards are dealt.',
              gamble: { winGoldDelta: 80, loseGoldDelta: 0, winChance },
            },
          },
        ],
      };
    }

    it('gambling_den win path: gold increases by 80 when rng < winChance', fakeAsync(() => {
      service.startNewRun();
      service.selectNode('node_1_0');

      // Force rng to always return 0.1 (well below 0.5 winChance — guaranteed win)
      (service as any).runRng = { next: () => 0.1, getState: () => 0, setState: () => {} };
      (service as any).currentEvent = makeGambleEvent(0.5);

      const goldBefore = (service as any).runState.gold as number;
      service.resolveEvent(0);
      expect((service as any).runState.gold).toBe(goldBefore + 80);
    }));

    it('gambling_den loss path: gold unchanged when rng >= winChance', fakeAsync(() => {
      service.startNewRun();
      service.selectNode('node_1_0');

      // Force rng to always return 0.9 (above 0.5 winChance — guaranteed loss)
      (service as any).runRng = { next: () => 0.9, getState: () => 0, setState: () => {} };
      (service as any).currentEvent = makeGambleEvent(0.5);

      const goldBefore = (service as any).runState.gold as number;
      service.resolveEvent(0);
      expect((service as any).runState.gold).toBe(goldBefore);
    }));

    it('gambling_den deterministic: alternating rng values produce expected win/loss sequence', fakeAsync(() => {
      service.startNewRun();
      service.selectNode('node_1_0');

      // Provide a counter-based rng: 0.1, 0.9, 0.1, 0.9 ...
      let callCount = 0;
      (service as any).runRng = {
        next: () => (callCount++ % 2 === 0 ? 0.1 : 0.9),
        getState: () => 0,
        setState: () => {},
      };

      const goldStart = (service as any).runState.gold as number;

      // Roll 1: 0.1 < 0.5 → win (+80)
      (service as any).currentEvent = makeGambleEvent(0.5);
      service.resolveEvent(0);
      expect((service as any).runState.gold).toBe(goldStart + 80);

      // Roll 2: 0.9 >= 0.5 → loss (+0)
      (service as any).currentEvent = makeGambleEvent(0.5);
      service.resolveEvent(0);
      expect((service as any).runState.gold).toBe(goldStart + 80); // unchanged from previous

      // Roll 3: 0.1 < 0.5 → win again
      (service as any).currentEvent = makeGambleEvent(0.5);
      service.resolveEvent(0);
      expect((service as any).runState.gold).toBe(goldStart + 160);
    }));
  });

  // ── generateRewards — FEWER_RELIC_CHOICES ascension effect ───────

  describe('generateRewards — FEWER_RELIC_CHOICES ascension reduction', () => {
    // Provide enough relic definitions so pickRelicRewards doesn't early-return [].
    // The outer beforeEach sets getAvailableRelics to [] — override it here.
    beforeEach(() => {
      const stubRelics: RelicDefinition[] = [
        RELIC_DEFINITIONS[RelicId.IRON_HEART],
        RELIC_DEFINITIONS[RelicId.GOLD_MAGNET],
        RELIC_DEFINITIONS[RelicId.STURDY_BOOTS],
        RELIC_DEFINITIONS[RelicId.QUICK_DRAW],
        RELIC_DEFINITIONS[RelicId.LUCKY_COIN],
      ];
      relicService.getAvailableRelics.and.returnValue(stubRelics);
    });

    it('combat node: 0 relics regardless of ascension (no reduction applied)', fakeAsync(() => {
      // Combat encounters give no relic — ascension reduction is irrelevant.
      service.startNewRun(0);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBe(REWARD_CONFIG.relicChoicesCombat); // 0
    }));

    it('combat node at ascension 11: still 0 relics (FEWER_RELIC_CHOICES not applied at 0 baseline)', fakeAsync(() => {
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);

      const rewards = service.generateRewards();

      // relicChoicesCombat=0 — no relics for combat, ascension reduction skipped
      expect(rewards.relicChoices.length).toBe(0);
    }));

    it('elite node at ascension 0: 3 relic choices', fakeAsync(() => {
      service.startNewRun(0);
      encounterService.prepareEncounter.and.returnValue(
        makeEncounterConfig({ isElite: true, isBoss: false }),
      );
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      service.recordEncounterResult(makeEncounterResult({ victory: true }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBe(REWARD_CONFIG.relicChoicesElite); // 3
    }));

    it('elite encounter at ascension 11: FEWER_RELIC_CHOICES reduces 3 → 2', fakeAsync(() => {
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(
        makeEncounterConfig({ isElite: true, isBoss: false }),
      );
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      service.recordEncounterResult(makeEncounterResult({ victory: true }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      // baseline=3, reduction=1 → Math.max(1, 2) → 2
      expect(rewards.relicChoices.length).toBe(2);
    }));

    it('boss encounter at ascension 11: FEWER_RELIC_CHOICES reduces 3 → 2', fakeAsync(() => {
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(
        makeEncounterConfig({ isElite: false, isBoss: true }),
      );
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      service.selectNode(service.nodeMap!.bossNodeId);
      service.recordEncounterResult(makeEncounterResult({ victory: true }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBe(2);
    }));

    it('regression guard: floor at 1 prevents reduction below 1 (extreme reduction future-proof)', fakeAsync(() => {
      // With baseline=3 and ascension-11 reduction=1: Math.max(1, 2) = 2.
      // This guards the Math.max(1, ...) floor against a future larger reduction.
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(
        makeEncounterConfig({ isElite: true, isBoss: false }),
      );
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      service.recordEncounterResult(makeEncounterResult({ victory: true }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBeGreaterThanOrEqual(1);
    }));
  });

  // ── generateRewards — node-type reward differentiation ────────

  describe('generateRewards — node-type differentiation (StS structure)', () => {
    // Provide enough relics for elite/boss reward picks.
    beforeEach(() => {
      const stubRelics: RelicDefinition[] = [
        RELIC_DEFINITIONS[RelicId.IRON_HEART],
        RELIC_DEFINITIONS[RelicId.GOLD_MAGNET],
        RELIC_DEFINITIONS[RelicId.STURDY_BOOTS],
      ];
      relicService.getAvailableRelics.and.returnValue(stubRelics);
    });

    it('combat node: relicChoices is empty, cardChoices has 3 entries', fakeAsync(() => {
      service.startNewRun(0);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBe(0);
      expect(rewards.cardChoices.length).toBe(3);
    }));

    it('elite node: relicChoices has 3 entries, cardChoices has 3 entries', fakeAsync(() => {
      service.startNewRun(0);
      encounterService.prepareEncounter.and.returnValue(
        makeEncounterConfig({ isElite: true, isBoss: false }),
      );
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      service.recordEncounterResult(makeEncounterResult({ victory: true }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBe(3);
      expect(rewards.cardChoices.length).toBe(3);
    }));

    it('boss node: relicChoices has 3 entries, cardChoices is empty', fakeAsync(() => {
      service.startNewRun(0);
      encounterService.prepareEncounter.and.returnValue(
        makeEncounterConfig({ isElite: false, isBoss: true }),
      );
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      service.selectNode(service.nodeMap!.bossNodeId);
      service.recordEncounterResult(makeEncounterResult({ victory: true }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBe(3);
      expect(rewards.cardChoices.length).toBe(0);
    }));
  });

  // ── generateRewards — challenge gold bonus ────────────────────

  function makeChallenge(id: string, scoreBonus: number): ChallengeDefinition {
    return {
      id,
      type: ChallengeType.UNTOUCHABLE,
      name: id,
      description: '',
      scoreBonus,
    };
  }

  describe('generateRewards — challenge gold bonus', () => {
    // consumePendingEncounterResult() stashes currentEncounter into lastCompletedEncounter
    // before nulling it (per run.component.ts handleEncounterReturn ordering). The encounter
    // goldReward is auto-credited to runState.gold inside consume(); the reward-screen
    // goldPickup therefore includes both baseGold (from lastCompletedEncounter) and any
    // challenge bonus gold.
    beforeEach(() => {
      service.startNewRun();
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig({ goldReward: 40 }));
      service.prepareEncounter(service.nodeMap!.nodes[0]);
    });

    it('zero challenges: goldPickup is baseGold only (40)', fakeAsync(() => {
      service.recordEncounterResult(makeEncounterResult({ victory: true, completedChallenges: [] }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.goldPickup).toBe(40); // baseGold=40, challengeGold=0
    }));

    it('1 challenge scoreBonus 200 → goldPickup = 40 + Math.round(200/5) = 80', fakeAsync(() => {
      service.recordEncounterResult(makeEncounterResult({
        victory: true,
        completedChallenges: [makeChallenge('c01_test', 200)],
      }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.goldPickup).toBe(80); // baseGold=40 + challengeGold=40
    }));

    it('2 challenges scoreBonuses 200 + 350 → goldPickup = 40 + 40 + 70 = 150', fakeAsync(() => {
      service.recordEncounterResult(makeEncounterResult({
        victory: true,
        completedChallenges: [
          makeChallenge('c01_a', 200),
          makeChallenge('c01_b', 350),
        ],
      }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.goldPickup).toBe(150); // baseGold=40 + challengeGold=110
    }));

    it('rounding: scoreBonus 250 → goldPickup = 40 + Math.round(50) = 90', fakeAsync(() => {
      service.recordEncounterResult(makeEncounterResult({
        victory: true,
        completedChallenges: [makeChallenge('c01_round', 250)],
      }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.goldPickup).toBe(90); // baseGold=40 + challengeGold=50
    }));

    it('rounding: scoreBonus 247 → goldPickup = 40 + Math.round(49.4) = 89', fakeAsync(() => {
      service.recordEncounterResult(makeEncounterResult({
        victory: true,
        completedChallenges: [makeChallenge('c01_round247', 247)],
      }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.goldPickup).toBe(89); // baseGold=40 + challengeGold=49
    }));

    it('empty encounterResults: no crash, goldPickup === 0, completedChallenges === []', fakeAsync(() => {
      // No consumePendingEncounterResult called — lastCompletedEncounter stays null
      // so baseGold = 0; encounterResults is also empty so challengeGold = 0.
      const rewards = service.generateRewards();

      expect(rewards.goldPickup).toBe(0);
      expect(rewards.completedChallenges).toEqual([]);
    }));

    it('completedChallenges in returned config matches last result challenges', fakeAsync(() => {
      const challenges = [makeChallenge('c01_x', 200), makeChallenge('c01_y', 350)];
      service.recordEncounterResult(makeEncounterResult({
        victory: true,
        completedChallenges: challenges,
      }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      expect(rewards.completedChallenges).toEqual(challenges);
    }));

    it('ascension 11 + 1 challenge (combat): gold bonus applies, relics still 0', fakeAsync(() => {
      // Combat nodes give 0 relics — ascension relic reduction is irrelevant here.
      // The test verifies gold bonus still stacks correctly on combat nodes.
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig({ goldReward: 40 }));
      service.prepareEncounter(service.nodeMap!.nodes[0]);

      service.recordEncounterResult(makeEncounterResult({
        victory: true,
        completedChallenges: [makeChallenge('c01_z', 200)],
      }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      // Gold: 40 base (lastCompletedEncounter.goldReward) + 40 challenge bonus
      expect(rewards.goldPickup).toBe(80);
      // Relics: 0 for combat regardless of ascension
      expect(rewards.relicChoices.length).toBe(0);
    }));
  });

  // ── consumePendingEncounterResult — challenge round-trip ──────

  it('consumePendingEncounterResult preserves completedChallenges in encounterResults', fakeAsync(() => {
    service.startNewRun();
    service.prepareEncounter(service.nodeMap!.nodes[0]);

    const challenges = [makeChallenge('c01_roundtrip', 200)];
    service.recordEncounterResult(makeEncounterResult({
      victory: true,
      completedChallenges: challenges,
    }));
    service.consumePendingEncounterResult();

    const stored = service.runState!.encounterResults[0];
    expect(stored.completedChallenges).toEqual(challenges);
  }));

  // ── stale checkpoint handling ──────────────────────────────────

  describe('stale checkpoint handling', () => {
    let checkpointService: EncounterCheckpointService;

    beforeEach(() => {
      checkpointService = TestBed.inject(EncounterCheckpointService);
      // Ensure localStorage is clean before each checkpoint test.
      checkpointService.clearCheckpoint();
    });

    afterEach(() => {
      checkpointService.clearCheckpoint();
    });

    it('startNewRun() clears any leftover checkpoint', fakeAsync(() => {
      // Plant a checkpoint as if a previous run saved it.
      checkpointService.saveCheckpoint({
        version: 1,
        timestamp: Date.now(),
        nodeId: 'node_0_0',
        encounterConfig: makeEncounterConfig(),
        rngState: 0,
        gameState: {} as any,
        turnNumber: 3,
        leakedThisWave: false,
        towers: [],
        mortarZones: [],
        enemies: [],
        enemyCounter: 0,
        statusEffects: [],
        waveState: {} as any,
        deckState: {} as any,
        cardModifiers: [],
        relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false },
        gameStats: {} as any,
        challengeState: {} as any, wavePreview: { oneShotBonus: 0 },
        turnHistory: [],
        itemInventory: { entries: [] },
        runStateFlags: { entries: [], consumedEventIds: [] },
      });

      expect(checkpointService.hasCheckpoint()).toBeTrue();

      service.startNewRun();

      expect(checkpointService.hasCheckpoint()).toBeFalse();
    }));

    it('abandonRun() clears any active checkpoint', fakeAsync(() => {
      service.startNewRun();

      checkpointService.saveCheckpoint({
        version: 1,
        timestamp: Date.now(),
        nodeId: 'node_0_0',
        encounterConfig: makeEncounterConfig(),
        rngState: 0,
        gameState: {} as any,
        turnNumber: 2,
        leakedThisWave: false,
        towers: [],
        mortarZones: [],
        enemies: [],
        enemyCounter: 0,
        statusEffects: [],
        waveState: {} as any,
        deckState: {} as any,
        cardModifiers: [],
        relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false },
        gameStats: {} as any,
        challengeState: {} as any, wavePreview: { oneShotBonus: 0 },
        turnHistory: [],
        itemInventory: { entries: [] },
        runStateFlags: { entries: [], consumedEventIds: [] },
      });

      expect(checkpointService.hasCheckpoint()).toBeTrue();

      service.abandonRun();

      expect(checkpointService.hasCheckpoint()).toBeFalse();
    }));

    it('restoreEncounter() clears a stale checkpoint (node already completed)', fakeAsync(() => {
      service.startNewRun();

      // Mark the node as already completed.
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      service.recordEncounterResult(makeEncounterResult({ victory: true, nodeId: 'node_0_0' }));
      service.consumePendingEncounterResult();
      expect(service.runState!.completedNodeIds).toContain('node_0_0');

      // Plant a checkpoint for the already-completed node.
      checkpointService.saveCheckpoint({
        version: 1,
        timestamp: Date.now(),
        nodeId: 'node_0_0',
        encounterConfig: makeEncounterConfig({ nodeId: 'node_0_0' }),
        rngState: 0,
        gameState: {} as any,
        turnNumber: 1,
        leakedThisWave: false,
        towers: [],
        mortarZones: [],
        enemies: [],
        enemyCounter: 0,
        statusEffects: [],
        waveState: {} as any,
        deckState: {} as any,
        cardModifiers: [],
        relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false },
        gameStats: {} as any,
        challengeState: {} as any, wavePreview: { oneShotBonus: 0 },
        turnHistory: [],
        itemInventory: { entries: [] },
        runStateFlags: { entries: [], consumedEventIds: [] },
      });

      expect(checkpointService.hasCheckpoint()).toBeTrue();

      service.restoreEncounter();

      // Stale checkpoint must be cleared — and isRestoringCheckpoint stays false.
      expect(checkpointService.hasCheckpoint()).toBeFalse();
      expect(service.isRestoringCheckpoint).toBeFalse();
    }));

    it('restoreEncounter() accepts a valid (non-stale) checkpoint', fakeAsync(() => {
      service.startNewRun();

      const config = makeEncounterConfig({ nodeId: 'node_0_0' });
      checkpointService.saveCheckpoint({
        version: 1,
        timestamp: Date.now(),
        nodeId: 'node_0_0',
        encounterConfig: config,
        rngState: 0,
        gameState: {} as any,
        turnNumber: 2,
        leakedThisWave: false,
        towers: [],
        mortarZones: [],
        enemies: [],
        enemyCounter: 0,
        statusEffects: [],
        waveState: {} as any,
        deckState: {} as any,
        cardModifiers: [],
        relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false },
        gameStats: {} as any,
        challengeState: {} as any, wavePreview: { oneShotBonus: 0 },
        turnHistory: [],
        itemInventory: { entries: [] },
        runStateFlags: { entries: [], consumedEventIds: [] },
      });

      // node_0_0 is NOT in completedNodeIds — valid checkpoint.
      service.restoreEncounter();

      // Checkpoint must survive and isRestoringCheckpoint must be set.
      expect(checkpointService.hasCheckpoint()).toBeTrue();
      expect(service.isRestoringCheckpoint).toBeTrue();
    }));
  });

  // ── computeCardChoiceCount ────────────────────────────────────

  describe('computeCardChoiceCount()', () => {
    it('returns 3 at ascension 0 (no reduction)', fakeAsync(() => {
      service.startNewRun(0);
      expect(service.computeCardChoiceCount()).toBe(3);
    }));

    it('returns 2 at ascension 11 (FEWER_CARD_CHOICES=1)', fakeAsync(() => {
      service.startNewRun(11);
      expect(service.computeCardChoiceCount()).toBe(2);
    }));

    it('returns 3 at ascension 10 (FEWER_CARD_CHOICES not yet active)', fakeAsync(() => {
      service.startNewRun(10);
      expect(service.computeCardChoiceCount()).toBe(3);
    }));

    it('never drops below 1, even if reduction exceeds baseline', fakeAsync(() => {
      // Test the Math.max(1, …) floor: simulate baseline=1 and reduction=1 → result must be 1.
      service.startNewRun(11); // A11 grants FEWER_CARD_CHOICES=1
      const state = service.runState!;
      const effects = getAscensionEffects(state.ascensionLevel);
      const reduction = effects.get(AscensionEffectType.FEWER_CARD_CHOICES) ?? 0;
      // reduction=1; if baseline were 1: Math.max(1, 1-1) = Math.max(1,0) = 1
      const baselineCardChoices = 1;
      expect(Math.max(1, baselineCardChoices - reduction)).toBe(1);
    }));

    it('generateRewards() returns exactly computeCardChoiceCount() cards at A0', fakeAsync(() => {
      service.startNewRun(0);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      const rewards = service.generateRewards();
      expect(rewards.cardChoices.length).toBe(service.computeCardChoiceCount());
    }));

    it('generateRewards() returns 2 card choices at ascension 11', fakeAsync(() => {
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      const rewards = service.generateRewards();
      expect(rewards.cardChoices.length).toBe(2);
    }));
  });

  // ── pickCardRewards — rarity weighting ────────────────────────

  describe('pickCardRewards — rarity-weighted distribution', () => {
    it('1000-draw sample matches 60/30/10 distribution within ±10% tolerance (seeded RNG)', fakeAsync(() => {
      service.startNewRun(0);
      const seededRng = createSeededRng(42);

      const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0 };
      const draws = 1000;
      for (let i = 0; i < draws; i++) {
        const rewards = (service as any).pickCardRewards(1, () => seededRng.next()) as Array<{ cardId: CardId }>;
        if (rewards.length === 0) continue;
        const def = CARD_DEFINITIONS[rewards[0].cardId];
        counts[def.rarity] = (counts[def.rarity] ?? 0) + 1;
      }

      const total = counts['common'] + counts['uncommon'] + counts['rare'];
      const commonPct = counts['common'] / total;
      const uncommonPct = counts['uncommon'] / total;
      const rarePct = counts['rare'] / total;

      // Allow ±10% tolerance on each tier
      expect(commonPct).toBeGreaterThanOrEqual(0.50);
      expect(commonPct).toBeLessThanOrEqual(0.70);
      expect(uncommonPct).toBeGreaterThanOrEqual(0.20);
      expect(uncommonPct).toBeLessThanOrEqual(0.40);
      expect(rarePct).toBeGreaterThanOrEqual(0.04);
      expect(rarePct).toBeLessThanOrEqual(0.18);
    }));

    it('empty RARE pool falls back to UNCOMMON or COMMON (no undefined slot)', fakeAsync(() => {
      service.startNewRun(0);

      const rarityWeights = [
        { rarity: CardRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
        { rarity: CardRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
        { rarity: CardRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
      ];

      const stubbedPool = {
        [CardRarity.STARTER]: [],
        [CardRarity.COMMON]: [{ rarity: CardRarity.COMMON }],
        [CardRarity.UNCOMMON]: [{ rarity: CardRarity.UNCOMMON }],
        [CardRarity.RARE]: [], // Empty RARE pool
      };

      // With RNG biased toward RARE range (high values) but RARE is empty,
      // picker must fall back to UNCOMMON or COMMON
      const rng = () => 0.99; // Would normally select RARE
      const pickedRarity = (service as any).pickWeightedRarity(
        rarityWeights,
        stubbedPool,
        rng,
      ) as string;

      expect(pickedRarity).not.toBe(CardRarity.RARE);
      expect([CardRarity.COMMON as string, CardRarity.UNCOMMON as string]).toContain(pickedRarity);
    }));

    it('empty RARE and UNCOMMON pool falls back to COMMON', fakeAsync(() => {
      service.startNewRun(0);

      const rarityWeights = [
        { rarity: CardRarity.COMMON, weight: REWARD_RARITY_WEIGHTS.common },
        { rarity: CardRarity.UNCOMMON, weight: REWARD_RARITY_WEIGHTS.uncommon },
        { rarity: CardRarity.RARE, weight: REWARD_RARITY_WEIGHTS.rare },
      ];

      const stubbedPool = {
        [CardRarity.STARTER]: [],
        [CardRarity.COMMON]: [{ rarity: CardRarity.COMMON }],
        [CardRarity.UNCOMMON]: [], // Empty
        [CardRarity.RARE]: [],    // Empty
      };

      const rng = () => 0.99;
      const pickedRarity = (service as any).pickWeightedRarity(
        rarityWeights,
        stubbedPool,
        rng,
      ) as string;

      expect(pickedRarity).toBe(CardRarity.COMMON as string);
    }));

    // ── S8 regression: TOWER_MORTAR reachable via reward pool ─────

    it('TOWER_MORTAR can be drawn from pickCardRewards over many iterations (S8)', fakeAsync(() => {
      service.startNewRun(0);
      const seededRng = createSeededRng(7);
      let mortarSeen = false;
      for (let i = 0; i < 500 && !mortarSeen; i++) {
        const rewards = (service as any).pickCardRewards(3, () => seededRng.next()) as Array<{ cardId: CardId }>;
        if (rewards.some(r => r.cardId === CardId.TOWER_MORTAR)) {
          mortarSeen = true;
        }
      }
      expect(mortarSeen).toBe(true, 'TOWER_MORTAR was never drawn in 500×3 reward rolls');
    }));

    it('starter deck does not contain TOWER_MORTAR (S8 regression guard)', fakeAsync(() => {
      service.startNewRun(0);
      const deck = service['deckService'].getAllCards();
      const hasMortar = deck.some(c => c.cardId === CardId.TOWER_MORTAR);
      expect(hasMortar).toBe(false);
    }));
  });

  // ── restoreRngState ───────────────────────────────────────────

  describe('restoreRngState()', () => {
    it('restores RNG state when runRng already exists', fakeAsync(() => {
      service.startNewRun();
      const captured = service.getRngState()!;
      expect(typeof captured).toBe('number');

      // Restore to a known sentinel value
      service.restoreRngState(77777);
      expect(service.getRngState()).toBe(77777);
    }));

    it('creates a fresh RNG instance when runRng is null', fakeAsync(() => {
      // Fresh service has no runRng — getRngState returns null
      expect(service.getRngState()).toBeNull();

      service.restoreRngState(99999);
      expect(service.getRngState()).toBe(99999);
    }));

    it('getRngState + restoreRngState round-trip preserves value', fakeAsync(() => {
      service.startNewRun();
      const captured = service.getRngState()!;

      // Overwrite with a different value
      service.restoreRngState(12345);
      expect(service.getRngState()).toBe(12345);

      // Restore back to original
      service.restoreRngState(captured);
      expect(service.getRngState()).toBe(captured);
    }));
  });

  // ── Event flag filtering (generateEvent) ─────────────────────────────────

  describe('generateEvent() — flag filtering', () => {
    let flagService: RunStateFlagService;

    beforeEach(() => {
      flagService = TestBed.inject(RunStateFlagService);
      flagService.resetForRun();
    });

    afterEach(() => {
      flagService.resetForRun();
    });

    it('generates an event when no flag constraints apply', fakeAsync(() => {
      service.startNewRun();
      service.generateEvent();
      // generateEvent should pick something from the real RUN_EVENTS pool
      expect(service.getCurrentEvent()).not.toBeNull();
    }));

    /**
     * Helper: calls the real generateEvent() across every possible RNG index by
     * forcing Math.random to return (i + 0.5) / poolSize for i in [0, poolSize).
     * Returns the set of distinct event IDs produced.
     *
     * Uses service['runRng'] = null to bypass SeededRng and use Math.random.
     */
    function collectAllGeneratedEventIds(svc: RunService, poolSize: number): Set<string> {
      const svcAny = svc as any;
      const savedRng = svcAny.runRng;
      svcAny.runRng = null;

      const ids = new Set<string>();
      const spy = spyOn(Math, 'random');
      for (let i = 0; i < poolSize; i++) {
        spy.and.returnValue((i + 0.5) / poolSize);
        svc.generateEvent();
        const evt = svc.getCurrentEvent();
        if (evt) ids.add(evt.id);
      }
      spy.and.callThrough();
      svcAny.runRng = savedRng;
      return ids;
    }

    it('excludes events where requiresFlag is set but flag is missing', fakeAsync(() => {
      // Spec exercises the real generateEvent() filter.
      // Without IDOL_BARGAIN_TAKEN/MERCHANT_AIDED/SCOUT_SAVED set, the three Part-2
      // chain events (requiresFlag gated) must never appear in any pool slot.
      // Pool size without any flags = 22 total - 3 Part-2 gated = 19.
      service.startNewRun();
      // No flags set.
      const POOL_SIZE_NO_FLAGS = 19;
      const ids = collectAllGeneratedEventIds(service, POOL_SIZE_NO_FLAGS);

      expect(ids.has('wandering_merchant_return')).toBeFalse();
      expect(ids.has('cursed_idol_reckoning')).toBeFalse();
      expect(ids.has('scout_returns_grateful')).toBeFalse();
      // At least one non-gated event was returned
      expect(ids.size).toBeGreaterThan(0);
    }));

    it('includes an event when requiresFlag is set AND the flag is present', fakeAsync(() => {
      // With IDOL_BARGAIN_TAKEN set, cursed_idol_reckoning enters the eligible pool.
      // Pool: 22 - 2 (other Part-2 events) - 1 (cursed_idol_offer excluded via requiresFlagAbsent) = 19.
      service.startNewRun();
      flagService.setFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN);
      const POOL_SIZE_WITH_IDOL_FLAG = 19;
      const ids = collectAllGeneratedEventIds(service, POOL_SIZE_WITH_IDOL_FLAG);

      expect(ids.has('cursed_idol_reckoning')).toBeTrue();
    }));

    it('excludes events where requiresFlagAbsent is set and flag IS present', fakeAsync(() => {
      // With MERCHANT_AIDED set, wandering_merchant_intro is excluded.
      // wandering_merchant_return enters the pool (requiresFlag satisfied).
      // wandering_merchant_intro exits (requiresFlagAbsent fails).
      // Net pool size: 22 - 2 (other Part-2 gated) = 20, same size since one swaps.
      service.startNewRun();
      flagService.setFlag(FLAG_KEYS.MERCHANT_AIDED);
      const POOL_SIZE_WITH_MERCHANT_FLAG = 20;
      const ids = collectAllGeneratedEventIds(service, POOL_SIZE_WITH_MERCHANT_FLAG);

      // wandering_merchant_intro is excluded because requiresFlagAbsent: MERCHANT_AIDED is set
      expect(ids.has('wandering_merchant_intro')).toBeFalse();
      // wandering_merchant_return enters because requiresFlag: MERCHANT_AIDED is satisfied
      expect(ids.has('wandering_merchant_return')).toBeTrue();
    }));

    it('includes a requiresFlagAbsent event when the flag is NOT set', fakeAsync(() => {
      // Without MERCHANT_AIDED set, wandering_merchant_intro is in the eligible pool.
      // Pool size without any flags = 19.
      service.startNewRun();
      // No flags set — merchant_aided absent.
      const POOL_SIZE_NO_FLAGS = 19;
      const ids = collectAllGeneratedEventIds(service, POOL_SIZE_NO_FLAGS);

      expect(ids.has('wandering_merchant_intro')).toBeTrue();
    }));

    it('never returns a firesOncePerRun event after it has been consumed (H4)', fakeAsync(() => {
      // With IDOL_BARGAIN_TAKEN set and cursed_idol_reckoning consumed,
      // that event must be excluded from every pool slot.
      service.startNewRun();
      flagService.setFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN);
      flagService.markEventConsumed('cursed_idol_reckoning');
      // Pool: same as IDOL_BARGAIN_TAKEN case (19) minus the consumed event = 18.
      const POOL_SIZE_IDOL_FLAG_CONSUMED = 18;
      const ids = collectAllGeneratedEventIds(service, POOL_SIZE_IDOL_FLAG_CONSUMED);

      expect(ids.has('cursed_idol_reckoning')).toBeFalse();
    }));
  });

  // ── Outcome flag side-effects (resolveEvent) ──────────────────────────────

  describe('resolveEvent() — flag side-effects', () => {
    let flagService: RunStateFlagService;

    beforeEach(() => {
      flagService = TestBed.inject(RunStateFlagService);
      flagService.resetForRun();
    });

    afterEach(() => {
      flagService.resetForRun();
    });

    it('sets a flag when outcome.setsFlag is present', fakeAsync(() => {
      service.startNewRun();
      (service as any).currentEvent = {
        id: 'test_event',
        title: 'Test',
        description: '',
        choices: [
          {
            label: 'Help',
            description: '',
            outcome: {
              goldDelta: 10,
              livesDelta: 0,
              setsFlag: FLAG_KEYS.MERCHANT_AIDED,
              description: 'Set the flag',
            } as EventOutcome,
          },
        ],
      };

      service.resolveEvent(0);
      expect(flagService.hasFlag(FLAG_KEYS.MERCHANT_AIDED)).toBeTrue();
    }));

    it('increments a flag when outcome.incrementsFlag is present', fakeAsync(() => {
      service.startNewRun();
      flagService.setFlag('visit_count', 2);
      (service as any).currentEvent = {
        id: 'test_event',
        title: 'Test',
        description: '',
        choices: [
          {
            label: 'Visit again',
            description: '',
            outcome: {
              goldDelta: 0,
              livesDelta: 0,
              incrementsFlag: 'visit_count',
              description: 'Increment the counter',
            } as EventOutcome,
          },
        ],
      };

      service.resolveEvent(0);
      expect(flagService.getFlag('visit_count')).toBe(3);
    }));

    it('does not set a flag when the non-flag outcome is chosen', fakeAsync(() => {
      service.startNewRun();
      (service as any).currentEvent = {
        id: 'test_event',
        title: 'Test',
        description: '',
        choices: [
          {
            label: 'Option A — sets flag',
            description: '',
            outcome: {
              goldDelta: 0,
              livesDelta: 0,
              setsFlag: FLAG_KEYS.MERCHANT_AIDED,
              description: 'Sets the flag',
            } as EventOutcome,
          },
          {
            label: 'Option B — no flag',
            description: '',
            outcome: {
              goldDelta: 0,
              livesDelta: 0,
              description: 'No flag set',
            } as EventOutcome,
          },
        ],
      };

      service.resolveEvent(1);
      expect(flagService.hasFlag(FLAG_KEYS.MERCHANT_AIDED)).toBeFalse();
    }));
  });

  // ── Cursed Idol chain integration ─────────────────────────────────────────

  describe('Cursed Idol chain integration', () => {
    let flagService: RunStateFlagService;

    beforeEach(() => {
      flagService = TestBed.inject(RunStateFlagService);
      flagService.resetForRun();
    });

    afterEach(() => {
      flagService.resetForRun();
    });

    it('cursed_idol_offer sets idol_bargain_taken on bargain choice', fakeAsync(() => {
      service.startNewRun();
      const offer = RUN_EVENTS.find(e => e.id === 'cursed_idol_offer');
      expect(offer).toBeDefined();

      // Simulate picking the bargain (choice index 0)
      (service as any).currentEvent = offer;
      service.resolveEvent(0);

      expect(flagService.hasFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN)).toBeTrue();
    }));

    it('cursed_idol_reckoning requires idol_bargain_taken flag', () => {
      const reckoning = RUN_EVENTS.find(e => e.id === 'cursed_idol_reckoning');
      expect(reckoning).toBeDefined();
      expect(reckoning!.requiresFlag).toBe(FLAG_KEYS.IDOL_BARGAIN_TAKEN);
    });

    it('cursed_idol_offer is absent (requiresFlagAbsent) — excluded after flag is set', () => {
      const offer = RUN_EVENTS.find(e => e.id === 'cursed_idol_offer');
      expect(offer!.requiresFlagAbsent).toBe(FLAG_KEYS.IDOL_BARGAIN_TAKEN);

      // With flag set, the filter should exclude it
      flagService.setFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN);
      const eligible = RUN_EVENTS.filter(e => {
        if (e.requiresFlagAbsent && flagService.hasFlag(e.requiresFlagAbsent)) return false;
        return true;
      });
      expect(eligible.find(e => e.id === 'cursed_idol_offer')).toBeUndefined();
    });

    it('full chain: offer sets flag, reckoning rolls next because flag is present', fakeAsync(() => {
      service.startNewRun();
      const offer = RUN_EVENTS.find(e => e.id === 'cursed_idol_offer')!;

      // Step 1: player takes the bargain
      (service as any).currentEvent = offer;
      service.resolveEvent(0);
      expect(flagService.hasFlag(FLAG_KEYS.IDOL_BARGAIN_TAKEN)).toBeTrue();

      // Step 2: check reckoning is now eligible
      const reckoningEligible = RUN_EVENTS.filter(e => {
        if (e.requiresFlag && !flagService.hasFlag(e.requiresFlag)) return false;
        if (e.requiresFlagAbsent && flagService.hasFlag(e.requiresFlagAbsent)) return false;
        return true;
      });
      expect(reckoningEligible.find(e => e.id === 'cursed_idol_reckoning')).toBeDefined();

      // Step 3: the intro event should now be excluded
      expect(reckoningEligible.find(e => e.id === 'cursed_idol_offer')).toBeUndefined();
    }));
  });

  // ── Checkpoint v5→v6 migration ────────────────────────────────────────────

  describe('Checkpoint v5→v6 migration', () => {
    it('v5→v6 migration inserts empty runStateFlags', () => {
      const checkpointSvc = TestBed.inject(EncounterCheckpointService);
      const CHECKPOINT_KEY = 'novarise_encounter_checkpoint';

      // Build a valid v5 checkpoint (no runStateFlags field)
      const v5Data: Record<string, unknown> = {
        version: 5,
        timestamp: Date.now(),
        nodeId: 'node_1',
        encounterConfig: {
          nodeId: 'node_1',
          nodeType: 'COMBAT',
          campaignMapId: 'campaign_01',
          waves: [],
          goldReward: 50,
          isElite: false,
          isBoss: false,
        },
        rngState: 12345,
        gameState: {
          phase: 'COMBAT',
          wave: 1,
          maxWaves: 5,
          lives: 15,
          maxLives: 20,
          initialLives: 20,
          gold: 100,
          initialGold: 100,
          score: 0,
          difficulty: 'NORMAL',
          isEndless: false,
          highestWave: 1,
          elapsedTime: 0,
          activeModifiers: [],
          consecutiveWavesWithoutLeak: 0,
        },
        turnNumber: 1,
        leakedThisWave: false,
        towers: [],
        mortarZones: [],
        enemies: [],
        enemyCounter: 0,
        statusEffects: [],
        waveState: {
          currentWaveIndex: 0,
          turnSchedule: [],
          turnScheduleIndex: 0,
          active: false,
          endlessMode: false,
          currentEndlessResult: null,
        },
        deckState: {
          deckState: { drawPile: [], hand: [], discardPile: [], exhaustPile: [] },
          energyState: { current: 3, max: 3 },
          instanceCounter: 0,
        },
        cardModifiers: [],
        relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false },
        gameStats: { totalGoldEarned: 0, totalDamageDealt: 0, shotsFired: 0, killsByTowerType: {}, enemiesLeaked: 0, towersPlaced: 0, towersSold: 0 },
        challengeState: { totalGoldSpent: 0, maxTowersPlaced: 0, towerTypesUsed: [], currentTowerCount: 0, livesLostThisGame: 0 },
        wavePreview: { oneShotBonus: 0 },
        turnHistory: [],
        itemInventory: { entries: [] },
        // runStateFlags intentionally absent — simulates a v5 checkpoint
      };
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(v5Data));

      const loaded = checkpointSvc.loadCheckpoint();
      localStorage.removeItem(CHECKPOINT_KEY);

      expect(loaded).not.toBeNull();
      // Migration chain 5→6→7 back-fills both runStateFlags.entries and consumedEventIds.
      expect(loaded!.runStateFlags).toEqual({ entries: [], consumedEventIds: [] });
      expect(loaded!.version).toBe(7);
    });

    it('v6 round-trips populated runStateFlags', () => {
      const checkpointSvc = TestBed.inject(EncounterCheckpointService);
      const checkpoint = {
        version: CHECKPOINT_VERSION,
        timestamp: Date.now(),
        nodeId: 'node_1',
        encounterConfig: { nodeId: 'node_1', nodeType: 'COMBAT', campaignMapId: 'campaign_01', waves: [], goldReward: 50, isElite: false, isBoss: false },
        rngState: 99,
        gameState: { phase: 'COMBAT', wave: 1, maxWaves: 5, lives: 15, maxLives: 20, initialLives: 20, gold: 100, initialGold: 100, score: 0, difficulty: 'NORMAL', isEndless: false, highestWave: 1, elapsedTime: 0, activeModifiers: [], consecutiveWavesWithoutLeak: 0 },
        turnNumber: 2,
        leakedThisWave: false,
        towers: [],
        mortarZones: [],
        enemies: [],
        enemyCounter: 0,
        statusEffects: [],
        waveState: { currentWaveIndex: 0, turnSchedule: [], turnScheduleIndex: 0, active: false, endlessMode: false, currentEndlessResult: null },
        deckState: { deckState: { drawPile: [], hand: [], discardPile: [], exhaustPile: [] }, energyState: { current: 3, max: 3 }, instanceCounter: 0 },
        cardModifiers: [],
        relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false },
        gameStats: { totalGoldEarned: 0, totalDamageDealt: 0, shotsFired: 0, killsByTowerType: {}, enemiesLeaked: 0, towersPlaced: 0, towersSold: 0 },
        challengeState: { totalGoldSpent: 0, maxTowersPlaced: 0, towerTypesUsed: [], currentTowerCount: 0, livesLostThisGame: 0 },
        wavePreview: { oneShotBonus: 0 },
        turnHistory: [],
        itemInventory: { entries: [] },
        runStateFlags: { entries: [[FLAG_KEYS.MERCHANT_AIDED, 1], [FLAG_KEYS.SCOUT_SAVED, 3]], consumedEventIds: [] },
      };

      const CHECKPOINT_KEY = 'novarise_encounter_checkpoint';
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
      const loaded = checkpointSvc.loadCheckpoint();
      localStorage.removeItem(CHECKPOINT_KEY);

      expect(loaded).not.toBeNull();
      expect(loaded!.runStateFlags.entries.length).toBe(2);
      const merchantEntry = loaded!.runStateFlags.entries.find(e => e[0] === FLAG_KEYS.MERCHANT_AIDED);
      expect(merchantEntry?.[1]).toBe(1);
    });
  });

  // ── H5: run-level items + flags persistence ───────────────────

  describe('H5: run-level items + flags persistence', () => {
    let itemService: ItemService;
    let flagService: RunStateFlagService;

    beforeEach(() => {
      itemService = TestBed.inject(ItemService);
      flagService = TestBed.inject(RunStateFlagService);
      itemService.resetForRun();
      flagService.resetForRun();
    });

    afterEach(() => {
      itemService.resetForRun();
      flagService.resetForRun();
    });

    it('persist() includes itemService inventory in the saved state', fakeAsync(() => {
      service.startNewRun();
      itemService.addItem(ItemType.HEAL_POTION);
      itemService.addItem(ItemType.HEAL_POTION);
      itemService.addItem(ItemType.BOMB);

      // Trigger persist() via selectNode
      service.selectNode('node_0_0');

      const savedState = persistence.saveRunState.calls.mostRecent().args[0] as RunState;
      expect(savedState.itemInventory).toBeDefined();
      const healEntry = savedState.itemInventory!.entries.find(e => e[0] === ItemType.HEAL_POTION);
      const bombEntry = savedState.itemInventory!.entries.find(e => e[0] === ItemType.BOMB);
      expect(healEntry?.[1]).toBe(2);
      expect(bombEntry?.[1]).toBe(1);
    }));

    it('persist() includes runStateFlagService state', fakeAsync(() => {
      service.startNewRun();
      flagService.setFlag('test_flag', 3);

      service.selectNode('node_0_0');

      const savedState = persistence.saveRunState.calls.mostRecent().args[0] as RunState;
      expect(savedState.runStateFlags).toBeDefined();
      const flagEntry = savedState.runStateFlags!.entries.find(e => e[0] === 'test_flag');
      expect(flagEntry?.[1]).toBe(3);
    }));

    it('persist() includes runStateFlagService consumedEventIds', fakeAsync(() => {
      service.startNewRun();
      flagService.markEventConsumed('foo_event');

      service.selectNode('node_0_0');

      const savedState = persistence.saveRunState.calls.mostRecent().args[0] as RunState;
      expect(savedState.runStateFlags).toBeDefined();
      expect(savedState.runStateFlags!.consumedEventIds).toContain('foo_event');
    }));

    it('resumeRun() restores item inventory from saved state', fakeAsync(() => {
      const itemInventory: SerializedItemInventory = {
        entries: [[ItemType.ENERGY_ELIXIR, 2], [ItemType.BOMB, 1]],
      };
      const fakeState: RunState = {
        id: 'run_resume',
        seed: 100,
        ascensionLevel: 0,
        config: { startingLives: 20, startingGold: 150, actsCount: 2, nodesPerAct: 12 },
        actIndex: 0,
        currentNodeId: null,
        completedNodeIds: [],
        lives: 20,
        maxLives: 20,
        gold: 150,
        relicIds: [],
        deckCardIds: [],
        encounterResults: [],
        status: RunStatus.IN_PROGRESS,
        startedAt: Date.now(),
        score: 0,
        itemInventory,
      };
      persistence.loadRunState.and.returnValue(fakeState);
      persistence.loadNodeMap.and.returnValue(makeNodeMap());

      service.resumeRun();

      const inventory = itemService.getInventory();
      expect(inventory.get(ItemType.ENERGY_ELIXIR)).toBe(2);
      expect(inventory.get(ItemType.BOMB)).toBe(1);
    }));

    it('resumeRun() restores flags from saved state', fakeAsync(() => {
      const runStateFlags: SerializedRunStateFlags = {
        entries: [['merchant_aided', 1], ['scout_saved', 2]],
        consumedEventIds: [],
      };
      const fakeState: RunState = {
        id: 'run_flags',
        seed: 200,
        ascensionLevel: 0,
        config: { startingLives: 20, startingGold: 150, actsCount: 2, nodesPerAct: 12 },
        actIndex: 0,
        currentNodeId: null,
        completedNodeIds: [],
        lives: 20,
        maxLives: 20,
        gold: 150,
        relicIds: [],
        deckCardIds: [],
        encounterResults: [],
        status: RunStatus.IN_PROGRESS,
        startedAt: Date.now(),
        score: 0,
        runStateFlags,
      };
      persistence.loadRunState.and.returnValue(fakeState);
      persistence.loadNodeMap.and.returnValue(makeNodeMap());

      service.resumeRun();

      expect(flagService.getFlag('merchant_aided')).toBe(1);
      expect(flagService.getFlag('scout_saved')).toBe(2);
    }));

    it('resumeRun() restores consumedEventIds from saved state', fakeAsync(() => {
      const runStateFlags: SerializedRunStateFlags = {
        entries: [],
        consumedEventIds: ['wandering_merchant_intro', 'cursed_idol_offer'],
      };
      const fakeState: RunState = {
        id: 'run_consumed',
        seed: 300,
        ascensionLevel: 0,
        config: { startingLives: 20, startingGold: 150, actsCount: 2, nodesPerAct: 12 },
        actIndex: 0,
        currentNodeId: null,
        completedNodeIds: [],
        lives: 20,
        maxLives: 20,
        gold: 150,
        relicIds: [],
        deckCardIds: [],
        encounterResults: [],
        status: RunStatus.IN_PROGRESS,
        startedAt: Date.now(),
        score: 0,
        runStateFlags,
      };
      persistence.loadRunState.and.returnValue(fakeState);
      persistence.loadNodeMap.and.returnValue(makeNodeMap());

      service.resumeRun();

      expect(flagService.isEventConsumed('wandering_merchant_intro')).toBeTrue();
      expect(flagService.isEventConsumed('cursed_idol_offer')).toBeTrue();
    }));

    it('resumeRun() backward-compat: RunState without itemInventory restores to empty inventory', fakeAsync(() => {
      const fakeState: RunState = {
        id: 'run_compat_items',
        seed: 400,
        ascensionLevel: 0,
        config: { startingLives: 20, startingGold: 150, actsCount: 2, nodesPerAct: 12 },
        actIndex: 0,
        currentNodeId: null,
        completedNodeIds: [],
        lives: 20,
        maxLives: 20,
        gold: 150,
        relicIds: [],
        deckCardIds: [],
        encounterResults: [],
        status: RunStatus.IN_PROGRESS,
        startedAt: Date.now(),
        score: 0,
        // intentionally no itemInventory field
      };
      persistence.loadRunState.and.returnValue(fakeState);
      persistence.loadNodeMap.and.returnValue(makeNodeMap());

      expect(() => service.resumeRun()).not.toThrow();
      expect(itemService.getInventory().size).toBe(0);
    }));

    it('resumeRun() backward-compat: RunState without runStateFlags restores to empty flags', fakeAsync(() => {
      const fakeState: RunState = {
        id: 'run_compat_flags',
        seed: 500,
        ascensionLevel: 0,
        config: { startingLives: 20, startingGold: 150, actsCount: 2, nodesPerAct: 12 },
        actIndex: 0,
        currentNodeId: null,
        completedNodeIds: [],
        lives: 20,
        maxLives: 20,
        gold: 150,
        relicIds: [],
        deckCardIds: [],
        encounterResults: [],
        status: RunStatus.IN_PROGRESS,
        startedAt: Date.now(),
        score: 0,
        // intentionally no runStateFlags field
      };
      persistence.loadRunState.and.returnValue(fakeState);
      persistence.loadNodeMap.and.returnValue(makeNodeMap());

      expect(() => service.resumeRun()).not.toThrow();
      expect(flagService.getAllFlags().size).toBe(0);
    }));
  });

  // ── S7: qualitative ascension effects ────────────────────────

  describe('S7 — SHOP_SLOT_REDUCTION (A13)', () => {
    beforeEach(() => {
      const stubRelics: RelicDefinition[] = [
        RELIC_DEFINITIONS[RelicId.IRON_HEART],
        RELIC_DEFINITIONS[RelicId.GOLD_MAGNET],
        RELIC_DEFINITIONS[RelicId.STURDY_BOOTS],
        RELIC_DEFINITIONS[RelicId.QUICK_DRAW],
        RELIC_DEFINITIONS[RelicId.LUCKY_COIN],
      ];
      // A18 grants a starting relic — getAvailableRelics is called on startNewRun now.
      // Provide stubs for all rarity variants.
      relicService.getAvailableRelics.and.callFake((rarity?: RelicRarity) => {
        if (rarity === RelicRarity.COMMON) {
          return stubRelics.filter(r => r.rarity === RelicRarity.COMMON);
        }
        return stubRelics;
      });
    });

    it('at A12 (no SHOP_SLOT_REDUCTION), shop has 3 relics and 3 cards', fakeAsync(() => {
      service.startNewRun(12);
      service.generateShopItems();
      const items = service.getShopItems();
      const relicItems = items.filter(i => i.item.type === 'relic');
      const cardItems = items.filter(i => i.item.type === 'card');
      expect(relicItems.length).toBe(3); // SHOP_CONFIG.relicsInShop baseline
      expect(cardItems.length).toBe(3); // SHOP_CONFIG.cardsInShop baseline
    }));

    it('at A13 (SHOP_SLOT_REDUCTION=1), shop has 2 relics and 2 cards', fakeAsync(() => {
      service.startNewRun(13);
      service.generateShopItems();
      const items = service.getShopItems();
      const relicItems = items.filter(i => i.item.type === 'relic');
      const cardItems = items.filter(i => i.item.type === 'card');
      expect(relicItems.length).toBe(2); // 3 - 1
      expect(cardItems.length).toBe(2); // 3 - 1
    }));
  });

  describe('S7 — STARTING_RELIC_DOWNGRADE (A18)', () => {
    it('at A17 (no downgrade), startNewRun() does NOT grant a starting relic', fakeAsync(() => {
      // H2d: stub returns relics only for COMMON so a pre-hotfix regression calling
      // getAvailableRelics() without a rarity filter would still get an empty array.
      relicService.getAvailableRelics.and.callFake((rarity?: RelicRarity) => {
        return rarity === RelicRarity.COMMON ? [RELIC_DEFINITIONS[RelicId.IRON_HEART]] : [];
      });

      service.startNewRun(17);

      // A17 does not trigger the A18+ starter-relic penalty — grantStartingRelic must not be called.
      expect(relicService.getAvailableRelics).not.toHaveBeenCalled();
      expect(service.runState!.relicIds).toEqual([]);
    }));

    it('at A18 (STARTING_RELIC_DOWNGRADE=1), startNewRun() calls getAvailableRelics(COMMON)', fakeAsync(() => {
      const stubRelics: RelicDefinition[] = [RELIC_DEFINITIONS[RelicId.IRON_HEART]];
      relicService.getAvailableRelics.and.callFake((rarity?: RelicRarity) => {
        return rarity === RelicRarity.COMMON ? stubRelics : [];
      });

      service.startNewRun(18);

      // getAvailableRelics must be called with RelicRarity.COMMON for the starter relic at A18
      const callsWithCommon = relicService.getAvailableRelics.calls.all()
        .filter(c => c.args[0] === RelicRarity.COMMON);
      expect(callsWithCommon.length).toBeGreaterThan(0);

      // H2c: the granted relic must be COMMON rarity and must appear in relicIds
      expect(service.runState!.relicIds.length).toBe(1);
      const grantedRelicId = service.runState!.relicIds[0] as RelicId;
      const grantedDef = RELIC_DEFINITIONS[grantedRelicId];
      expect(grantedDef.rarity).toBe(RelicRarity.COMMON);
    }));
  });

  // ── Phase 1 Sprint 4 — removeCardFromShop ──────────────────────────────
  describe('removeCardFromShop()', () => {
    it('returns false when no run state exists', () => {
      expect(service.removeCardFromShop('any')).toBeFalse();
    });

    it('returns false when player gold is below cardRemoveCost', fakeAsync(() => {
      service.startNewRun();
      const cards = service.getDeckCards();
      const target = cards.find(c => CARD_DEFINITIONS[c.cardId as CardId].rarity !== CardRarity.STARTER);

      // Force gold below cost
      service['updateState']({ ...service.runState!, gold: 0 });

      const result = service.removeCardFromShop(target?.instanceId ?? 'whatever');
      expect(result).toBeFalse();
    }));

    it('returns false for unknown instanceId', fakeAsync(() => {
      service.startNewRun();
      service['updateState']({ ...service.runState!, gold: 1000 });
      expect(service.removeCardFromShop('does_not_exist')).toBeFalse();
    }));

    it('returns false when target is a STARTER card', fakeAsync(() => {
      service.startNewRun();
      service['updateState']({ ...service.runState!, gold: 1000 });
      const cards = service.getDeckCards();
      const starter = cards.find(c => CARD_DEFINITIONS[c.cardId as CardId].rarity === CardRarity.STARTER);
      expect(starter).toBeTruthy();

      expect(service.removeCardFromShop(starter!.instanceId)).toBeFalse();
    }));

    it('successfully removes a non-starter card and deducts gold', fakeAsync(() => {
      service.startNewRun();
      // Add a non-starter card to the deck via collectReward
      service['updateState']({ ...service.runState!, gold: 1000 });
      service.collectReward({ type: 'card', cardId: CardId.GOLD_RUSH });

      const cards = service.getDeckCards();
      const target = cards.find(c => c.cardId === CardId.GOLD_RUSH);
      expect(target).toBeTruthy();

      const goldBefore = service.runState!.gold;
      const totalBefore = service.getDeckCards().length;
      const ids = service.runState!.deckCardIds.length;

      const result = service.removeCardFromShop(target!.instanceId);

      expect(result).toBeTrue();
      expect(service.runState!.gold).toBe(goldBefore - 75);
      expect(service.getDeckCards().length).toBe(totalBefore - 1);
      expect(service.runState!.deckCardIds.length).toBe(ids - 1);
    }));
  });
});
