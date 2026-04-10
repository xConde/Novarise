import { TestBed } from '@angular/core/testing';
import { EncounterService } from './encounter.service';
import { WaveGeneratorService } from './wave-generator.service';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { CampaignMapService } from '../../campaign/services/campaign-map.service';
import { MapNode, NodeType } from '../models/node-map.model';
import { RunState, RunStatus, DEFAULT_RUN_CONFIG } from '../models/run-state.model';
import { WaveDefinition } from '../../game/game-board/models/wave.model';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { REWARD_CONFIG } from '../constants/ascent.constants';

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
  let campaignMapService: jasmine.SpyObj<CampaignMapService>;

  beforeEach(() => {
    waveGenerator = jasmine.createSpyObj('WaveGeneratorService', [
      'generateCombatWaves',
      'generateEliteWaves',
      'generateBossWaves',
    ]);
    mapBridge = jasmine.createSpyObj('MapBridgeService', ['setEditorMapState']);
    campaignMapService = jasmine.createSpyObj('CampaignMapService', ['loadLevel']);

    waveGenerator.generateCombatWaves.and.returnValue(STUB_WAVES);
    waveGenerator.generateEliteWaves.and.returnValue(STUB_WAVES);
    waveGenerator.generateBossWaves.and.returnValue(STUB_WAVES);
    campaignMapService.loadLevel.and.returnValue(MOCK_MAP_STATE);

    TestBed.configureTestingModule({
      providers: [
        EncounterService,
        { provide: WaveGeneratorService, useValue: waveGenerator },
        { provide: MapBridgeService, useValue: mapBridge },
        { provide: CampaignMapService, useValue: campaignMapService },
      ],
    });

    service = TestBed.inject(EncounterService);
  });

  // ── prepareEncounter: COMBAT ──────────────────────────────────

  it('prepareEncounter() for COMBAT node returns correct EncounterConfig shape', () => {
    const node = makeMapNode({ type: NodeType.COMBAT });
    const config = service.prepareEncounter(node, makeRunState());

    expect(config.nodeId).toBe('node_3_1');
    expect(config.nodeType).toBe(NodeType.COMBAT);
    expect(config.campaignMapId).toBe('campaign_05');
    expect(config.isElite).toBeFalse();
    expect(config.isBoss).toBeFalse();
  });

  it('prepareEncounter() for COMBAT node delegates to generateCombatWaves', () => {
    const node = makeMapNode({ type: NodeType.COMBAT });
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

    expect(campaignMapService.loadLevel).toHaveBeenCalledWith('campaign_03');
    expect(mapBridge.setEditorMapState).toHaveBeenCalledWith(MOCK_MAP_STATE, 'campaign_03');
  });

  it('loadEncounterMap() throws when campaign map is not found', () => {
    campaignMapService.loadLevel.and.returnValue(null);

    const node = makeMapNode({ campaignMapId: 'nonexistent_map' });
    const encounterConfig = service.prepareEncounter(node, makeRunState());

    expect(() => service.loadEncounterMap(encounterConfig)).toThrowError(
      /nonexistent_map/,
    );
  });
});
