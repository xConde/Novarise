import { EnemyType, ENEMY_STATS, Enemy, GridNode } from './enemy.model';

describe('Enemy Model', () => {
  describe('EnemyType Enum', () => {
    it('should have all 5 enemy types defined', () => {
      expect(EnemyType.BASIC).toBe('BASIC');
      expect(EnemyType.FAST).toBe('FAST');
      expect(EnemyType.HEAVY).toBe('HEAVY');
      expect(EnemyType.FLYING).toBe('FLYING');
      expect(EnemyType.BOSS).toBe('BOSS');
    });
  });

  describe('ENEMY_STATS', () => {
    it('should have stats for all enemy types', () => {
      expect(ENEMY_STATS[EnemyType.BASIC]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.FAST]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.HEAVY]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.FLYING]).toBeDefined();
      expect(ENEMY_STATS[EnemyType.BOSS]).toBeDefined();
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

    describe('BASIC enemy stats', () => {
      it('should have balanced stats', () => {
        const basic = ENEMY_STATS[EnemyType.BASIC];
        expect(basic.health).toBe(100);
        expect(basic.speed).toBe(2.0);
        expect(basic.value).toBe(10);
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
        expect(fast.value).toBe(15);
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
        expect(heavy.value).toBe(30);
        expect(heavy.color).toBe(0x0000ff); // Blue
        expect(heavy.size).toBe(0.4); // Larger
      });
    });

    describe('FLYING enemy stats', () => {
      it('should be fast with moderate health', () => {
        const flying = ENEMY_STATS[EnemyType.FLYING];
        const basic = ENEMY_STATS[EnemyType.BASIC];

        expect(flying.speed).toBeGreaterThan(basic.speed);
        expect(flying.health).toBeLessThan(basic.health);
      });

      it('should have correct stats', () => {
        const flying = ENEMY_STATS[EnemyType.FLYING];
        expect(flying.health).toBe(80);
        expect(flying.speed).toBe(3.0);
        expect(flying.value).toBe(20);
        expect(flying.color).toBe(0x00ffff); // Cyan
      });
    });

    describe('BOSS enemy stats', () => {
      it('should have highest health and lowest speed', () => {
        const boss = ENEMY_STATS[EnemyType.BOSS];

        Object.entries(ENEMY_STATS).forEach(([type, stats]) => {
          if (type !== EnemyType.BOSS) {
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
        expect(boss.value).toBe(100);
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

      // All 5 enemy types should have unique colors
      expect(colors.size).toBe(5);
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
});
