import { TestBed } from '@angular/core/testing';
import { RunPersistenceService } from './run-persistence.service';
import { RunState, RunStatus, DEFAULT_RUN_CONFIG } from '../models/run-state.model';
import { NodeMap, NodeType } from '../models/node-map.model';
import { CardId } from '../models/card.model';

const RUN_STATE_KEY = 'novarise_run_state';
const NODE_MAP_KEY = 'novarise_run_map';
const MAX_ASCENSION_KEY = 'novarise_run_max_ascension';

function makeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    id: 'run_test_001',
    seed: 12345,
    ascensionLevel: 0,
    config: DEFAULT_RUN_CONFIG,
    actIndex: 0,
    currentNodeId: null,
    completedNodeIds: [],
    lives: 20,
    maxLives: 20,
    gold: 150,
    relicIds: [],
    // Default deck contains a tower card so loadRunState's corruption guard
    // (which rejects saves whose deck has zero towers) does not reject.
    deckCardIds: [CardId.TOWER_BASIC],
    encounterResults: [],
    status: RunStatus.IN_PROGRESS,
    startedAt: 1000000,
    score: 0,
    ...overrides,
  };
}

function makeNodeMap(): NodeMap {
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
        type: NodeType.BOSS,
        row: 1,
        column: 0,
        connections: [],
        campaignMapId: 'campaign_02',
        visited: false,
      },
    ],
    startNodeIds: ['node_0_0'],
    bossNodeId: 'node_1_0',
    rows: 2,
  };
}

describe('RunPersistenceService', () => {
  let service: RunPersistenceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RunPersistenceService],
    });
    service = TestBed.inject(RunPersistenceService);

    // Clean up before each test
    localStorage.removeItem(RUN_STATE_KEY);
    localStorage.removeItem(NODE_MAP_KEY);
    localStorage.removeItem(MAX_ASCENSION_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(RUN_STATE_KEY);
    localStorage.removeItem(NODE_MAP_KEY);
    localStorage.removeItem(MAX_ASCENSION_KEY);
  });

  // ── hasSavedRun ───────────────────────────────────────────────

  it('hasSavedRun() returns false when nothing saved', () => {
    expect(service.hasSavedRun()).toBeFalse();
  });

  it('hasSavedRun() returns true after saveRunState()', () => {
    service.saveRunState(makeRunState(), makeNodeMap());
    expect(service.hasSavedRun()).toBeTrue();
  });

  // ── saveRunState / loadRunState round-trip ────────────────────

  it('loadRunState() returns null when no save exists', () => {
    expect(service.loadRunState()).toBeNull();
  });

  it('saveRunState() and loadRunState() round-trip state correctly', () => {
    const state = makeRunState({ gold: 275, lives: 15, actIndex: 1 });
    service.saveRunState(state, makeNodeMap());

    const loaded = service.loadRunState();
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('run_test_001');
    expect(loaded!.gold).toBe(275);
    expect(loaded!.lives).toBe(15);
    expect(loaded!.actIndex).toBe(1);
    expect(loaded!.status).toBe(RunStatus.IN_PROGRESS);
  });

  it('loadRunState() returns null for VICTORY status and clears save', () => {
    service.saveRunState(makeRunState({ status: RunStatus.VICTORY }), makeNodeMap());
    expect(service.loadRunState()).toBeNull();
    expect(service.hasSavedRun()).toBeFalse();
  });

  it('loadRunState() returns null for DEFEAT status and clears save', () => {
    service.saveRunState(makeRunState({ status: RunStatus.DEFEAT }), makeNodeMap());
    expect(service.loadRunState()).toBeNull();
    expect(service.hasSavedRun()).toBeFalse();
  });

  it('loadRunState() returns null for ABANDONED status and clears save', () => {
    service.saveRunState(makeRunState({ status: RunStatus.ABANDONED }), makeNodeMap());
    expect(service.loadRunState()).toBeNull();
    expect(service.hasSavedRun()).toBeFalse();
  });

  it('loadRunState() returns null and clears save for corrupt JSON', () => {
    localStorage.setItem(RUN_STATE_KEY, '{ not valid json }}}');
    expect(service.loadRunState()).toBeNull();
    expect(service.hasSavedRun()).toBeFalse();
  });

  // ── Corruption guard: zero-tower deck (smoke-test override leftover) ──

  it('loadRunState() rejects + clears a saved deck containing zero tower cards', () => {
    // Mirrors the shape left behind by the glyph-review smoke override:
    // 13 non-tower cards, no towers. Production starter always has 16 towers,
    // so this composition cannot arise from normal play.
    const corruptDeck = [
      CardId.LIGHTNING_STRIKE, CardId.INCINERATE, CardId.TOXIC_SPRAY,
      CardId.FROST_WAVE, CardId.REPAIR_WALLS, CardId.GOLD_RUSH,
      CardId.DRAW_TWO, CardId.ENERGY_SURGE, CardId.DAMAGE_BOOST,
      CardId.SCOUT_AHEAD, CardId.RECYCLE, CardId.HANDSHAKE, CardId.LAY_TILE,
    ];
    service.saveRunState(makeRunState({ deckCardIds: corruptDeck }), makeNodeMap());
    expect(service.loadRunState()).toBeNull();
    expect(service.hasSavedRun()).toBeFalse();
  });

  it('loadRunState() restores a deck that contains at least one tower card', () => {
    const validDeck = [
      CardId.TOWER_BASIC, CardId.TOWER_BASIC, CardId.GOLD_RUSH,
    ];
    service.saveRunState(makeRunState({ deckCardIds: validDeck }), makeNodeMap());
    const loaded = service.loadRunState();
    expect(loaded).not.toBeNull();
    expect(loaded!.deckCardIds).toEqual(validDeck);
  });

  it('loadRunState() rejects an empty deck (defense-in-depth)', () => {
    service.saveRunState(makeRunState({ deckCardIds: [] }), makeNodeMap());
    expect(service.loadRunState()).toBeNull();
    expect(service.hasSavedRun()).toBeFalse();
  });

  // ── loadNodeMap ───────────────────────────────────────────────

  it('loadNodeMap() returns null when no map saved', () => {
    expect(service.loadNodeMap()).toBeNull();
  });

  it('loadNodeMap() round-trips the node map correctly', () => {
    const map = makeNodeMap();
    service.saveRunState(makeRunState(), map);
    const loaded = service.loadNodeMap();
    expect(loaded).not.toBeNull();
    expect(loaded!.bossNodeId).toBe('node_1_0');
    expect(loaded!.nodes.length).toBe(2);
  });

  // ── clearSavedRun ─────────────────────────────────────────────

  it('clearSavedRun() removes saved run and map', () => {
    service.saveRunState(makeRunState(), makeNodeMap());
    service.clearSavedRun();
    expect(service.hasSavedRun()).toBeFalse();
    expect(service.loadNodeMap()).toBeNull();
  });

  // ── getMaxAscension / setMaxAscension ─────────────────────────

  it('getMaxAscension() returns 0 when nothing stored', () => {
    expect(service.getMaxAscension()).toBe(0);
  });

  it('setMaxAscension() persists and getMaxAscension() retrieves it', () => {
    service.setMaxAscension(5);
    expect(service.getMaxAscension()).toBe(5);
  });

  it('setMaxAscension() raises the stored value when higher', () => {
    service.setMaxAscension(3);
    service.setMaxAscension(7);
    expect(service.getMaxAscension()).toBe(7);
  });

  it('setMaxAscension() does not lower an existing higher value', () => {
    service.setMaxAscension(10);
    service.setMaxAscension(4);
    expect(service.getMaxAscension()).toBe(10);
  });

  it('setMaxAscension() does not update when level equals current max', () => {
    service.setMaxAscension(5);
    service.setMaxAscension(5);
    expect(service.getMaxAscension()).toBe(5);
  });

  it('setMaxAscension(25) clamps to 20 (MAX_ASCENSION_LEVEL)', () => {
    service.setMaxAscension(25);
    expect(service.getMaxAscension()).toBe(20);
  });

  it('setMaxAscension(21) clamps to 20', () => {
    service.setMaxAscension(21);
    expect(service.getMaxAscension()).toBe(20);
  });

  // ── isAscensionMastered ───────────────────────────────────────

  it('isAscensionMastered() returns false when maxAscension is 0', () => {
    expect(service.isAscensionMastered()).toBeFalse();
  });

  it('isAscensionMastered() returns false at A19', () => {
    service.setMaxAscension(19);
    expect(service.isAscensionMastered()).toBeFalse();
  });

  it('isAscensionMastered() returns true at A20', () => {
    service.setMaxAscension(20);
    expect(service.isAscensionMastered()).toBeTrue();
  });
});
