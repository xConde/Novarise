import { TestBed } from '@angular/core/testing';
import { StatusEffectService } from './status-effect.service';
import { EnemyService, DamageResult } from './enemy.service';
import { StatusEffectType, STATUS_EFFECT_CONFIGS } from '../constants/status-effect.constants';
import { Enemy, EnemyType } from '../models/enemy.model';

describe('StatusEffectService', () => {
  let service: StatusEffectService;
  let enemyServiceSpy: jasmine.SpyObj<EnemyService>;
  let enemyMap: Map<string, Enemy>;

  function createEnemy(id: string, health = 100, speed = 2, isFlying = false): Enemy {
    const enemy: Enemy = {
      id,
      type: isFlying ? EnemyType.FLYING : EnemyType.BASIC,
      position: { x: 0, y: 0.3, z: 0 },
      gridPosition: { row: 0, col: 0 },
      health,
      maxHealth: health,
      speed,
      value: 10,
      leakDamage: 1,
      path: [],
      pathIndex: 0,
      distanceTraveled: 0,
    };
    if (isFlying) {
      enemy.isFlying = true;
    }
    return enemy;
  }

  beforeEach(() => {
    enemyMap = new Map();

    enemyServiceSpy = jasmine.createSpyObj('EnemyService', ['getEnemies', 'damageEnemy']);
    enemyServiceSpy.getEnemies.and.returnValue(enemyMap);
    enemyServiceSpy.damageEnemy.and.callFake((id: string, damage: number): DamageResult => {
      const noOp: DamageResult = { killed: false, spawnedEnemies: [] };
      const enemy = enemyMap.get(id);
      if (!enemy || enemy.health <= 0) return noOp;
      enemy.health -= damage;
      return { killed: enemy.health <= 0, spawnedEnemies: [] };
    });

    TestBed.configureTestingModule({
      providers: [
        StatusEffectService,
        { provide: EnemyService, useValue: enemyServiceSpy },
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

  // --- update() SLOW expiry ---

  describe('update() SLOW expiry', () => {
    it('should expire SLOW and restore original speed', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);
      const slowDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].duration;

      // Advance past duration
      service.update(slowDuration);

      expect(enemy.speed).toBe(4); // restored
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(false);
    });

    it('should not expire SLOW before duration elapses', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);
      const slowDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].duration;
      const expectedSpeed = 4 * STATUS_EFFECT_CONFIGS[StatusEffectType.SLOW].speedMultiplier!;

      // Update just before expiry
      service.update(slowDuration - 0.1);

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
  });

  // --- update() BURN ticking ---

  describe('update() BURN ticking', () => {
    it('should tick BURN damage at correct interval', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);
      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];

      // Advance exactly one tick interval
      service.update(burnCfg.tickInterval!);

      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith('e1', burnCfg.damagePerTick!);
    });

    it('should not tick BURN before interval elapses', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);
      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];

      // Advance less than one tick interval
      service.update(burnCfg.tickInterval! - 0.01);

      expect(enemyServiceSpy.damageEnemy).not.toHaveBeenCalled();
    });

    it('should kill enemy when health reaches 0 from DoT', () => {
      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];
      // Enemy with exactly enough health to die on first tick
      const enemy = createEnemy('e1', burnCfg.damagePerTick!, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);

      const kills = service.update(burnCfg.tickInterval!);

      expect(kills.length).toBe(1);
      expect(kills[0].id).toBe('e1');
      expect(kills[0].damage).toBe(burnCfg.damagePerTick!);
    });

    it('should return KillInfo for DoT kills', () => {
      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];
      const enemy = createEnemy('e1', 1, 4); // very low health
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);
      const kills = service.update(burnCfg.tickInterval!);

      expect(kills.length).toBe(1);
      expect(kills[0]).toEqual({ id: 'e1', damage: burnCfg.damagePerTick! });
    });
  });

  // --- POISON independent ticking ---

  describe('POISON ticking', () => {
    it('should tick at its own interval, independent of BURN', () => {
      const enemy = createEnemy('e1', 200, 4);
      enemyMap.set('e1', enemy);

      const burnCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN];
      const poisonCfg = STATUS_EFFECT_CONFIGS[StatusEffectType.POISON];

      // Apply both at time 0
      service.apply('e1', StatusEffectType.BURN, 0);
      service.apply('e1', StatusEffectType.POISON, 0);

      // BURN tickInterval=0.5, POISON tickInterval=1.0
      // At time 0.5: only BURN should tick
      service.update(burnCfg.tickInterval!);
      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledTimes(1);
      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledWith('e1', burnCfg.damagePerTick!);

      enemyServiceSpy.damageEnemy.calls.reset();

      // At time 1.0: both should tick
      service.update(poisonCfg.tickInterval!);
      expect(enemyServiceSpy.damageEnemy).toHaveBeenCalledTimes(2);
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

    it('should eagerly clear effects without waiting for next update() cycle', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);
      service.apply('e1', StatusEffectType.BURN, 0);

      // Explicit cleanup — simulates what game-board.component does before removeEnemy()
      service.removeAllEffects('e1');

      // Remove enemy from map (simulates EnemyService.removeEnemy)
      enemyMap.delete('e1');

      // Effects should already be gone — no stale entry waiting for update() to detect
      expect(service.hasEffect('e1', StatusEffectType.SLOW)).toBe(false);
      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
      expect(service.getEffects('e1')).toEqual([]);
      expect(service.getAllActiveEffects().size).toBe(0);
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
    it('should auto-clean effects for dead enemies on next update', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.BURN, 0);

      // Kill the enemy externally
      enemy.health = 0;

      service.update(1);

      expect(service.hasEffect('e1', StatusEffectType.BURN)).toBe(false);
      expect(service.getEffects('e1')).toEqual([]);
    });

    it('should auto-clean effects when enemy is removed from map', () => {
      const enemy = createEnemy('e1', 100, 4);
      enemyMap.set('e1', enemy);

      service.apply('e1', StatusEffectType.SLOW, 0);

      // Remove enemy from map entirely
      enemyMap.delete('e1');

      service.update(1);

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

      service.apply('e1', StatusEffectType.BURN, 0);

      const burnDuration = STATUS_EFFECT_CONFIGS[StatusEffectType.BURN].duration;
      // Advance past expiry
      service.update(burnDuration);

      const result = service.getAllActiveEffects();

      expect(result.size).toBe(0);
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
});
