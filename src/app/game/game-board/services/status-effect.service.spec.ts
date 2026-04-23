import { TestBed } from '@angular/core/testing';
import { StatusEffectService } from './status-effect.service';
import { EnemyService } from './enemy.service';
import { StatusEffectType, STATUS_EFFECT_CONFIGS } from '../constants/status-effect.constants';
import { Enemy, EnemyType } from '../models/enemy.model';
import { createTestEnemy, createEnemyServiceSpy, createRelicServiceSpy } from '../testing';
import { RelicService } from '../../../run/services/relic.service';
import { SerializableStatusEffect } from '../models/encounter-checkpoint.model';

/** Local mirror of the unexported ActiveEffect subset used in FROST_NOVA duration specs. */
interface ActiveEffectSnapshot {
  expiresAt: number;
}

interface TestableStatusEffectService {
  effects: Map<string, Map<StatusEffectType, ActiveEffectSnapshot>>;
}

describe('StatusEffectService', () => {
  let service: StatusEffectService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let relicServiceSpy: jasmine.SpyObj<RelicService>;
  let enemyMap: Map<string, Enemy>;

  /** Adapter matching the local (id, health, speed, isFlying) call signature. */
  function createEnemy(id: string, health = 100, speed = 2, isFlying = false): Enemy {
    return createTestEnemy(id, 0, 0, health, {
      type: isFlying ? EnemyType.FLYING : EnemyType.BASIC,
      speed,
      isFlying,
    });
  }

  beforeEach(() => {
    enemyMap = new Map();

    enemyServiceSpy = createEnemyServiceSpy(enemyMap);
    relicServiceSpy = createRelicServiceSpy();

    TestBed.configureTestingModule({
      providers: [
        StatusEffectService,
        { provide: EnemyService, useValue: enemyServiceSpy },
        { provide: RelicService, useValue: relicServiceSpy },
      ],
    });
    service = TestBed.inject(StatusEffectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- apply() SLOW ---

  describe('apply() SLOW', () => {
    it('should apply SLOW effect and reduce enemy speed', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      const result = service.apply('e1', StatusEffectType.SLOW, 0);

      expect(result).toBe(true);
      const expectedSpeed = 4 * STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].speedMultiplier!;
      expect(enemy.speed).toBe(expectedSpeed);
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(true);
    });

    it('should return false for flying enemies (immunity)', () => {
      const enemy = createEnemy('e1', 100, 4, true);
      enemyMap.set('e1', enemy);

      const result = service.apply('e1', StatusEffectType.SLOW, 0);

      expect(result).toBe(false);
      expect(enemy.speed).toBe(4); // unchanged
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(false);
    });

    it('should refresh duration without double-slowing', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);
      const speedAfterFirst = enemy.speed;

      // Re-apply at gameTime=1 — should refresh, not double-slow
      service.apply('e1', StatusEffectType.SLOW, 1);

      expect(enemy.speed).toBe(speedAfterFirst);
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(true);
    });

    it('should return false for non-existent enemy', () => {
      expect(service.apply('nonexistent', StatusEffectType.SLOW, 0)).toBe(false);
    });

    it('should return false for dead enemy', () => {
      const enemy = createEnemy('e1', 0, 4);
      enemyMap.set('e1', enemy);

      expect(service.apply('e1', StatusEffectType.SLOW, 0)).toBe(false);
    });
  });

  // --- tickTurn() SLOW expiry ---
  // Turn-based: apply(id, SLOW, gameTime) sets expiresAt = gameTime + duration (turns).
  // tickTurn(turnNumber) removes the effect when turnNumber >= expiresAt.

  describe('tickTurn() SLOW expiry', () => {
    it('should expire SLOW and restore original speed when turn >= expiresAt', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      // apply at turnNumber=0 → expiresAt = 0 + duration = 2
      service.apply('e1', StatusEffectType.SLOW, 0);
      const slowDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].duration;

      // Tick at turnNumber=expiresAt — effect should expire
      service.tickTurn(slowDuration);

      expect(enemy.speed).toBe(4); // restored
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(false);
    });

    it('should not expire SLOW before expiresAt is reached', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      // apply at turnNumber=0 → expiresAt = 2
      service.apply('e1', StatusEffectType.SLOW, 0);
      const expectedSpeed = 4 * STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].speedMultiplier!;

      // Tick at turn 1 — still before expiresAt (2)
      service.tickTurn(1);

      expect(enemy.speed).toBe(expectedSpeed);
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(true);
    });
  });

  // --- apply() BURN ---

  describe('apply() BURN', () => {
    it('should apply BURN effect', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      const result = service.apply('e1', StatusEffectType.BURN, 0);

      expect(result).toBe(true);
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(true);
      // BURN does not modify speed
      expect(enemy.speed).toBe(4);
    });

    // Phase 1 Sprint 5 — durationOverride parameter (used by INCINERATE upgrade).
    it('extends duration when durationOverride > config.duration (BURN)', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      const configDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN].duration;
      const override = configDuration + 10;
      service.apply('e1', StatusEffectType.BURN, 0, undefined, override);

      // At turn = configDuration, base BURN would have expired but override keeps it active.
      service.tickTurn(configDuration);
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBeTrue();

      // At turn = override, the effect expires.
      service.tickTurn(override);
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBeFalse();
    });

    it('falls back to config.duration when durationOverride is undefined', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      const configDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN].duration;
      service.apply('e1', StatusEffectType.BURN, 0, undefined, undefined);

      service.tickTurn(configDuration);
      // Should expire at exactly config.duration when no override.
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBeFalse();
    });

    it('falls back to config.duration when durationOverride is 0', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      const configDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN].duration;
      service.apply('e1', StatusEffectType.BURN, 0, undefined, 0);

      service.tickTurn(configDuration);
      // 0 should be treated as "no override" — same as undefined.
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBeFalse();
    });
  });

  // --- tickTurn() BURN ticking ---
  // Turn-based: DoT fires exactly once per tickTurn() call.
  // apply(id, BURN, 1) → expiresAt = 1 + duration = 4. tickTurn(2) deals damage.

  describe('tickTurn() BURN ticking', () => {
    it('should tick BURN damage once per tickTurn call', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      // Apply at turn 1 → expiresAt = 1 + 3 = 4
      service.apply('e1', StatusEffectType.BURN, 1);
      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];

      // Tick at turn 2 — within duration, should apply damage once
      service.tickTurn(2);

      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith('e1', burnCfg.damagePerTick!);
    });

    it('should not tick BURN after duration expires', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];
      // Apply at turn 0 → expiresAt = 3
      service.apply('e1', StatusEffectType.BURN, 0);

      // Tick at turn 3 (= expiresAt) — effect should be removed, no damage
      service.tickTurn(burnCfg.duration);

      expect(enemyServiceSpy.damageEnemy).not.toHaveBeenCalled();
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
    });

    it('should kill enemy when health reaches 0 from DoT', () => {
      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];
      // Enemy with exactly enough health to die on first tick
      const enemy = createEnemy('e1', burnCfg.damagePerTick!, 4);
      enemyMap.set('e1', enemy);

      // Apply at turn 1 → expiresAt = 4
      service.apply('e1', StatusEffectType.BURN, 1);

      // Tick at turn 2 — within duration, should apply damage and kill
      const kills = service.tickTurn(2);

      expect(kills.length).toBe(1);
      expect(kills[0].id).toBe('e1');
      expect(kills[0].damage).toBe(burnCfg.damagePerTick!);
    });

    it('should return KillInfo for DoT kills', () => {
      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];
      const enemy = createEnemy('e1', 1, 4); // very low health
      enemyMap.set('e1', enemy);

      // Apply at turn 1 → expiresAt = 4
      service.apply('e1', StatusEffectType.BURN, 1);
      const kills = service.tickTurn(2);

      expect(kills.length).toBe(1);
      expect(kills[0]).toEqual({ id: 'e1', damage: burnCfg.damagePerTick!, towerType: null, towerLevel: 0 });
    });
  });

  // --- DoT tick-order contract ---
  //
  // Contract: expire-first.
  // tickTurn() checks `turnNumber >= expiresAt` BEFORE applying damage.
  // A duration-N effect applied at turn T fires on turns T+1 to T+N-1 (N-1 ticks).
  // BURN duration=3: expiresAt = 0+3 = 3. Fires on turns 1 and 2. Total = 2 x 5 = 10.

  describe('DoT tick-order contract', () => {
    it('contract: DoT is expire-first -- duration-3 BURN applies 2 ticks totaling 10 dmg', () => {
      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];
      expect(burnCfg.duration).toBe(3);
      expect(burnCfg.damagePerTick).toBe(5);

      // Track cumulative damage applied to the enemy via damageEnemy spy.
      let totalDamage = 0;
      enemyServiceSpy.damageEnemy.and.callFake((_id: string, dmg: number) => {
        totalDamage += dmg;
        return { killed: false, spawnedEnemies: [] };
      });

      const enemy = createEnemy('e1', 999, 4);
      enemyMap.set('e1', enemy);

      // Apply at turn 0 => expiresAt = 0 + 3 = 3
      service.apply('e1', StatusEffectType.BURN, 0);

      // Turn 1: 1 < 3 => damage fires (total = 5)
      service.tickTurn(1);
      // Turn 2: 2 < 3 => damage fires (total = 10)
      service.tickTurn(2);
      // Turn 3: 3 >= 3 => effect expires, NO damage this turn
      service.tickTurn(3);

      expect(totalDamage).toBe(10); // 2 ticks x 5, NOT 3 ticks x 5 = 15
      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledTimes(2);
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
    });

    it('contract: turn equal to expiresAt causes expiry with zero damage that turn', () => {
      let damageCalled = false;
      enemyServiceSpy.damageEnemy.and.callFake((_id: string, _dmg: number) => {
        damageCalled = true;
        return { killed: false, spawnedEnemies: [] };
      });

      const enemy = createEnemy('e1', 999, 4);
      enemyMap.set('e1', enemy);

      // Apply at turn 0 => expiresAt = 3
      service.apply('e1', StatusEffectType.BURN, 0);

      // Skip straight to the expiry turn
      service.tickTurn(3);

      expect(damageCalled).toBe(false);
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
    });
  });

  // --- POISON ticking ---
  // Turn-based: Both BURN and POISON apply damagePerTick
  // exactly once per tickTurn() call. Both fire on the same turn.

  describe('POISON ticking', () => {
    it('should apply POISON damage once per tickTurn call', () => {
      const enemy = createEnemy('e1', 200, 4);
      enemyMap.set('e1', enemy);

      const poisonCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.POISON];

      // Apply at turn 1 → expiresAt = 1 + 4 = 5
      service.apply('e1', StatusEffectType.POISON, 1);

      // Tick at turn 2 — should deal damage once
      service.tickTurn(2);
      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledTimes(1);
      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith('e1', poisonCfg.damagePerTick!);
    });

    it('should apply both BURN and POISON damage in a single tickTurn call', () => {
      const enemy = createEnemy('e1', 200, 4);
      enemyMap.set('e1', enemy);

      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];
      const poisonCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.POISON];

      // Apply both at turn 1
      service.apply('e1', StatusEffectType.BURN, 1);
      service.apply('e1', StatusEffectType.POISON, 1);

      // Tick at turn 2 — both fire in the same call (no interval differentiation in turn-based)
      service.tickTurn(2);
      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledTimes(2);
      // Both damage values should appear in calls (order may vary)
      const callArgs = enemyServiceSpy.damageEnemy.calls.allArgs();
      const damages = callArgs.map(a => a[1]).sort((a, b) => a - b);
      expect(damages).toContain(burnCfg.damagePerTick!);
      expect(damages).toContain(poisonCfg.damagePerTick!);
    });
  });

  // --- removeEffect ---

  describe('removeEffect()', () => {
    it('removes BURN from an enemy with BURN active', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);
      service.removeEffect('e1', StatusEffectType.BURN);

      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
    });

    it('removes BURN but leaves POISON intact on an enemy with both', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);
      service.apply('e1', StatusEffectType.POISON, 0);

      service.removeEffect('e1', StatusEffectType.BURN);

      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
      expect(service.hasEffect('e1', StatusEffectType.POISON)).toBe(true);
    });

    it('is a no-op for an enemy with no effects', () => {
      expect(() => service.removeEffect('e1', StatusEffectType.BURN)).not.toThrow();
    });

    it('is a no-op when the enemy has only POISON and BURN is removed', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.POISON, 0);
      service.removeEffect('e1', StatusEffectType.BURN);

      expect(service.hasEffect('e1', StatusEffectType.POISON)).toBe(true);
    });

    it('removes SLOW and restores enemy speed to originalSpeed', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);
      expect(enemy.speed).toBeLessThan(4);

      service.removeEffect('e1', StatusEffectType.SLOW);

      expect(enemy.speed).toBe(4);
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(false);
    });

    it('prunes the inner map when removing the last effect', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);
      service.removeEffect('e1', StatusEffectType.BURN);

      expect(service.getEffects('e1')).toEqual([]);
    });

    it('is a no-op for an enemy that was never tracked', () => {
      expect(() => service.removeEffect('never-tracked', StatusEffectType.POISON)).not.toThrow();
      expect(service.hasEffect('never-tracked', StatusEffectType.POISON)).toBe(false);
    });
  });

  // --- removeAllEffects ---

  describe('removeAllEffects()', () => {
    it('should restore speed and clear effects', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e1', StatusEffectType.BURN, 0);

      expect(enemy.speed).toBe(4 * STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].speedMultiplier!);

      service.removeAllEffects('e1');

      expect(enemy.speed).toBe(4); // restored
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(false);
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
      expect(service.getEffects('e1')).toEqual([]);
    });

    it('should be safe to call for unknown enemy', () => {
      expect(() => service.removeAllEffects('nonexistent')).not.toThrow();
    });
  });

  // --- cleanup ---

  describe('cleanup()', () => {
    it('should wipe all tracked effects and restore speeds', () => {
      const e1 = createEnemy('e1', 100, 4);
      const e2 = createEnemy('e2', 100, 6);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e2', StatusEffectType.SLOW, 0);
      service.apply('e1', StatusEffectType.BURN, 0);

      service.cleanup();

      expect(e1.speed).toBe(4);
      expect(e2.speed).toBe(6);
      expect(service.getEffects('e1')).toEqual([]);
      expect(service.getEffects('e2')).toEqual([]);
    });
  });

  // --- hasEffect ---

  describe('hasEffect()', () => {
    it('should return true for active effect', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);

      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(true);
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(false);
    });

    it('should return false for unknown enemy', () => {
      expect(service.hasEffect('nonexistent', StatusEffectType.BURN)).toBe(false);
    });
  });

  // --- getEffects ---

  describe('getEffects()', () => {
    it('should return all active effect types', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e1', StatusEffectType.BURN, 0);

      const effects = service.getEffects('e1');

      expect(effects).toContain(StatusEffectType.SLOW);
      expect(effects).toContain(StatusEffectType.BURN);
      expect(effects.length).toBe(2);
    });

    it('should return empty array for unknown enemy', () => {
      expect(service.getEffects('nonexistent')).toEqual([]);
    });
  });

  // --- Dead enemy auto-cleanup ---

  describe('dead enemy auto-cleanup', () => {
    it('should auto-clean effects for dead enemies on next tickTurn', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      // Apply at turn 1 → expiresAt = 4
      service.apply('e1', StatusEffectType.BURN, 1);

      // Kill the enemy externally
      enemy.health = 0;

      // tickTurn at turn 2 — enemy is dead, should clean up its effects
      service.tickTurn(2);

      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
      expect(service.getEffects('e1')).toEqual([]);
    });

    it('should auto-clean effects when enemy is removed from map', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);

      // Remove enemy from map entirely
      enemyMap.delete('e1');

      // tickTurn at turn 1 — enemy gone, should clean up
      service.tickTurn(1);

      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(false);
    });
  });

  // --- getAllActiveEffects ---

  describe('getAllActiveEffects()', () => {
    it('should return empty map when no effects', () => {
      const result = service.getAllActiveEffects();

      expect(result.size).toBe(0);
    });

    it('should return correct effects for enemies with active effects', () => {
      const e1 = createEnemy('e1', 100, 4);
      const e2 = createEnemy('e2', 100, 4);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.apply('e1', StatusEffectType.BURN, 0);
      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e2', StatusEffectType.POISON, 0);

      const result = service.getAllActiveEffects();

      expect(result.size).toBe(2);
      expect(result.get('e1')).toContain(StatusEffectType.BURN);
      expect(result.get('e1')).toContain(StatusEffectType.SLOW);
      expect(result.get('e1')!.length).toBe(2);
      expect(result.get('e2')).toContain(StatusEffectType.POISON);
      expect(result.get('e2')!.length).toBe(1);
    });

    it('should return the same Map reference across calls (no per-frame allocation)', () => {
      const e1 = createEnemy('e1', 100, 4);
      enemyMap.set('e1', e1);

      service.apply('e1', StatusEffectType.BURN, 0);

      const first = service.getAllActiveEffects();
      const second = service.getAllActiveEffects();

      expect(first).toBe(second);
    });

    it('should not include expired effects', () => {
      const e1 = createEnemy('e1', 100, 4);
      enemyMap.set('e1', e1);

      // Apply at turn 0 → expiresAt = 3
      service.apply('e1', StatusEffectType.BURN, 0);

      const burnDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN].duration;
      // Tick at turnNumber = duration (= expiresAt) — effect should expire
      service.tickTurn(burnDuration);

      const result = service.getAllActiveEffects();

      expect(result.size).toBe(0);
    });
  });

  // --- checkpoint serialization ---

  describe('checkpoint serialization', () => {
    it('serializeEffects() flattens nested Map to array', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e1', StatusEffectType.BURN, 0);

      const serialized = service.serializeEffects();

      expect(serialized.length).toBe(2);
      const slowEntry = serialized.find(s => s.effectType === StatusEffectType.SLOW);
      const burnEntry = serialized.find(s => s.effectType === StatusEffectType.BURN);
      expect(slowEntry).toBeDefined();
      expect(burnEntry).toBeDefined();
      expect(slowEntry!.enemyId).toBe('e1');
      expect(burnEntry!.enemyId).toBe('e1');
      expect(slowEntry!.expiresAt).toBe(STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].duration);
      expect(burnEntry!.expiresAt).toBe(STATUS_EFFECT_CONFIGS[StatusEffectType.BURN].duration);
    });

    it('serializeEffects() captures originalSpeed for SLOW', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);

      const serialized = service.serializeEffects();
      const slowEntry = serialized.find(s => s.effectType === StatusEffectType.SLOW);

      expect(slowEntry).toBeDefined();
      expect(slowEntry!.originalSpeed).toBe(4);
    });

    it('serializeEffects() returns empty array when no effects', () => {
      const serialized = service.serializeEffects();
      expect(serialized).toEqual([]);
    });

    it('restoreEffects() rebuilds nested Map', () => {
      const effects: SerializableStatusEffect[] = [
        {
          enemyId: 'e1',
          effectType: StatusEffectType.BURN,
          expiresAt: 5,
          lastTickTime: 1,
        },
        {
          enemyId: 'e1',
          effectType: StatusEffectType.POISON,
          expiresAt: 6,
          lastTickTime: 1,
        },
      ];

      service.restoreEffects(effects);

      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(true);
      expect(service.hasEffect('e1', StatusEffectType.POISON)).toBe(true);
      const activeTypes = service.getEffects('e1');
      expect(activeTypes).toContain(StatusEffectType.BURN);
      expect(activeTypes).toContain(StatusEffectType.POISON);
    });

    it('serialize → restore roundtrip', () => {
      const e1 = createEnemy('e1', 100, 4);
      const e2 = createEnemy('e2', 100, 6);
      enemyMap.set('e1', e1);
      enemyMap.set('e2', e2);

      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e1', StatusEffectType.BURN, 0);
      service.apply('e2', StatusEffectType.POISON, 0);

      const serialized = service.serializeEffects();

      // Clear effects
      service.removeAllEffects('e1');
      service.removeAllEffects('e2');
      expect(service.serializeEffects()).toEqual([]);

      // Restore
      service.restoreEffects(serialized);

      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(true);
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(true);
      expect(service.hasEffect('e2', StatusEffectType.POISON)).toBe(true);

      const restoredAll = service.getAllActiveEffects();
      expect(restoredAll.size).toBe(2);
    });
  });

  // --- Constants validation ---

  describe('constants validation', () => {
    it('all configs should have positive duration', () => {
      for (const type of Object.values(StatusEffectType)) {
        expect(STATUS_EFFECT_CONFIGS[type].duration).toBeGreaterThan(0);
      }
    });
  });

  // --- Slow application counter ---

  describe('getSlowApplicationCount', () => {
    it('starts at 0', () => {
      expect(service.getSlowApplicationCount()).toBe(0);
    });

    it('increments each time a new SLOW is applied to a different enemy', () => {
      enemyMap.set('e1', createEnemy('e1', 100, 2));
      enemyMap.set('e2', createEnemy('e2', 100, 2));

      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e2', StatusEffectType.SLOW, 0);

      expect(service.getSlowApplicationCount()).toBe(2);
    });

    it('does not increment when refreshing an existing SLOW (no stack)', () => {
      enemyMap.set('e1', createEnemy('e1', 100, 2));

      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e1', StatusEffectType.SLOW, 0); // refresh

      expect(service.getSlowApplicationCount()).toBe(1);
    });

    it('does not increment for BURN or POISON applications', () => {
      enemyMap.set('e1', createEnemy('e1', 100, 2));

      service.apply('e1', StatusEffectType.BURN, 0);
      service.apply('e1', StatusEffectType.POISON, 0);

      expect(service.getSlowApplicationCount()).toBe(0);
    });

    it('is not incremented when flying enemy is immune to SLOW', () => {
      enemyMap.set('fly1', createEnemy('fly1', 100, 2, true));

      service.apply('fly1', StatusEffectType.SLOW, 0);

      expect(service.getSlowApplicationCount()).toBe(0);
    });

    it('resets to 0 after cleanup()', () => {
      enemyMap.set('e1', createEnemy('e1', 100, 2));
      service.apply('e1', StatusEffectType.SLOW, 0);
      expect(service.getSlowApplicationCount()).toBe(1);

      service.cleanup();

      expect(service.getSlowApplicationCount()).toBe(0);
    });
  });

  // --- FROST_NOVA relic: +1 turn to SLOW duration ---

  describe('FROST_NOVA relic (getSlowDurationBonus)', () => {
    const slowBaseDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].duration; // 2

    it('SLOW without FROST_NOVA uses baseline duration', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);
      relicServiceSpy.getSlowDurationBonus.and.returnValue(0);

      service.apply('e1', StatusEffectType.SLOW, 0);

      // Effect should expire at turnNumber = slowBaseDuration (expiresAt = 0 + 2 = 2)
      const effects = (service as unknown as TestableStatusEffectService).effects;
      const slowEffect = effects.get('e1')?.get(StatusEffectType.SLOW);
      expect(slowEffect?.expiresAt).toBe(slowBaseDuration);
    });

    it('SLOW with FROST_NOVA extends duration by +1 turn', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);
      relicServiceSpy.getSlowDurationBonus.and.returnValue(1);

      service.apply('e1', StatusEffectType.SLOW, 0);

      const effects = (service as unknown as TestableStatusEffectService).effects;
      const slowEffect = effects.get('e1')?.get(StatusEffectType.SLOW);
      expect(slowEffect?.expiresAt).toBe(slowBaseDuration + 1);
    });

    it('BURN duration is NOT affected by FROST_NOVA', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);
      relicServiceSpy.getSlowDurationBonus.and.returnValue(1);

      const burnBaseDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN].duration; // 3
      service.apply('e1', StatusEffectType.BURN, 0);

      const effects = (service as unknown as TestableStatusEffectService).effects;
      const burnEffect = effects.get('e1')?.get(StatusEffectType.BURN);
      expect(burnEffect?.expiresAt).toBe(burnBaseDuration); // no bonus
    });

    it('POISON duration is NOT affected by FROST_NOVA', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);
      relicServiceSpy.getSlowDurationBonus.and.returnValue(1);

      const poisonBaseDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.POISON].duration; // 4
      service.apply('e1', StatusEffectType.POISON, 0);

      const effects = (service as unknown as TestableStatusEffectService).effects;
      const poisonEffect = effects.get('e1')?.get(StatusEffectType.POISON);
      expect(poisonEffect?.expiresAt).toBe(poisonBaseDuration); // no bonus
    });

    it('SLOW refresh with FROST_NOVA also applies the bonus', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);
      relicServiceSpy.getSlowDurationBonus.and.returnValue(1);

      // Apply at turn 0
      service.apply('e1', StatusEffectType.SLOW, 0);
      // Refresh at turn 2
      service.apply('e1', StatusEffectType.SLOW, 2);

      const effects = (service as unknown as TestableStatusEffectService).effects;
      const slowEffect = effects.get('e1')?.get(StatusEffectType.SLOW);
      // expiresAt = 2 + slowBaseDuration + 1 bonus
      expect(slowEffect?.expiresAt).toBe(2 + slowBaseDuration + 1);
    });
  });
});
