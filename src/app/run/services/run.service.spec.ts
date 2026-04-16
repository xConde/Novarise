import { TestBed, fakeAsync } from '@angular/core/testing';
import { RunService } from './run.service';
import { DeckService } from './deck.service';
import { NodeMapGeneratorService } from './node-map-generator.service';
import { EncounterService } from './encounter.service';
import { RelicService } from './relic.service';
import { RunPersistenceService } from './run-persistence.service';
import { RunEventBusService } from './run-event-bus.service';
import { EncounterCheckpointService } from './encounter-checkpoint.service';
import { RunStatus, DEFAULT_RUN_CONFIG, EncounterResult } from '../models/run-state.model';
import { NodeMap, MapNode, NodeType } from '../models/node-map.model';
import { EncounterConfig } from '../models/encounter.model';
import { RelicId, RelicDefinition, RelicRarity, RELIC_DEFINITIONS } from '../models/relic.model';
import { CardRarity } from '../models/card.model';
import { CARD_DEFINITIONS } from '../constants/card-definitions';
import { REWARD_CONFIG } from '../constants/run.constants';
import { AscensionEffectType } from '../models/ascension.model';
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

    it('ascension 0: relic choice count equals REWARD_CONFIG.relicChoicesCombat', fakeAsync(() => {
      service.startNewRun(0);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBe(REWARD_CONFIG.relicChoicesCombat);
    }));

    it('ascension 11 (FEWER_RELIC_CHOICES = 1): relic count is relicChoicesCombat - 1', fakeAsync(() => {
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBe(REWARD_CONFIG.relicChoicesCombat - 1);
    }));

    it('ascension 20: relic count is floored at 1, never 0 or negative', fakeAsync(() => {
      service.startNewRun(20);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);

      const rewards = service.generateRewards();

      expect(rewards.relicChoices.length).toBeGreaterThanOrEqual(1);
    }));

    it('elite encounter at ascension 11: relicChoicesElite - 1, floored at 1', fakeAsync(() => {
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(
        makeEncounterConfig({ isElite: true, isBoss: false }),
      );
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      // Must consume before generateRewards — consume stashes lastCompletedEncounter
      // so isElite/isBoss are preserved for the reward screen.
      service.recordEncounterResult(makeEncounterResult({ victory: true }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      const expected = Math.max(1, REWARD_CONFIG.relicChoicesElite - 1);
      expect(rewards.relicChoices.length).toBe(expected);
    }));

    it('boss encounter at ascension 11: relicChoicesBoss - 1, floored at 1', fakeAsync(() => {
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(
        makeEncounterConfig({ isElite: false, isBoss: true }),
      );
      service.prepareEncounter(service.nodeMap!.nodes[0]);
      // Use boss node so prepareEncounter is resolved against the boss node
      service.selectNode(service.nodeMap!.bossNodeId);
      // Must consume before generateRewards — consume stashes lastCompletedEncounter
      // so isElite/isBoss are preserved for the reward screen.
      service.recordEncounterResult(makeEncounterResult({ victory: true }));
      service.consumePendingEncounterResult();

      const rewards = service.generateRewards();

      const expected = Math.max(1, REWARD_CONFIG.relicChoicesBoss - 1);
      expect(rewards.relicChoices.length).toBe(expected);
    }));

    it('regression guard: reduction exceeding baseline still returns 1', fakeAsync(() => {
      // Simulate a hypothetical scenario where future ascension stacking could
      // push the reduction above the baseline count. Inject a mock ascensionEffects
      // by using a very large internal ascensionLevel that the model clamps to 20.
      // At level 20, reduction is 1 and REWARD_CONFIG.relicChoicesCombat is 3, so
      // the direct floor check is tested by patching relicChoicesCombat to 1.
      // This exercises the Math.max(1, 1 - 1) = Math.max(1, 0) = 1 path.
      service.startNewRun(11);
      encounterService.prepareEncounter.and.returnValue(makeEncounterConfig());
      service.prepareEncounter(service.nodeMap!.nodes[0]);

      // Temporarily patch REWARD_CONFIG to simulate a baseline of 1 relic choice
      const orig = REWARD_CONFIG.relicChoicesCombat;
      (REWARD_CONFIG as any).relicChoicesCombat = 1;

      const rewards = service.generateRewards();

      (REWARD_CONFIG as any).relicChoicesCombat = orig;

      // reduction=1, baseline=1 → Math.max(1, 0) → must be 1, not 0
      expect(rewards.relicChoices.length).toBe(1);
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

    it('ascension 11 + 1 challenge: both relic reduction AND gold bonus apply', fakeAsync(() => {
      // Need enough relics available for the relic-reduction test to be visible
      const stubRelics: RelicDefinition[] = [
        RELIC_DEFINITIONS[RelicId.IRON_HEART],
        RELIC_DEFINITIONS[RelicId.QUICK_DRAW],
        RELIC_DEFINITIONS[RelicId.COMMANDERS_BANNER],
      ];
      relicService.getAvailableRelics.and.returnValue(stubRelics);

      service.startNewRun(11); // FEWER_RELIC_CHOICES=1 at ascension 11
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
      // Relics: relicChoicesCombat - 1 = reduced
      expect(rewards.relicChoices.length).toBe(Math.max(1, REWARD_CONFIG.relicChoicesCombat - 1));
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
      });

      // node_0_0 is NOT in completedNodeIds — valid checkpoint.
      service.restoreEncounter();

      // Checkpoint must survive and isRestoringCheckpoint must be set.
      expect(checkpointService.hasCheckpoint()).toBeTrue();
      expect(service.isRestoringCheckpoint).toBeTrue();
    }));
  });
});
