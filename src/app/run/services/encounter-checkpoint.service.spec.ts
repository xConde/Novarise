import { TestBed } from '@angular/core/testing';
import { EncounterCheckpointService } from './encounter-checkpoint.service';
import {
  EncounterCheckpoint,
  CHECKPOINT_VERSION,
} from '../../game/game-board/models/encounter-checkpoint.model';
import { GamePhase, DifficultyLevel } from '../../game/game-board/models/game-state.model';
import { NodeType } from '../models/node-map.model';

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
