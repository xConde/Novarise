import { TestBed } from '@angular/core/testing';
import { WavePreviewService } from './wave-preview.service';
import { WaveService } from './wave.service';
import { RelicService } from '../../../run/services/relic.service';
import { EnemyType } from '../models/enemy.model';
import { WaveDefinition } from '../models/wave.model';

/**
 * WavePreviewService — isolates:
 *  - One-shot bonus accumulation (scout spells)
 *  - Permanent bonus read-through to RelicService
 *  - Future-wave summary across BOTH wave formats (`entries[]` legacy and
 *    `spawnTurns[][]` authored).
 *  - Encounter reset semantics (one-shot cleared, permanent untouched)
 *  - Serialize/restore roundtrip
 *
 * All WaveService and RelicService interactions are mocked — this spec
 * validates pure logic in WavePreviewService, not its collaborators.
 */
describe('WavePreviewService', () => {
  let service: WavePreviewService;
  let waveSpy: jasmine.SpyObj<WaveService>;
  let relicSpy: jasmine.SpyObj<RelicService>;

  function mockRelicBonus(bonus: number): void {
    // Full RelicModifiers shape — only wavePreviewBonus varies per test.
    // Defaults mirror BASELINE_MODIFIERS in RelicService.
    relicSpy.getModifiers.and.returnValue({
      damageMultiplier: 1,
      rangeMultiplier: 1,
      towerCostMultiplier: 1,
      upgradeCostMultiplier: 1,
      sellRefundRate: 0.5,
      goldMultiplier: 1,
      enemySpeedMultiplier: 1,
      maxLivesBonus: 0,
      startingGoldBonus: 0,
      splashRadiusMultiplier: 1,
      chainBounceBonus: 0,
      dotDamageMultiplier: 1,
      wavePreviewBonus: bonus,
    });
  }

  beforeEach(() => {
    waveSpy = jasmine.createSpyObj<WaveService>('WaveService', ['getWaveDefinitions']);
    relicSpy = jasmine.createSpyObj<RelicService>('RelicService', ['getModifiers']);
    mockRelicBonus(0);
    waveSpy.getWaveDefinitions.and.returnValue([]);

    TestBed.configureTestingModule({
      providers: [
        WavePreviewService,
        { provide: WaveService, useValue: waveSpy },
        { provide: RelicService, useValue: relicSpy },
      ],
    });
    service = TestBed.inject(WavePreviewService);
  });

  // ── Depth composition ──────────────────────────────────────────────────

  describe('getPreviewDepth', () => {
    it('returns 0 when no bonus is active', () => {
      expect(service.getPreviewDepth()).toBe(0);
    });

    it('returns permanent bonus alone when no one-shot bonus added', () => {
      mockRelicBonus(2);
      expect(service.getPreviewDepth()).toBe(2);
    });

    it('returns one-shot bonus alone when no permanent bonus', () => {
      service.addOneShotBonus(3);
      expect(service.getPreviewDepth()).toBe(3);
    });

    it('sums permanent + one-shot bonuses', () => {
      mockRelicBonus(2);
      service.addOneShotBonus(3);
      expect(service.getPreviewDepth()).toBe(5);
    });

    it('accumulates multiple one-shot grants (SCOUT_AHEAD + SCOUT_ELITE in same encounter)', () => {
      service.addOneShotBonus(3);
      service.addOneShotBonus(5);
      expect(service.getPreviewDepth()).toBe(8);
    });

    it('ignores non-positive one-shot deltas (data guard)', () => {
      service.addOneShotBonus(0);
      service.addOneShotBonus(-2);
      expect(service.getPreviewDepth()).toBe(0);
    });
  });

  // ── Future-wave summary ────────────────────────────────────────────────

  describe('getFutureWavesSummary', () => {
    it('returns [] when preview depth is 0', () => {
      waveSpy.getWaveDefinitions.and.returnValue([
        { entries: [{ type: EnemyType.BASIC, count: 5, spawnInterval: 1 }], reward: 50 },
      ]);
      expect(service.getFutureWavesSummary(0)).toEqual([]);
    });

    it('groups legacy entries[] format correctly', () => {
      service.addOneShotBonus(1);
      const defs: WaveDefinition[] = [
        { entries: [{ type: EnemyType.BASIC, count: 5, spawnInterval: 1 }], reward: 50 }, // wave 1
        {
          entries: [
            { type: EnemyType.BASIC, count: 3, spawnInterval: 1 },
            { type: EnemyType.FAST, count: 2, spawnInterval: 1 },
          ],
          reward: 60,
        }, // wave 2
      ];
      waveSpy.getWaveDefinitions.and.returnValue(defs);

      // Player is on wave index 0 → should see next wave (index 1)
      const out = service.getFutureWavesSummary(0);

      expect(out.length).toBe(1);
      expect(out[0].waveNumber).toBe(2);
      expect(out[0].enemies).toEqual([
        { type: EnemyType.BASIC, count: 3 },
        { type: EnemyType.FAST, count: 2 },
      ]);
    });

    it('groups authored spawnTurns[][] format correctly', () => {
      service.addOneShotBonus(1);
      const defs: WaveDefinition[] = [
        { entries: [{ type: EnemyType.BASIC, count: 1, spawnInterval: 1 }], reward: 50 }, // wave 1
        {
          // 2× BASIC, prep, 1× HEAVY, 1× BOSS
          spawnTurns: [
            [EnemyType.BASIC, EnemyType.BASIC],
            [],
            [EnemyType.HEAVY],
            [EnemyType.BOSS],
          ],
          reward: 100,
        }, // wave 2
      ];
      waveSpy.getWaveDefinitions.and.returnValue(defs);

      const out = service.getFutureWavesSummary(0);

      expect(out.length).toBe(1);
      expect(out[0].waveNumber).toBe(2);
      expect(out[0].enemies).toEqual([
        { type: EnemyType.BASIC, count: 2 },
        { type: EnemyType.HEAVY, count: 1 },
        { type: EnemyType.BOSS, count: 1 },
      ]);
    });

    it('prefers spawnTurns over entries when both are set on the same wave', () => {
      service.addOneShotBonus(1);
      const defs: WaveDefinition[] = [
        { entries: [{ type: EnemyType.BASIC, count: 1, spawnInterval: 1 }], reward: 50 },
        {
          entries: [{ type: EnemyType.FAST, count: 99, spawnInterval: 1 }],
          spawnTurns: [[EnemyType.BASIC]],
          reward: 50,
        },
      ];
      waveSpy.getWaveDefinitions.and.returnValue(defs);

      const out = service.getFutureWavesSummary(0);
      expect(out[0].enemies).toEqual([{ type: EnemyType.BASIC, count: 1 }]);
    });

    it('respects depth and does not over-read past end of wave list', () => {
      service.addOneShotBonus(5);
      const defs: WaveDefinition[] = [
        { entries: [{ type: EnemyType.BASIC, count: 1, spawnInterval: 1 }], reward: 50 }, // wave 1
        { entries: [{ type: EnemyType.FAST, count: 1, spawnInterval: 1 }], reward: 50 }, // wave 2
      ];
      waveSpy.getWaveDefinitions.and.returnValue(defs);

      // Current wave = 0 (1-indexed: wave 1), depth = 5 but only wave 2 exists past it.
      const out = service.getFutureWavesSummary(0);
      expect(out.length).toBe(1);
      expect(out[0].waveNumber).toBe(2);
    });

    it('returns [] when current wave is already the last', () => {
      service.addOneShotBonus(3);
      const defs: WaveDefinition[] = [
        { entries: [{ type: EnemyType.BASIC, count: 1, spawnInterval: 1 }], reward: 50 },
      ];
      waveSpy.getWaveDefinitions.and.returnValue(defs);

      // currentWaveIndex = 0 (the only wave). No future waves.
      expect(service.getFutureWavesSummary(0)).toEqual([]);
    });

    it('preserves EnemyType insertion order in grouped output', () => {
      service.addOneShotBonus(1);
      const defs: WaveDefinition[] = [
        { entries: [{ type: EnemyType.BASIC, count: 1, spawnInterval: 1 }], reward: 50 },
        {
          // HEAVY appears before FAST in the entries list
          entries: [
            { type: EnemyType.HEAVY, count: 2, spawnInterval: 1 },
            { type: EnemyType.FAST, count: 3, spawnInterval: 1 },
          ],
          reward: 50,
        },
      ];
      waveSpy.getWaveDefinitions.and.returnValue(defs);

      const out = service.getFutureWavesSummary(0);
      // HEAVY must come first — preserves insertion order from the wave definition.
      expect(out[0].enemies[0].type).toBe(EnemyType.HEAVY);
      expect(out[0].enemies[1].type).toBe(EnemyType.FAST);
    });

    it('returns depth-many future waves when enough exist', () => {
      service.addOneShotBonus(3);
      const defs: WaveDefinition[] = [
        { entries: [{ type: EnemyType.BASIC, count: 1, spawnInterval: 1 }], reward: 50 }, // w1
        { entries: [{ type: EnemyType.BASIC, count: 2, spawnInterval: 1 }], reward: 50 }, // w2
        { entries: [{ type: EnemyType.BASIC, count: 3, spawnInterval: 1 }], reward: 50 }, // w3
        { entries: [{ type: EnemyType.BASIC, count: 4, spawnInterval: 1 }], reward: 50 }, // w4
        { entries: [{ type: EnemyType.BASIC, count: 5, spawnInterval: 1 }], reward: 50 }, // w5
      ];
      waveSpy.getWaveDefinitions.and.returnValue(defs);

      const out = service.getFutureWavesSummary(0); // on wave 1, reveal next 3

      expect(out.map(w => w.waveNumber)).toEqual([2, 3, 4]);
    });
  });

  // ── Reset ──────────────────────────────────────────────────────────────

  describe('resetForEncounter', () => {
    it('clears one-shot bonus', () => {
      service.addOneShotBonus(5);
      service.resetForEncounter();
      expect(service.getPreviewDepth()).toBe(0);
    });

    it('does NOT affect permanent bonus (which lives on RelicService)', () => {
      mockRelicBonus(2);
      service.addOneShotBonus(3);
      service.resetForEncounter();
      // One-shot cleared, permanent remains (relic still held).
      expect(service.getPreviewDepth()).toBe(2);
    });
  });

  // ── Serialize / restore ───────────────────────────────────────────────

  describe('serialize / restore', () => {
    it('roundtrips the one-shot bonus', () => {
      service.addOneShotBonus(4);
      const snapshot = service.serialize();
      expect(snapshot).toEqual({ oneShotBonus: 4 });

      // Fresh service instance, restored from snapshot
      const restored = new WavePreviewService(waveSpy, relicSpy);
      restored.restore(snapshot);
      expect(restored.getPreviewDepth()).toBe(4);
    });

    it('restore overrides prior state', () => {
      service.addOneShotBonus(10);
      service.restore({ oneShotBonus: 2 });
      expect(service.getPreviewDepth()).toBe(2);
    });

    // ── Defensive restore (red-team Finding 1) ──────────────────────────

    it('restore coerces null snapshot to zero bonus', () => {
      service.addOneShotBonus(5);
      service.restore(null);
      expect(service.getPreviewDepth()).toBe(0);
    });

    it('restore coerces undefined snapshot to zero bonus', () => {
      service.addOneShotBonus(5);
      service.restore(undefined);
      expect(service.getPreviewDepth()).toBe(0);
    });

    it('restore coerces non-number oneShotBonus to zero (malformed checkpoint)', () => {
      service.addOneShotBonus(5);
      // Simulate a hand-edited checkpoint where the field is a string.
      service.restore({ oneShotBonus: 'lol' as unknown as number });
      expect(service.getPreviewDepth()).toBe(0);
    });

    it('restore coerces negative oneShotBonus to zero', () => {
      service.restore({ oneShotBonus: -3 });
      expect(service.getPreviewDepth()).toBe(0);
    });

    it('restore coerces NaN oneShotBonus to zero', () => {
      service.restore({ oneShotBonus: NaN });
      expect(service.getPreviewDepth()).toBe(0);
    });

    it('restore coerces fractional oneShotBonus via Math.floor', () => {
      service.restore({ oneShotBonus: 3.8 });
      expect(service.getPreviewDepth()).toBe(3);
    });
  });
});
