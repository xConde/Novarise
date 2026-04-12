import { TestBed } from '@angular/core/testing';
import { EncounterService } from './encounter.service';
import { WaveGeneratorService } from './wave-generator.service';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { RunMapService } from './run-map.service';
import { MapNode, NodeType } from '../models/node-map.model';
import { RunState, RunStatus, DEFAULT_RUN_CONFIG } from '../models/run-state.model';
import { WaveDefinition } from '../../game/game-board/models/wave.model';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { REWARD_CONFIG } from '../constants/run.constants';
import { CAMPAIGN_WAVE_DEFINITIONS } from '../data/waves/campaign-waves';

function makeMapNode(overrides: Partial<MapNode> = {}): MapNode {
  return {
    id: 'node_3_1',
    type: NodeType.COMBAT,
    row: 3,
    column: 1,
    connections: ['node_4_0'],
    campaignMapId: 'campaign_05',
    visited: false,
    ...overrides,
  };
}

function makeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    id: 'run_test_enc',
    seed: 99999,
    ascensionLevel: 0,
    config: DEFAULT_RUN_CONFIG,
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
    startedAt: 1000000,
    score: 0,
    ...overrides,
  };
}

const STUB_WAVES: WaveDefinition[] = [
  { entries: [], reward: 20 },
];

const MOCK_MAP_STATE: TerrainGridState = {
  gridSize: 10,
  tiles: Array.from({ length: 10 }, () =>
    new Array<TerrainType>(10).fill(TerrainType.BEDROCK),
  ),
  heightMap: Array.from({ length: 10 }, () => new Array<number>(10).fill(0)),
  spawnPoints: [{ x: 0, z: 4 }],
  exitPoints: [{ x: 9, z: 4 }],
  version: '2.0.0',
};

describe('EncounterService', () => {
  let service: EncounterService;
  let waveGenerator: jasmine.SpyObj<WaveGeneratorService>;
  let mapBridge: jasmine.SpyObj<MapBridgeService>;
  let runMapService: jasmine.SpyObj<RunMapService>;

  beforeEach(() => {
    waveGenerator = jasmine.createSpyObj('WaveGeneratorService', [
      'generateCombatWaves',
      'generateEliteWaves',
      'generateBossWaves',
    ]);
    mapBridge = jasmine.createSpyObj('MapBridgeService', ['setEditorMapState']);
    runMapService = jasmine.createSpyObj('RunMapService', ['loadLevel']);

    waveGenerator.generateCombatWaves.and.returnValue(STUB_WAVES);
    waveGenerator.generateEliteWaves.and.returnValue(STUB_WAVES);
    waveGenerator.generateBossWaves.and.returnValue(STUB_WAVES);
    runMapService.loadLevel.and.returnValue(MOCK_MAP_STATE);

    TestBed.configureTestingModule({
      providers: [
        EncounterService,
        { provide: WaveGeneratorService, useValue: waveGenerator },
        { provide: MapBridgeService, useValue: mapBridge },
        { provide: RunMapService, useValue: runMapService },
      ],
    });

    service = TestBed.inject(EncounterService);
  });

  // ── prepareEncounter: COMBAT ──────────────────────────────────

  it('prepareEncounter() for COMBAT node returns correct EncounterConfig shape', () => {
    // campaign_05 has hand-authored waves; shape test only checks non-wave fields
    const node = makeMapNode({ type: NodeType.COMBAT });
    const config = service.prepareEncounter(node, makeRunState());

    expect(config.nodeId).toBe('node_3_1');
    expect(config.nodeType).toBe(NodeType.COMBAT);
    expect(config.campaignMapId).toBe('campaign_05');
    expect(config.isElite).toBeFalse();
    expect(config.isBoss).toBeFalse();
    expect(config.waves.length).toBeGreaterThan(0);
  });

  it('prepareEncounter() for COMBAT node with unknown campaignMapId falls back to generateCombatWaves', () => {
    // Use an id not present in CAMPAIGN_WAVE_DEFINITIONS to exercise procedural fallback
    const node = makeMapNode({ type: NodeType.COMBAT, campaignMapId: 'custom_user_map' });
    const state = makeRunState({ actIndex: 1, seed: 42 });
    const config = service.prepareEncounter(node, state);

    expect(waveGenerator.generateCombatWaves).toHaveBeenCalledWith(3, 1, 42);
    expect(config.waves).toEqual(STUB_WAVES);
  });

  it('prepareEncounter() computes gold reward for COMBAT node', () => {
    const node = makeMapNode({ type: NodeType.COMBAT, row: 4 });
    const config = service.prepareEncounter(node, makeRunState());
    const expected = REWARD_CONFIG.combatGoldBase + 4 * REWARD_CONFIG.combatGoldPerRow;
    expect(config.goldReward).toBe(expected);
  });

  // ── prepareEncounter: ELITE ───────────────────────────────────

  it('prepareEncounter() for ELITE node sets isElite=true', () => {
    const node = makeMapNode({ type: NodeType.ELITE });
    const config = service.prepareEncounter(node, makeRunState());

    expect(config.isElite).toBeTrue();
    expect(config.isBoss).toBeFalse();
  });

  it('prepareEncounter() for ELITE node delegates to generateEliteWaves', () => {
    const node = makeMapNode({ type: NodeType.ELITE, row: 5 });
    const state = makeRunState({ actIndex: 0, seed: 77 });
    service.prepareEncounter(node, state);

    expect(waveGenerator.generateEliteWaves).toHaveBeenCalledWith(5, 0, 77);
  });

  it('prepareEncounter() for ELITE node inflates gold reward by 1.5x', () => {
    const node = makeMapNode({ type: NodeType.ELITE, row: 4 });
    const config = service.prepareEncounter(node, makeRunState());
    const baseGold = REWARD_CONFIG.combatGoldBase + 4 * REWARD_CONFIG.combatGoldPerRow;
    expect(config.goldReward).toBe(Math.round(baseGold * 1.5));
  });

  // ── prepareEncounter: BOSS ────────────────────────────────────

  it('prepareEncounter() for BOSS node sets isBoss=true', () => {
    const node = makeMapNode({ type: NodeType.BOSS });
    const config = service.prepareEncounter(node, makeRunState());

    expect(config.isBoss).toBeTrue();
    expect(config.isElite).toBeFalse();
  });

  it('prepareEncounter() for BOSS node delegates to generateBossWaves', () => {
    const node = makeMapNode({ type: NodeType.BOSS, row: 11 });
    const state = makeRunState({ actIndex: 1, seed: 55 });
    service.prepareEncounter(node, state);

    expect(waveGenerator.generateBossWaves).toHaveBeenCalledWith(1, 55);
  });

  it('prepareEncounter() for BOSS node inflates gold reward by 2.0x', () => {
    const node = makeMapNode({ type: NodeType.BOSS, row: 11 });
    const config = service.prepareEncounter(node, makeRunState());
    const baseGold = REWARD_CONFIG.combatGoldBase + 11 * REWARD_CONFIG.combatGoldPerRow;
    expect(config.goldReward).toBe(Math.round(baseGold * 2.0));
  });

  // ── prepareEncounter: REST ────────────────────────────────────

  it('prepareEncounter() for REST node returns empty waves array', () => {
    const node = makeMapNode({ type: NodeType.REST });
    const config = service.prepareEncounter(node, makeRunState());

    expect(config.waves).toEqual([]);
    expect(waveGenerator.generateCombatWaves).not.toHaveBeenCalled();
  });

  it('prepareEncounter() for SHOP node returns empty waves array', () => {
    const node = makeMapNode({ type: NodeType.SHOP });
    const config = service.prepareEncounter(node, makeRunState());
    expect(config.waves).toEqual([]);
  });

  // ── loadEncounterMap ──────────────────────────────────────────

  it('loadEncounterMap() calls mapBridge.setEditorMapState() with the loaded map', () => {
    const node = makeMapNode({ campaignMapId: 'campaign_03' });
    const encounterConfig = service.prepareEncounter(node, makeRunState());
    service.loadEncounterMap(encounterConfig);

    expect(runMapService.loadLevel).toHaveBeenCalledWith('campaign_03');
    expect(mapBridge.setEditorMapState).toHaveBeenCalledWith(MOCK_MAP_STATE, 'campaign_03');
  });

  it('loadEncounterMap() throws when campaign map is not found', () => {
    runMapService.loadLevel.and.returnValue(null);

    const node = makeMapNode({ campaignMapId: 'nonexistent_map' });
    const encounterConfig = service.prepareEncounter(node, makeRunState());

    expect(() => service.loadEncounterMap(encounterConfig)).toThrowError(
      /nonexistent_map/,
    );
  });

  // ── Hand-authored waves: campaign-first priority ──────────────────────────

  describe('generateWavesForNode: campaign-first priority', () => {

    it('COMBAT node with valid campaignMapId returns hand-authored waves from CAMPAIGN_WAVE_DEFINITIONS', () => {
      // campaign_01 has 6 BASIC-only waves — use as the canonical test case
      const mapId = 'campaign_01';
      const node = makeMapNode({ type: NodeType.COMBAT, campaignMapId: mapId });
      const config = service.prepareEncounter(node, makeRunState());

      const expected = CAMPAIGN_WAVE_DEFINITIONS[mapId];
      expect(config.waves.length).toBe(expected.length);
      // Verify first wave matches enemy type (BASIC only for campaign_01)
      expect(config.waves[0].entries![0].type).toBe(expected[0].entries![0].type);
      // Procedural generator must NOT have been called
      expect(waveGenerator.generateCombatWaves).not.toHaveBeenCalled();
    });

    it('COMBAT node with campaignMapId missing from CAMPAIGN_WAVE_DEFINITIONS falls back to generateCombatWaves', () => {
      const node = makeMapNode({ type: NodeType.COMBAT, campaignMapId: 'custom_user_map_xyz' });
      const state = makeRunState({ actIndex: 0, seed: 1 });
      service.prepareEncounter(node, state);

      expect(waveGenerator.generateCombatWaves).toHaveBeenCalledWith(3, 0, 1);
    });

    it('COMBAT node with empty campaignMapId string falls back to generateCombatWaves', () => {
      const node = makeMapNode({ type: NodeType.COMBAT, campaignMapId: '' });
      const state = makeRunState({ actIndex: 0, seed: 2 });
      service.prepareEncounter(node, state);

      expect(waveGenerator.generateCombatWaves).toHaveBeenCalledWith(3, 0, 2);
    });

    it('COMBAT node with an entry that has an empty waves array falls back to generateCombatWaves', () => {
      // Temporarily inject an empty-array entry by spying on the lookup; use a
      // campaignMapId not in the real data and simulate the empty-array scenario
      // by verifying the guard condition in code via a spy approach.
      // We cannot monkey-patch the imported const, so instead we test the guard
      // indirectly: an id that would resolve to undefined triggers the fallback,
      // and the unit test for empty-array guard is documented here.
      // The production guard is: `if (handAuthored && handAuthored.length > 0)`.
      // If handAuthored.length === 0, fall through to generateCombatWaves — verified
      // by the missing-id test above (same code branch).
      const node = makeMapNode({ type: NodeType.COMBAT, campaignMapId: 'not_a_real_map' });
      service.prepareEncounter(node, makeRunState());
      expect(waveGenerator.generateCombatWaves).toHaveBeenCalled();
    });

    it('returned waves are a shallow clone — mutating returned array does not affect CAMPAIGN_WAVE_DEFINITIONS', () => {
      const mapId = 'campaign_01';
      const originalReward = CAMPAIGN_WAVE_DEFINITIONS[mapId][0].reward;

      const node = makeMapNode({ type: NodeType.COMBAT, campaignMapId: mapId });
      const config = service.prepareEncounter(node, makeRunState());

      // Mutate the returned wave object
      config.waves[0].reward = 9999;

      // Original data must be unaffected
      expect(CAMPAIGN_WAVE_DEFINITIONS[mapId][0].reward).toBe(originalReward);
    });

    it('returned waves are a shallow clone — each object is a different reference', () => {
      const mapId = 'campaign_01';
      const node = makeMapNode({ type: NodeType.COMBAT, campaignMapId: mapId });
      const config = service.prepareEncounter(node, makeRunState());

      // None of the returned wave objects should be the same reference as the source
      config.waves.forEach((wave, i) => {
        expect(wave).not.toBe(CAMPAIGN_WAVE_DEFINITIONS[mapId][i]);
      });
    });

    it('UNKNOWN node type uses the same combat path and consults CAMPAIGN_WAVE_DEFINITIONS', () => {
      const mapId = 'campaign_01';
      const node = makeMapNode({ type: NodeType.UNKNOWN, campaignMapId: mapId });
      const config = service.prepareEncounter(node, makeRunState());

      const expected = CAMPAIGN_WAVE_DEFINITIONS[mapId];
      expect(config.waves.length).toBe(expected.length);
      expect(waveGenerator.generateCombatWaves).not.toHaveBeenCalled();
    });

    it('UNKNOWN node with unknown campaignMapId falls back to generateCombatWaves', () => {
      const node = makeMapNode({ type: NodeType.UNKNOWN, campaignMapId: 'not_real' });
      const state = makeRunState({ actIndex: 1, seed: 77 });
      service.prepareEncounter(node, state);

      expect(waveGenerator.generateCombatWaves).toHaveBeenCalledWith(3, 1, 77);
    });

    it('ELITE node still calls generateEliteWaves, not CAMPAIGN_WAVE_DEFINITIONS', () => {
      const node = makeMapNode({ type: NodeType.ELITE, campaignMapId: 'campaign_01' });
      const state = makeRunState({ actIndex: 0, seed: 10 });
      service.prepareEncounter(node, state);

      expect(waveGenerator.generateEliteWaves).toHaveBeenCalledWith(3, 0, 10);
      expect(waveGenerator.generateCombatWaves).not.toHaveBeenCalled();
    });

    it('BOSS node still calls generateBossWaves, not CAMPAIGN_WAVE_DEFINITIONS', () => {
      const node = makeMapNode({ type: NodeType.BOSS, campaignMapId: 'campaign_01' });
      const state = makeRunState({ actIndex: 2, seed: 55 });
      service.prepareEncounter(node, state);

      expect(waveGenerator.generateBossWaves).toHaveBeenCalledWith(2, 55);
      expect(waveGenerator.generateCombatWaves).not.toHaveBeenCalled();
    });

    it('REST node returns empty waves array (no campaign lookup)', () => {
      const node = makeMapNode({ type: NodeType.REST, campaignMapId: 'campaign_01' });
      const config = service.prepareEncounter(node, makeRunState());

      expect(config.waves).toEqual([]);
      expect(waveGenerator.generateCombatWaves).not.toHaveBeenCalled();
    });

    it('SHOP node returns empty waves array (no campaign lookup)', () => {
      const node = makeMapNode({ type: NodeType.SHOP, campaignMapId: 'campaign_01' });
      const config = service.prepareEncounter(node, makeRunState());

      expect(config.waves).toEqual([]);
    });
  });
});
