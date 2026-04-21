import { EnemyType, ENEMY_STATS, Enemy, GridNode, MINI_SWARM_STATS } from './enemy.model';

describe('Enemy Model', () => {
  describe('EnemyType Enum', () => {
    it('should have all 9 enemy types defined', () => {
      expect(EnemyType.BASIC).toBe('BASIC');
      expect(EnemyType.FAST).toBe('FAST');
      expect(EnemyType.HEAVY).toBe('HEAVY');
      expect(EnemyType.SWIFT).toBe('SWIFT');
      expect(EnemyType.BOSS).toBe('BOSS');
      expect(EnemyType.SHIELDED).toBe('SHIELDED');
      expect(EnemyType.SWARM).toBe('SWARM');
      expect(EnemyType.FLYING).toBe('FLYING');
      expect(EnemyType.MINER).toBe('MINER');
    });
  });

  describe('ENEMY_STATS', () => {
    it('should have stats for all enemy types', () => {
      expect(ENEMY_STATS[EnemyType.BASIC]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.FAST]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.HEAVY]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.SWIFT]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.BOSS]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.SHIELDED]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.SWARM]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.FLYING]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.MINER]).toBeDefined();
    });

    it('should have valid health values', () => {
      Object.values(ENEMY_STATS).forEach(stats => {
        expect(stats.health).toBeGreaterThan(0);
        expect(typeof stats.health).toBe('number');
      });
    });

    it('should have valid speed values', () => {
      Object.values(ENEMY_STATS).forEach(stats => {
        expect(stats.speed).toBeGreaterThan(0);
        expect(typeof stats.speed).toBe('number');
      });
    });

    it('should have valid value (currency) amounts', () => {
      Object.values(ENEMY_STATS).forEach(stats => {
        expect(stats.value).toBeGreaterThan(0);
        expect(typeof stats.value).toBe('number');
      });
    });

    it('should have valid color hex codes', () => {
      Object.values(ENEMY_STATS).forEach(stats => {
        expect(stats.color).toBeGreaterThanOrEqual(0x000000);
        expect(stats.color).toBeLessThanOrEqual(0xffffff);
        expect(typeof stats.color).toBe('number');
      });
    });

    it('should have valid size values', () => {
      Object.values(ENEMY_STATS).forEach(stats => {
        expect(stats.size).toBeGreaterThan(0);
        expect(typeof stats.size).toBe('number');
      });
    });

    it('should have valid leakDamage values (> 0) for all enemy types', () => {
      Object.values(ENEMY_STATS).forEach(stats => {
        expect(stats.leakDamage).toBeGreaterThan(0);
        expect(typeof stats.leakDamage).toBe('number');
      });
    });

    it('should have leakDamage=3 for BOSS (highest threat)', () => {
      expect(ENEMY_STATS[EnemyType.BOSS].leakDamage).toBe(3);
    });

    it('should have leakDamage=2 for HEAVY and SHIELDED (tank types)', () => {
      expect(ENEMY_STATS[EnemyType.HEAVY].leakDamage).toBe(2);
      expect(ENEMY_STATS[EnemyType.SHIELDED].leakDamage).toBe(2);
    });

    it('should have leakDamage=1 for standard enemies', () => {
      expect(ENEMY_STATS[EnemyType.BASIC].leakDamage).toBe(1);
      expect(ENEMY_STATS[EnemyType.FAST].leakDamage).toBe(1);
      expect(ENEMY_STATS[EnemyType.SWIFT].leakDamage).toBe(1);
      expect(ENEMY_STATS[EnemyType.SWARM].leakDamage).toBe(1);
      expect(ENEMY_STATS[EnemyType.FLYING].leakDamage).toBe(1);
      expect(ENEMY_STATS[EnemyType.MINER].leakDamage).toBe(1);
    });

    describe('BASIC enemy stats', () => {
      it('should have balanced stats', () => {
        const basic = ENEMY_STATS[EnemyType.BASIC];
        expect(basic.health).toBe(100);
        expect(basic.speed).toBe(2.0);
        expect(basic.value).toBe(5);
        expect(basic.color).toBe(0xff0000); // Red
        expect(basic.size).toBe(0.3);
      });
    });

    describe('FAST enemy stats', () => {
      it('should be faster and weaker than BASIC', () => {
        const fast = ENEMY_STATS[EnemyType.FAST];
        const basic = ENEMY_STATS[EnemyType.BASIC];

        expect(fast.speed).toBeGreaterThan(basic.speed);
        expect(fast.health).toBeLessThan(basic.health);
        expect(fast.value).toBeGreaterThan(basic.value); // Higher reward
      });

      it('should have correct stats', () => {
        const fast = ENEMY_STATS[EnemyType.FAST];
        expect(fast.health).toBe(50);
        expect(fast.speed).toBe(4.0);
        expect(fast.value).toBe(8);
        expect(fast.color).toBe(0xffff00); // Yellow
      });
    });

    describe('HEAVY enemy stats', () => {
      it('should be slower and tankier than BASIC', () => {
        const heavy = ENEMY_STATS[EnemyType.HEAVY];
        const basic = ENEMY_STATS[EnemyType.BASIC];

        expect(heavy.speed).toBeLessThan(basic.speed);
        expect(heavy.health).toBeGreaterThan(basic.health);
        expect(heavy.value).toBeGreaterThan(basic.value); // Higher reward
      });

      it('should have correct stats', () => {
        const heavy = ENEMY_STATS[EnemyType.HEAVY];
        expect(heavy.health).toBe(300);
        expect(heavy.speed).toBe(1.0);
        expect(heavy.value).toBe(15);
        expect(heavy.color).toBe(0x0000ff); // Blue
        expect(heavy.size).toBe(0.4); // Larger
      });
    });

    describe('SWIFT enemy stats', () => {
      it('should be fast with moderate health', () => {
        const swift = ENEMY_STATS[EnemyType.SWIFT];
        const basic = ENEMY_STATS[EnemyType.BASIC];

        expect(swift.speed).toBeGreaterThan(basic.speed);
        expect(swift.health).toBeLessThan(basic.health);
      });

      it('should have correct stats', () => {
        const swift = ENEMY_STATS[EnemyType.SWIFT];
        expect(swift.health).toBe(80);
        expect(swift.speed).toBe(3.0);
        expect(swift.value).toBe(10);
        expect(swift.color).toBe(0x00ffff); // Cyan
      });
    });

    describe('BOSS enemy stats', () => {
      it('should have highest health and lowest speed among non-elite types', () => {
        const boss = ENEMY_STATS[EnemyType.BOSS];
        // Boss-tier variants (VEINSEEKER, UNSHAKEABLE, WYRM_ASCENDANT) are excluded: they
        // are co-equal boss-tier units, not subordinate enemy types.
        // VEINSEEKER (sprint 23) shares BOSS health (1000) and exceeds BOSS value (100 vs 50).
        // WYRM_ASCENDANT (sprint 39): 1400 HP > BOSS 1000 HP by design — apex boss counter.
        const BOSS_TIER_VARIANTS: string[] = [EnemyType.VEINSEEKER, EnemyType.UNSHAKEABLE, EnemyType.WYRM_ASCENDANT];

        Object.entries(ENEMY_STATS).forEach(([type, stats]) => {
          if (type !== EnemyType.BOSS && !BOSS_TIER_VARIANTS.includes(type)) {
            expect(boss.health).toBeGreaterThanOrEqual(stats.health);
            expect(boss.speed).toBeLessThanOrEqual(stats.speed);
            expect(boss.value).toBeGreaterThanOrEqual(stats.value);
          }
        });
      });

      it('should have correct stats', () => {
        const boss = ENEMY_STATS[EnemyType.BOSS];
        expect(boss.health).toBe(1000);
        expect(boss.speed).toBe(0.5);
        expect(boss.value).toBe(50);
        expect(boss.color).toBe(0xff00ff); // Magenta
        expect(boss.size).toBe(0.6); // Largest
      });
    });
  });

  describe('Enemy Interface', () => {
    it('should define a valid enemy structure', () => {
      const testEnemy: Enemy = {
        id: 'test-enemy-1',
        type: EnemyType.BASIC,
        position: { x: 0, y: 0, z: 0 },
        gridPosition: { row: 0, col: 0 },
        health: 100,
        maxHealth: 100,
        speed: 2.0,
        value: 10,
        leakDamage: 1,
        path: [],
        pathIndex: 0,
        distanceTraveled: 0
      };

      expect(testEnemy).toBeDefined();
      expect(testEnemy.id).toBe('test-enemy-1');
      expect(testEnemy.type).toBe(EnemyType.BASIC);
    });
  });

  describe('GridNode Interface', () => {
    it('should define a valid grid node structure', () => {
      const testNode: GridNode = {
        x: 5,
        y: 10,
        f: 20,
        g: 10,
        h: 10
      };

      expect(testNode).toBeDefined();
      expect(testNode.x).toBe(5);
      expect(testNode.y).toBe(10);
    });

    it('should support optional parent reference', () => {
      const parentNode: GridNode = {
        x: 4,
        y: 10,
        f: 19,
        g: 9,
        h: 10
      };

      const childNode: GridNode = {
        x: 5,
        y: 10,
        f: 20,
        g: 10,
        h: 10,
        parent: parentNode
      };

      expect(childNode.parent).toBe(parentNode);
    });
  });

  describe('Stat Balance', () => {
    it('should have speed inversely related to health (generally)', () => {
      const basic = ENEMY_STATS[EnemyType.BASIC];
      const fast = ENEMY_STATS[EnemyType.FAST];
      const heavy = ENEMY_STATS[EnemyType.HEAVY];

      // Fast has less health but more speed
      expect(fast.health < basic.health).toBe(true);
      expect(fast.speed > basic.speed).toBe(true);

      // Heavy has more health but less speed
      expect(heavy.health > basic.health).toBe(true);
      expect(heavy.speed < basic.speed).toBe(true);
    });

    it('should reward value proportional to difficulty', () => {
      const basic = ENEMY_STATS[EnemyType.BASIC];
      const fast = ENEMY_STATS[EnemyType.FAST];
      const heavy = ENEMY_STATS[EnemyType.HEAVY];
      const boss = ENEMY_STATS[EnemyType.BOSS];

      // Higher difficulty enemies should give more value
      expect(fast.value).toBeGreaterThan(basic.value); // Fast is harder to hit
      expect(heavy.value).toBeGreaterThan(basic.value); // Heavy takes more damage
      expect(boss.value).toBeGreaterThan(heavy.value); // Boss is toughest
    });

    it('should have distinct colors for each type', () => {
      const colors = new Set<number>();

      Object.values(ENEMY_STATS).forEach(stats => {
        colors.add(stats.color);
      });

      // All enemy types should have unique colors
      expect(colors.size).toBe(Object.values(ENEMY_STATS).length);
    });

    it('should have distinct sizes for visibility', () => {
      const basic = ENEMY_STATS[EnemyType.BASIC];
      const heavy = ENEMY_STATS[EnemyType.HEAVY];
      const boss = ENEMY_STATS[EnemyType.BOSS];

      // Tankier enemies should be visually larger
      expect(heavy.size).toBeGreaterThan(basic.size);
      expect(boss.size).toBeGreaterThan(heavy.size);
    });
  });

  describe('SHIELDED enemy stats', () => {
    it('should have correct base stats', () => {
      const shielded = ENEMY_STATS[EnemyType.SHIELDED];
      expect(shielded.health).toBe(120);
      expect(shielded.speed).toBe(1.2);
      expect(shielded.value).toBe(13);
      expect(shielded.color).toBe(0x4444ff);
      expect(shielded.size).toBe(0.35);
    });

    it('should have a maxShield value', () => {
      const shielded = ENEMY_STATS[EnemyType.SHIELDED];
      expect(shielded.maxShield).toBeDefined();
      expect(shielded.maxShield!).toBe(60);
      expect(shielded.maxShield!).toBeGreaterThan(0);
    });

    it('should not have spawnOnDeath', () => {
      expect(ENEMY_STATS[EnemyType.SHIELDED].spawnOnDeath).toBeUndefined();
    });

    it('should have higher value than BASIC due to shield mechanic', () => {
      expect(ENEMY_STATS[EnemyType.SHIELDED].value).toBeGreaterThan(ENEMY_STATS[EnemyType.BASIC].value);
    });

    it('should have a distinct color from HEAVY (both blue-ish)', () => {
      expect(ENEMY_STATS[EnemyType.SHIELDED].color).not.toBe(ENEMY_STATS[EnemyType.HEAVY].color);
    });
  });

  describe('SWARM enemy stats', () => {
    it('should have correct base stats', () => {
      const swarm = ENEMY_STATS[EnemyType.SWARM];
      expect(swarm.health).toBe(40);
      expect(swarm.speed).toBe(2.5);
      expect(swarm.value).toBe(4);
      expect(swarm.color).toBe(0xaaaa00);
      expect(swarm.size).toBe(0.25);
    });

    it('should have a spawnOnDeath value', () => {
      const swarm = ENEMY_STATS[EnemyType.SWARM];
      expect(swarm.spawnOnDeath).toBeDefined();
      expect(swarm.spawnOnDeath!).toBe(3);
      expect(swarm.spawnOnDeath!).toBeGreaterThan(0);
    });

    it('should not have maxShield', () => {
      expect(ENEMY_STATS[EnemyType.SWARM].maxShield).toBeUndefined();
    });

    it('should be faster than BASIC', () => {
      expect(ENEMY_STATS[EnemyType.SWARM].speed).toBeGreaterThan(ENEMY_STATS[EnemyType.BASIC].speed);
    });

    it('should have lower health than BASIC', () => {
      expect(ENEMY_STATS[EnemyType.SWARM].health).toBeLessThan(ENEMY_STATS[EnemyType.BASIC].health);
    });
  });

  describe('MINI_SWARM_STATS', () => {
    it('should have all required fields', () => {
      expect(MINI_SWARM_STATS.health).toBeDefined();
      expect(MINI_SWARM_STATS.speed).toBeDefined();
      expect(MINI_SWARM_STATS.value).toBeDefined();
      expect(MINI_SWARM_STATS.color).toBeDefined();
      expect(MINI_SWARM_STATS.size).toBeDefined();
    });

    it('should have lower health than SWARM parent', () => {
      expect(MINI_SWARM_STATS.health).toBeLessThan(ENEMY_STATS[EnemyType.SWARM].health);
    });

    it('should be faster than the SWARM parent', () => {
      expect(MINI_SWARM_STATS.speed).toBeGreaterThan(ENEMY_STATS[EnemyType.SWARM].speed);
    });

    it('should be smaller than the SWARM parent', () => {
      expect(MINI_SWARM_STATS.size).toBeLessThan(ENEMY_STATS[EnemyType.SWARM].size);
    });

    it('should have a low reward value', () => {
      expect(MINI_SWARM_STATS.value).toBeGreaterThan(0);
      expect(MINI_SWARM_STATS.value).toBeLessThan(ENEMY_STATS[EnemyType.SWARM].value);
    });

    it('should use the same color as the SWARM parent', () => {
      expect(MINI_SWARM_STATS.color as number).toBe(ENEMY_STATS[EnemyType.SWARM].color);
    });

    it('should have leakDamage of 1', () => {
      expect(MINI_SWARM_STATS.leakDamage).toBe(1);
    });
  });

  describe('Wave Definitions include new enemy types', () => {
    it('WAVE_DEFINITIONS should be importable', () => {
      // Import check: if wave.model compiles, all used EnemyTypes must exist
      // Wave 7+ use SHIELDED and SWARM — this test verifies the enum values exist
      expect(EnemyType.SHIELDED).toBeDefined();
      expect(EnemyType.SWARM).toBeDefined();
    });
  });

  describe('FLYING enemy stats', () => {
    it('should have correct base stats', () => {
      const flying = ENEMY_STATS[EnemyType.FLYING];
      expect(flying.health).toBe(60);
      expect(flying.speed).toBe(2.5);
      expect(flying.value).toBe(10);
      expect(flying.color).toBe(0x88ccff); // Light blue
      expect(flying.size).toBe(0.3);
    });

    it('should not have maxShield', () => {
      expect(ENEMY_STATS[EnemyType.FLYING].maxShield).toBeUndefined();
    });

    it('should not have spawnOnDeath', () => {
      expect(ENEMY_STATS[EnemyType.FLYING].spawnOnDeath).toBeUndefined();
    });

    it('should have higher value than BASIC (unique threat via terrain bypass)', () => {
      expect(ENEMY_STATS[EnemyType.FLYING].value).toBeGreaterThan(ENEMY_STATS[EnemyType.BASIC].value);
    });

    it('should have a distinct color from all other enemy types', () => {
      const otherColors = Object.entries(ENEMY_STATS)
        .filter(([type]) => type !== EnemyType.FLYING)
        .map(([, stats]) => stats.color);
      expect(otherColors).not.toContain(ENEMY_STATS[EnemyType.FLYING].color);
    });
  });

  describe('Wave Definitions include FLYING enemy type', () => {
    it('FLYING enum value should exist', () => {
      expect(EnemyType.FLYING).toBeDefined();
      expect(EnemyType.FLYING).toBe('FLYING');
    });
  });

  // ── Sprint 37 — GLIDER enemy stats ──────────────────────────────────────
  describe('GLIDER enemy stats (sprint 37)', () => {
    it('should have a defined GLIDER entry in ENEMY_STATS', () => {
      expect(ENEMY_STATS[EnemyType.GLIDER]).toBeDefined();
    });

    it('ignoresElevation flag is true', () => {
      expect(ENEMY_STATS[EnemyType.GLIDER].ignoresElevation).toBeTrue();
    });

    it('halvesElevationDamageBonuses flag is absent (falsy)', () => {
      expect(ENEMY_STATS[EnemyType.GLIDER].halvesElevationDamageBonuses).toBeFalsy();
    });

    it('has tilesPerTurn = 2 (fast mover)', () => {
      expect(ENEMY_STATS[EnemyType.GLIDER].tilesPerTurn).toBe(2);
    });

    it('has lower health than BASIC (fragile, fast)', () => {
      expect(ENEMY_STATS[EnemyType.GLIDER].health).toBeLessThan(ENEMY_STATS[EnemyType.BASIC].health);
    });

    it('has leakDamage of 1', () => {
      expect(ENEMY_STATS[EnemyType.GLIDER].leakDamage).toBe(1);
    });

    it('does not have maxShield or spawnOnDeath', () => {
      expect(ENEMY_STATS[EnemyType.GLIDER].maxShield).toBeUndefined();
      expect(ENEMY_STATS[EnemyType.GLIDER].spawnOnDeath).toBeUndefined();
    });
  });

  // ── Sprint 38 — TITAN enemy stats ────────────────────────────────────────
  describe('TITAN enemy stats (sprint 38)', () => {
    it('should have a defined TITAN entry in ENEMY_STATS', () => {
      expect(ENEMY_STATS[EnemyType.TITAN]).toBeDefined();
    });

    it('halvesElevationDamageBonuses flag is true', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].halvesElevationDamageBonuses).toBeTrue();
    });

    it('ignoresElevation flag is absent (falsy)', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].ignoresElevation).toBeFalsy();
    });

    it('has high health (elite bulk — at least 3× BASIC)', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].health).toBeGreaterThanOrEqual(ENEMY_STATS[EnemyType.BASIC].health * 3);
    });

    it('has tilesPerTurn = 1 (slow elite)', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].tilesPerTurn).toBe(1);
    });

    it('has leakDamage of 3 (elite threat)', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].leakDamage).toBe(3);
    });

    it('has higher value than BASIC (elite reward)', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].value).toBeGreaterThan(ENEMY_STATS[EnemyType.BASIC].value);
    });

    it('does not have maxShield or spawnOnDeath', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].maxShield).toBeUndefined();
      expect(ENEMY_STATS[EnemyType.TITAN].spawnOnDeath).toBeUndefined();
    });
  });

  // ── Sprint 37/38 — EnemyStats optional fields default correctly ──────────
  describe('optional EnemyStats flags default behaviour', () => {
    it('BASIC has ignoresElevation = undefined (not true)', () => {
      expect(ENEMY_STATS[EnemyType.BASIC].ignoresElevation).toBeFalsy();
    });

    it('BASIC has halvesElevationDamageBonuses = undefined (not true)', () => {
      expect(ENEMY_STATS[EnemyType.BASIC].halvesElevationDamageBonuses).toBeFalsy();
    });

    it('BASIC has immuneToElevationDamageBonuses = undefined (not true)', () => {
      expect(ENEMY_STATS[EnemyType.BASIC].immuneToElevationDamageBonuses).toBeFalsy();
    });

    it('TITAN ignoresElevation is undefined (only halves bonuses, does not ignore)', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].ignoresElevation).toBeFalsy();
    });

    it('TITAN immuneToElevationDamageBonuses is undefined (only halves, does not strip)', () => {
      expect(ENEMY_STATS[EnemyType.TITAN].immuneToElevationDamageBonuses).toBeFalsy();
    });

    it('GLIDER halvesElevationDamageBonuses is undefined (immunity, does not halve)', () => {
      expect(ENEMY_STATS[EnemyType.GLIDER].halvesElevationDamageBonuses).toBeFalsy();
    });

    it('WYRM_ASCENDANT halvesElevationDamageBonuses is undefined (immune, does not halve)', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].halvesElevationDamageBonuses).toBeFalsy();
    });
  });

  // ── Sprint 39 — WYRM_ASCENDANT enemy stats ──────────────────────────────
  describe('WYRM_ASCENDANT enemy stats (sprint 39)', () => {
    it('should have a defined WYRM_ASCENDANT entry in ENEMY_STATS', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT]).toBeDefined();
    });

    it('immuneToElevationDamageBonuses flag is true', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].immuneToElevationDamageBonuses).toBeTrue();
    });

    it('ignoresElevation flag is absent (falsy) — WYRM does not ignore elevation penalties', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].ignoresElevation).toBeFalsy();
    });

    it('halvesElevationDamageBonuses flag is absent (falsy) — WYRM uses immune path, not halve path', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].halvesElevationDamageBonuses).toBeFalsy();
    });

    it('has very high health (boss-tier — must exceed BOSS baseline)', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].health)
        .toBeGreaterThan(ENEMY_STATS[EnemyType.BOSS].health);
    });

    it('has tilesPerTurn = 1 (slow boss)', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].tilesPerTurn).toBe(1);
    });

    it('has leakDamage > BOSS leakDamage (apex boss-counter threat)', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].leakDamage)
        .toBeGreaterThan(ENEMY_STATS[EnemyType.BOSS].leakDamage);
    });

    it('has size larger than BOSS (imposing visual)', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].size)
        .toBeGreaterThan(ENEMY_STATS[EnemyType.BOSS].size);
    });

    it('has higher value than BOSS (boss-counter reward)', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].value)
        .toBeGreaterThan(ENEMY_STATS[EnemyType.BOSS].value);
    });

    it('does not have maxShield or spawnOnDeath', () => {
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].maxShield).toBeUndefined();
      expect(ENEMY_STATS[EnemyType.WYRM_ASCENDANT].spawnOnDeath).toBeUndefined();
    });

    it('has a distinct color from BOSS, VEINSEEKER, TITAN, and UNSHAKEABLE', () => {
      const wyrmColor = ENEMY_STATS[EnemyType.WYRM_ASCENDANT].color;
      expect(wyrmColor).not.toBe(ENEMY_STATS[EnemyType.BOSS].color);
      expect(wyrmColor).not.toBe(ENEMY_STATS[EnemyType.VEINSEEKER].color);
      expect(wyrmColor).not.toBe(ENEMY_STATS[EnemyType.TITAN].color);
      expect(wyrmColor).not.toBe(ENEMY_STATS[EnemyType.UNSHAKEABLE].color);
    });
  });
});

