import { TestBed } from '@angular/core/testing';
import { EncounterCheckpointService } from './encounter-checkpoint.service';
import {
  EncounterCheckpoint,
  CHECKPOINT_VERSION,
} from '../../game/game-board/models/encounter-checkpoint.model';
import { GamePhase, DifficultyLevel } from '../../game/game-board/models/game-state.model';
import { NodeType } from '../models/node-map.model';
import { SerializedItemInventory } from '../models/item.model';

const CHECKPOINT_KEY = 'novarise_encounter_checkpoint';

function createTestCheckpoint(overrides: Partial<EncounterCheckpoint> = {}): EncounterCheckpoint {
  return {
    version: CHECKPOINT_VERSION,
    timestamp: Date.now(),
    nodeId: 'node_1',
    encounterConfig: {
      nodeId: 'node_1',
      nodeType: NodeType.COMBAT,
      campaignMapId: 'campaign_01',
      waves: [],
      goldReward: 50,
      isElite: false,
      isBoss: false,
    },
    rngState: 12345,
    gameState: {
      phase: GamePhase.COMBAT,
      wave: 2,
      maxWaves: 5,
      lives: 15,
      maxLives: 20,
      initialLives: 20,
      gold: 150,
      initialGold: 100,
      score: 200,
      difficulty: DifficultyLevel.NORMAL,
      isEndless: false,
      highestWave: 2,
      elapsedTime: 45,
      activeModifiers: [],
      consecutiveWavesWithoutLeak: 1,
    },
    turnNumber: 5,
    leakedThisWave: false,
    towers: [],
    mortarZones: [],
    enemies: [],
    enemyCounter: 10,
    statusEffects: [],
    waveState: {
      currentWaveIndex: 1,
      turnSchedule: [],
      turnScheduleIndex: 3,
      active: true,
      endlessMode: false,
      currentEndlessResult: null,
      nextWaveEnemySpeedMultiplier: 1,
      activeWaveCaltropsMultiplier: 1,
    },
    deckState: {
      deckState: { drawPile: [], hand: [], discardPile: [], exhaustPile: [] },
      energyState: { current: 2, max: 3 },
      instanceCounter: 5,
    },
    cardModifiers: [],
    relicFlags: { firstLeakBlockedThisWave: false, freeTowerUsedThisEncounter: false },
    gameStats: {
      totalGoldEarned: 100,
      totalDamageDealt: 500,
      shotsFired: 20,
      killsByTowerType: {},
      enemiesLeaked: 2,
      towersPlaced: 3,
      towersSold: 0,
    },
    challengeState: {
      totalGoldSpent: 50,
      maxTowersPlaced: 3,
      towerTypesUsed: [],
      currentTowerCount: 3,
      livesLostThisGame: 0,
    },
    wavePreview: { oneShotBonus: 0 },
    turnHistory: [],
    itemInventory: { entries: [] } as SerializedItemInventory,
    runStateFlags: { entries: [] },
    ...overrides,
  };
}

describe('EncounterCheckpointService', () => {
  let service: EncounterCheckpointService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EncounterCheckpointService);
    localStorage.removeItem(CHECKPOINT_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(CHECKPOINT_KEY);
  });

  describe('saveCheckpoint() / loadCheckpoint() roundtrip', () => {
    it('should save and load a checkpoint with all fields intact', () => {
      const checkpoint = createTestCheckpoint({ nodeId: 'node_42', turnNumber: 7 });

      const saved = service.saveCheckpoint(checkpoint);
      const loaded = service.loadCheckpoint();

      expect(saved).toBeTrue();
      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(CHECKPOINT_VERSION);
      expect(loaded!.nodeId).toBe('node_42');
      expect(loaded!.turnNumber).toBe(7);
      expect(loaded!.gameState.phase).toBe(GamePhase.COMBAT);
      expect(loaded!.gameState.lives).toBe(15);
      expect(loaded!.gameState.gold).toBe(150);
      expect(loaded!.encounterConfig.nodeType).toBe(NodeType.COMBAT);
      expect(loaded!.rngState).toBe(12345);
      expect(loaded!.leakedThisWave).toBeFalse();
      expect(loaded!.enemyCounter).toBe(10);
    });
  });

  describe('loadCheckpoint()', () => {
    it('should return null when no checkpoint exists', () => {
      const result = service.loadCheckpoint();
      expect(result).toBeNull();
    });

    it('should return null on corrupt data', () => {
      localStorage.setItem(CHECKPOINT_KEY, 'not json');
      const result = service.loadCheckpoint();
      expect(result).toBeNull();
    });

    it('should return null on version mismatch', () => {
      const checkpoint = createTestCheckpoint({ version: CHECKPOINT_VERSION + 1 });
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
      const result = service.loadCheckpoint();
      expect(result).toBeNull();
    });
  });

  describe('clearCheckpoint()', () => {
    it('should remove the checkpoint from localStorage', () => {
      service.saveCheckpoint(createTestCheckpoint());
      expect(service.hasCheckpoint()).toBeTrue();

      service.clearCheckpoint();

      expect(service.hasCheckpoint()).toBeFalse();
    });
  });

  describe('hasCheckpoint()', () => {
    it('should return true when a checkpoint exists', () => {
      service.saveCheckpoint(createTestCheckpoint());
      expect(service.hasCheckpoint()).toBeTrue();
    });

    it('should return false after checkpoint is cleared', () => {
      service.saveCheckpoint(createTestCheckpoint());
      service.clearCheckpoint();
      expect(service.hasCheckpoint()).toBeFalse();
    });
  });

  describe('getCheckpointNodeId()', () => {
    it('should return the nodeId without requiring a full parse', () => {
      const checkpoint = createTestCheckpoint({ nodeId: 'node_42' });
      service.saveCheckpoint(checkpoint);

      const nodeId = service.getCheckpointNodeId();

      expect(nodeId).toBe('node_42');
    });

    it('should return null when no checkpoint exists', () => {
      const nodeId = service.getCheckpointNodeId();
      expect(nodeId).toBeNull();
    });
  });

  describe('saveCheckpoint() error handling', () => {
    it('should return false when localStorage.setItem throws (quota exceeded)', () => {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');

      const result = service.saveCheckpoint(createTestCheckpoint());

      expect(result).toBeFalse();
    });

    it('lastSaveError is true after quota exceeded', () => {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');

      service.saveCheckpoint(createTestCheckpoint());

      expect(service.lastSaveError).toBeTrue();
    });

    it('lastSaveError is false after successful save following a failed save', () => {
      spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');
      service.saveCheckpoint(createTestCheckpoint());
      expect(service.lastSaveError).toBeTrue();

      (localStorage.setItem as jasmine.Spy).and.callThrough();
      service.saveCheckpoint(createTestCheckpoint());

      expect(service.lastSaveError).toBeFalse();
    });
  });

  describe('loadCheckpoint() migration framework', () => {
    it('applies migrations when version is lower than CHECKPOINT_VERSION', () => {
      // Install a test migration: version 0 → CHECKPOINT_VERSION
      // We do this by storing a checkpoint at version 0 and adding a migration
      // that bumps it directly to CHECKPOINT_VERSION with required fields intact.
      const checkpoint = createTestCheckpoint({ version: 0 });
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));

      // Patch the private migrations map for this test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).migrations[0] = (data: Record<string, unknown>) => {
        data['version'] = CHECKPOINT_VERSION;
        return data;
      };

      const loaded = service.loadCheckpoint();

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(CHECKPOINT_VERSION);
      expect(loaded!.nodeId).toBe('node_1');
    });

    it('clears checkpoint and returns null when no migration path exists', () => {
      const checkpoint = createTestCheckpoint({ version: 99 });
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));

      const loaded = service.loadCheckpoint();

      expect(loaded).toBeNull();
      expect(service.hasCheckpoint()).toBeFalse();
    });

    it('migrates v2 to v3 by adding turnHistory as empty array', () => {
      // Store a v2 checkpoint (no turnHistory field) directly in localStorage.
      const v2Checkpoint = createTestCheckpoint({ version: 2 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v2Data = { ...(v2Checkpoint as any) };
      delete v2Data['turnHistory'];
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(v2Data));

      const loaded = service.loadCheckpoint();

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(CHECKPOINT_VERSION);
      expect(loaded!.turnHistory).toEqual([]);
    });

    it('migrates v3 to v4 by backfilling deckRngState as undefined', () => {
      // Store a v3 checkpoint (no deckRngState field) directly in localStorage.
      const v3Checkpoint = createTestCheckpoint({ version: 3 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v3Data = { ...(v3Checkpoint as any) };
      delete v3Data['deckRngState'];
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(v3Data));

      const loaded = service.loadCheckpoint();

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(CHECKPOINT_VERSION);
      // deckRngState may be absent (undefined) after JSON round-trip — restore path must handle this
      expect(loaded!.deckRngState).toBeUndefined();
    });

    it('deckRngState round-trips correctly when present in a v4 checkpoint', () => {
      const checkpoint = createTestCheckpoint({ deckRngState: 42000 });

      service.saveCheckpoint(checkpoint);
      const loaded = service.loadCheckpoint();

      expect(loaded).not.toBeNull();
      expect(loaded!.deckRngState).toBe(42000);
    });

    it('migrates v4 to v5 by inserting empty itemInventory', () => {
      // Store a v4 checkpoint (no itemInventory field) directly in localStorage.
      const v4Checkpoint = createTestCheckpoint({ version: 4 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v4Data = { ...(v4Checkpoint as any) };
      delete v4Data['itemInventory'];
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(v4Data));

      const loaded = service.loadCheckpoint();

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(CHECKPOINT_VERSION);
      expect(loaded!.itemInventory).toEqual({ entries: [] });
    });

    it('itemInventory round-trips correctly when populated in a v5 checkpoint', () => {
      const checkpoint = createTestCheckpoint({
        itemInventory: { entries: [['bomb', 2], ['heal_potion', 1]] },
      });

      service.saveCheckpoint(checkpoint);
      const loaded = service.loadCheckpoint();

      expect(loaded).not.toBeNull();
      expect(loaded!.itemInventory.entries.length).toBe(2);
      const bombEntry = loaded!.itemInventory.entries.find(e => e[0] === 'bomb');
      expect(bombEntry?.[1]).toBe(2);
    });

    it('migrates v6 to v7 by inserting CALTROPS multiplier defaults (1, 1) into waveState', () => {
      // Build a v6 checkpoint (no CALTROPS fields on waveState)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v6Data: Record<string, any> = {
        ...createTestCheckpoint({ version: 6 }),
        version: 6,
        waveState: {
          currentWaveIndex: 1,
          turnSchedule: [],
          turnScheduleIndex: 3,
          active: true,
          endlessMode: false,
          currentEndlessResult: null,
          // nextWaveEnemySpeedMultiplier and activeWaveCaltropsMultiplier intentionally absent
        },
      };
      localStorage.setItem('novarise_encounter_checkpoint', JSON.stringify(v6Data));

      const loaded = service.loadCheckpoint();

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(CHECKPOINT_VERSION);
      expect(loaded!.waveState.nextWaveEnemySpeedMultiplier).toBe(1);
      expect(loaded!.waveState.activeWaveCaltropsMultiplier).toBe(1);
    });
  });

  describe('loadCheckpoint() structural validation', () => {
    it('returns null for structurally invalid data missing nodeId', () => {
      const data = {
        version: CHECKPOINT_VERSION,
        timestamp: Date.now(),
        // nodeId intentionally omitted
        encounterConfig: {},
        gameState: {},
      };
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data));

      const loaded = service.loadCheckpoint();

      expect(loaded).toBeNull();
    });

    it('clears checkpoint when structural validation fails', () => {
      const data = {
        version: CHECKPOINT_VERSION,
        timestamp: Date.now(),
        encounterConfig: {},
        gameState: {},
      };
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data));

      service.loadCheckpoint();

      expect(service.hasCheckpoint()).toBeFalse();
    });
  });
});
