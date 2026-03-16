import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyService } from './enemy.service';
import { GameBoardService } from '../game-board.service';
import { EnemyType, ENEMY_STATS, MINI_SWARM_STATS } from '../models/enemy.model';
import { GameModifier, GAME_MODIFIER_CONFIGS, mergeModifierEffects } from '../models/game-modifier.model';
import { GameBoardTile } from '../models/game-board-tile';
import { StatusEffectType } from '../constants/status-effect.constants';
import { ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { createTestBoard, createGameBoardServiceSpy } from '../testing';

describe('EnemyService', () => {
  let service: EnemyService;
  let gameBoardService: jasmine.SpyObj<GameBoardService>;
  let mockScene: THREE.Scene;

  beforeEach(() => {
    const gameBoardServiceSpy = createGameBoardServiceSpy(10, 10, 1, () => createTestBoard());

    TestBed.configureTestingModule({
      providers: [
        EnemyService,
        { provide: GameBoardService, useValue: gameBoardServiceSpy }
      ]
    });

    service = TestBed.inject(EnemyService);
    gameBoardService = TestBed.inject(GameBoardService) as jasmine.SpyObj<GameBoardService>;
    mockScene = new THREE.Scene();
  });

  afterEach(() => {
    // Clean up all enemies
    service.getEnemies().forEach((enemy, id) => {
      service.removeEnemy(id, mockScene);
    });
  });

  describe('Enemy Spawning', () => {
    it('should create enemy service', () => {
      expect(service).toBeTruthy();
    });

    it('should spawn a basic enemy at spawner tile', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(enemy).toBeTruthy();
      expect(enemy?.type).toBe(EnemyType.BASIC);
      expect(enemy?.gridPosition).toEqual({ row: 0, col: 0 });
      expect(enemy?.health).toBeGreaterThan(0);
      expect(enemy?.mesh).toBeTruthy();
    });

    it('should initialise shield for SHIELDED enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;

      expect(enemy.shield).toBe(ENEMY_STATS[EnemyType.SHIELDED].maxShield);
      expect(enemy.maxShield).toBe(ENEMY_STATS[EnemyType.SHIELDED].maxShield);
    });

    it('should add a shield mesh child to SHIELDED enemy mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;

      expect(enemy.mesh!.userData['shieldMesh']).toBeTruthy();
    });

    it('should NOT initialise shield for non-shielded enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.shield).toBeUndefined();
      expect(enemy.maxShield).toBeUndefined();
    });

    it('should NOT set isMiniSwarm on normally spawned enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
      expect(enemy.isMiniSwarm).toBeUndefined();
    });

    it('should set leakDamage from ENEMY_STATS on spawned enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      expect(enemy.leakDamage).toBe(ENEMY_STATS[EnemyType.BOSS].leakDamage);
    });

    it('should set correct leakDamage for each enemy type', () => {
      const types: EnemyType[] = [
        EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY,
        EnemyType.SWIFT, EnemyType.BOSS, EnemyType.SHIELDED,
        EnemyType.SWARM, EnemyType.FLYING
      ];
      types.forEach(type => {
        const enemy = service.spawnEnemy(type, mockScene)!;
        expect(enemy.leakDamage).toBe(ENEMY_STATS[type].leakDamage);
      });
    });

    it('should spawn all enemy types with correct stats', () => {
      const types: EnemyType[] = [
        EnemyType.BASIC,
        EnemyType.FAST,
        EnemyType.HEAVY,
        EnemyType.SWIFT,
        EnemyType.BOSS,
        EnemyType.SHIELDED,
        EnemyType.SWARM,
        EnemyType.FLYING
      ];

      types.forEach(type => {
        const enemy = service.spawnEnemy(type, mockScene);
        expect(enemy).toBeTruthy();
        expect(enemy?.type).toBe(type);
      });
    });

    it('should add enemy mesh to scene', () => {
      const initialChildren = mockScene.children.length;
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(mockScene.children.length).toBe(initialChildren + 1);
    });

    it('should assign unique IDs to enemies', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(enemy1?.id).not.toBe(enemy2?.id);
    });

    it('should return null when no spawner tiles exist', () => {
      // Board with no spawner
      const boardNoSpawner: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        boardNoSpawner[row] = [];
        for (let col = 0; col < 10; col++) {
          boardNoSpawner[row][col] = GameBoardTile.createBase(row, col);
        }
      }
      gameBoardService.getGameBoard.and.returnValue(boardNoSpawner);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy).toBeNull();
    });

    it('should return null when no exit tiles exist', () => {
      // Board with spawner but no exit
      const boardNoExit: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        boardNoExit[row] = [];
        for (let col = 0; col < 10; col++) {
          if (row === 0 && col === 0) {
            boardNoExit[row][col] = GameBoardTile.createSpawner(row, col);
          } else {
            boardNoExit[row][col] = GameBoardTile.createBase(row, col);
          }
        }
      }
      gameBoardService.getGameBoard.and.returnValue(boardNoExit);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy).toBeNull();
    });

    it('should return null when path is completely blocked', () => {
      // Create a board with blocked path
      const blockedCells = [
        { row: 0, col: 1 },
        { row: 1, col: 0 }
      ];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy).toBeNull();
    });
  });

  describe('Pathfinding (A*)', () => {
    it('should find a valid path from spawner to exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(enemy).toBeTruthy();
      expect(enemy!.path.length).toBeGreaterThan(0);

      // First node should be start position
      expect(enemy!.path[0]).toEqual(jasmine.objectContaining({ x: 0, y: 0 }));

      // Last node should be end position
      const lastNode = enemy!.path[enemy!.path.length - 1];
      expect(lastNode).toEqual(jasmine.objectContaining({ x: 9, y: 9 }));
    });

    it('should find shortest path (no obstacles)', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Manhattan distance from (0,0) to (9,9) is 18
      // Path should be 19 nodes (including start and end)
      expect(enemy!.path.length).toBe(19);
    });

    it('should path around obstacles', () => {
      // Two staggered walls force a zigzag that exceeds the 18-step Manhattan minimum:
      //   Row 4, cols 0-8 (gap at col 9)  — must go right to pass
      //   Row 6, cols 1-9 (gap at col 0)  — must go left to pass
      // This creates a serpentine path that is longer than 19 nodes.
      const blockedCells: { row: number, col: number }[] = [];
      for (let col = 0; col <= 8; col++) {
        blockedCells.push({ row: 4, col });
      }
      for (let col = 1; col <= 9; col++) {
        blockedCells.push({ row: 6, col });
      }
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(enemy).toBeTruthy();
      expect(enemy!.path.length).toBeGreaterThan(19); // Longer than direct path

      // Verify path doesn't go through blocked cells
      enemy!.path.forEach(node => {
        const isBlocked = blockedCells.some(b => b.row === node.y && b.col === node.x);
        expect(isBlocked).toBe(false);
      });
    });

    it('should use 4-directional movement only', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Check each step only moves in one direction (no diagonals)
      for (let i = 0; i < enemy!.path.length - 1; i++) {
        const current = enemy!.path[i];
        const next = enemy!.path[i + 1];

        const dx = Math.abs(next.x - current.x);
        const dy = Math.abs(next.y - current.y);

        // Should move exactly 1 step in one direction
        expect(dx + dy).toBe(1);
      }
    });
  });

  describe('Path Caching', () => {
    it('should cache paths for reuse', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Both enemies spawned at same spawner, should have identical paths
      expect(enemy1!.path.length).toBe(enemy2!.path.length);

      // Verify paths are equivalent (but different array instances)
      expect(enemy1!.path).not.toBe(enemy2!.path); // Different references

      for (let i = 0; i < enemy1!.path.length; i++) {
        expect(enemy1!.path[i].x).toBe(enemy2!.path[i].x);
        expect(enemy1!.path[i].y).toBe(enemy2!.path[i].y);
      }
    });

    it('should clear path cache when requested', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);

      service.clearPathCache();

      // Spawn again, should recalculate path
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy2).toBeTruthy();
    });

    it('should recalculate path after cache clear with new obstacles', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const pathLength1 = enemy1!.path.length;

      // Clear cache and add obstacle
      service.clearPathCache();
      const blockedCells = [{ row: 1, col: 1 }];
      gameBoardService.getGameBoard.and.returnValue(createTestBoard(10, blockedCells));

      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const pathLength2 = enemy2!.path.length;

      // New path should be different (likely longer due to obstacle)
      expect(pathLength2).toBeGreaterThanOrEqual(pathLength1);
    });
  });

  describe('Enemy Movement', () => {
    it('should move enemy along path', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialPathIndex = enemy!.pathIndex;

      // Update with small delta time
      service.updateEnemies(0.1);

      // Enemy should have moved
      expect(enemy!.distanceTraveled).toBeGreaterThan(0);
    });

    it('should advance pathIndex when reaching next node', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Update with large delta time to ensure node advancement
      service.updateEnemies(2.0);

      // Should have advanced at least one node
      expect(enemy!.pathIndex).toBeGreaterThan(0);
    });

    it('should update mesh position during movement', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialMeshPos = enemy!.mesh!.position.clone();

      service.updateEnemies(0.5);

      const newMeshPos = enemy!.mesh!.position;

      // Mesh should have moved (x or z changed)
      const hasMoved =
        newMeshPos.x !== initialMeshPos.x ||
        newMeshPos.z !== initialMeshPos.z;

      expect(hasMoved).toBe(true);
    });

    it('should return enemy IDs that reached exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Force enemy to last node
      enemy!.pathIndex = enemy!.path.length - 1;

      const reachedExit = service.updateEnemies(0.1);

      expect(reachedExit).toContain(enemy!.id);
    });

    it('should handle multiple enemies simultaneously', () => {
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemy2 = service.spawnEnemy(EnemyType.FAST, mockScene);
      const enemy3 = service.spawnEnemy(EnemyType.HEAVY, mockScene);

      service.updateEnemies(0.1);

      // All enemies should have moved
      expect(enemy1!.distanceTraveled).toBeGreaterThan(0);
      expect(enemy2!.distanceTraveled).toBeGreaterThan(0);
      expect(enemy3!.distanceTraveled).toBeGreaterThan(0);

      // Fast enemy should have moved more than heavy
      expect(enemy2!.distanceTraveled).toBeGreaterThan(enemy3!.distanceTraveled);
    });

    it('should maintain consistent speed regardless of frame rate', () => {
      // Test each frame rate in isolation to avoid cross-contamination

      // 60 FPS: 10 frames at 1/60s each = 0.1667s total
      const enemy1 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      for (let i = 0; i < 10; i++) {
        service.updateEnemies(1/60);
      }
      const distance1 = enemy1!.distanceTraveled;

      // Remove enemy1 before testing enemy2
      service.removeEnemy(enemy1!.id, mockScene);

      // 30 FPS: 5 frames at 1/30s each = 0.1667s total
      const enemy2 = service.spawnEnemy(EnemyType.BASIC, mockScene);
      for (let i = 0; i < 5; i++) {
        service.updateEnemies(1/30);
      }
      const distance2 = enemy2!.distanceTraveled;

      // Should be approximately the same distance (within 5% tolerance)
      expect(Math.abs(distance1 - distance2) / distance1).toBeLessThan(0.05);
    });
  });

  describe('Enemy Removal', () => {
    it('should remove enemy from map', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const enemyId = enemy!.id;

      expect(service.getEnemies().has(enemyId)).toBe(true);

      service.removeEnemy(enemyId, mockScene);

      expect(service.getEnemies().has(enemyId)).toBe(false);
    });

    it('should remove mesh from scene', () => {
      const initialChildren = mockScene.children.length;
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      expect(mockScene.children.length).toBe(initialChildren + 1);

      service.removeEnemy(enemy!.id, mockScene);

      expect(mockScene.children.length).toBe(initialChildren);
    });

    it('should dispose mesh geometry and material', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const geometry = enemy!.mesh!.geometry;
      const material = enemy!.mesh!.material as THREE.Material;

      spyOn(geometry, 'dispose');
      spyOn(material, 'dispose');

      service.removeEnemy(enemy!.id, mockScene);

      expect(geometry.dispose).toHaveBeenCalled();
      expect(material.dispose).toHaveBeenCalled();
    });

    it('should handle removing non-existent enemy gracefully', () => {
      expect(() => {
        service.removeEnemy('non-existent-id', mockScene);
      }).not.toThrow();
    });
  });

  describe('Coordinate Conversion', () => {
    it('should convert grid coordinates to world coordinates correctly', () => {
      // With 10x10 board, tile size 1:
      // (0,0) should map to (-5, -5) in world
      // (9,9) should map to (4, 4) in world
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Enemy spawns at (0,0) in grid
      expect(enemy!.position.x).toBe(-5);
      expect(enemy!.position.z).toBe(-5);
    });

    it('should center board at world origin', () => {
      // Center of 10x10 board is (4.5, 4.5)
      // Should map to (0, 0) in world coords

      // We can't directly test private method, but we verify through enemy spawn
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Position should be offset from origin
      expect(enemy!.position.x).not.toBe(0);
      expect(enemy!.position.z).not.toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero delta time', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialDistance = enemy!.distanceTraveled;

      service.updateEnemies(0);

      expect(enemy!.distanceTraveled).toBe(initialDistance);
    });

    it('should handle very large delta time', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);

      // Multiple updates with large delta time (1 second each)
      service.updateEnemies(1.0);
      service.updateEnemies(1.0);
      service.updateEnemies(1.0);

      // Should advance multiple nodes
      expect(enemy!.pathIndex).toBeGreaterThan(1);
    });

    it('should handle negative delta time gracefully', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      const initialPathIndex = enemy!.pathIndex;
      const initialPos = { ...enemy!.position };

      // Negative delta should be rejected entirely
      const result = service.updateEnemies(-0.1);

      // Should not move at all (pathIndex and position unchanged)
      expect(enemy!.pathIndex).toBe(initialPathIndex);
      expect(enemy!.position.x).toBe(initialPos.x);
      expect(enemy!.position.z).toBe(initialPos.z);
      expect(result).toEqual([]);
    });

    it('should get all active enemies', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      service.spawnEnemy(EnemyType.HEAVY, mockScene);

      const enemies = service.getEnemies();
      expect(enemies.size).toBe(3);
    });
  });

  describe('Damage System (damageEnemy)', () => {
    it('should reduce enemy health and return killed=false when alive', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const initialHealth = enemy.health;

      const result = service.damageEnemy(enemy.id, 10);

      expect(result.killed).toBe(false);
      expect(enemy.health).toBe(initialHealth - 10);
    });

    it('should return killed=true when damage kills the enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      const result = service.damageEnemy(enemy.id, enemy.health);

      expect(result.killed).toBe(true);
      expect(enemy.health).toBe(0);
    });

    it('should return killed=true when damage overkills the enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      const result = service.damageEnemy(enemy.id, enemy.health + 100);

      expect(result.killed).toBe(true);
      expect(enemy.health).toBeLessThan(0);
    });

    it('should return killed=false for already-dead enemy', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // Kill the enemy first
      service.damageEnemy(enemy.id, enemy.health);
      expect(enemy.health).toBe(0);

      // Second damage should return killed=false
      const result = service.damageEnemy(enemy.id, 10);
      expect(result.killed).toBe(false);
      // Health should not change further
      expect(enemy.health).toBe(0);
    });

    it('should return killed=false for non-existent enemy ID', () => {
      const result = service.damageEnemy('non-existent-id', 50);
      expect(result.killed).toBe(false);
    });

    it('should handle multiple sequential damage calls', () => {
      const enemy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      const initialHealth = enemy.health;

      service.damageEnemy(enemy.id, 10);
      service.damageEnemy(enemy.id, 15);
      service.damageEnemy(enemy.id, 20);

      expect(enemy.health).toBe(initialHealth - 45);
    });

    describe('Shielded enemy damage', () => {
      it('should absorb damage into shield before health', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        const result = service.damageEnemy(enemy.id, 20);

        expect(result.killed).toBe(false);
        // Health should be untouched while shield absorbs
        expect(enemy.health).toBe(ENEMY_STATS[EnemyType.SHIELDED].health);
        expect(enemy.shield).toBe(maxShield - 20);
      });

      it('should not damage health until shield is broken', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        // Deal damage less than the shield
        service.damageEnemy(enemy.id, maxShield - 1);
        expect(enemy.health).toBe(ENEMY_STATS[EnemyType.SHIELDED].health);
        expect(enemy.shield).toBe(1);
      });

      it('should carry overkill damage to health when shield breaks in one hit', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
        const overshoot = 30;

        service.damageEnemy(enemy.id, maxShield + overshoot);

        expect(enemy.shield).toBe(0);
        expect(enemy.health).toBe(ENEMY_STATS[EnemyType.SHIELDED].health - overshoot);
      });

      it('should remove shield mesh from userData when shield breaks', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        // Shield mesh should exist before break
        expect(enemy.mesh!.userData['shieldMesh']).toBeTruthy();

        service.damageEnemy(enemy.id, maxShield);

        expect(enemy.shield).toBe(0);
        expect(enemy.mesh!.userData['shieldMesh']).toBeUndefined();
      });

      it('should remove shield mesh from enemy mesh children when shield breaks', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
        const childrenBefore = enemy.mesh!.children.length;

        service.damageEnemy(enemy.id, maxShield);

        expect(enemy.mesh!.children.length).toBe(childrenBefore - 1);
      });

      it('should apply full damage to health after shield is already broken', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;

        // Break shield
        service.damageEnemy(enemy.id, maxShield);
        const healthAfterShieldBreak = enemy.health;

        // Next hit goes straight to health
        service.damageEnemy(enemy.id, 10);
        expect(enemy.health).toBe(healthAfterShieldBreak - 10);
      });

      it('should kill shielded enemy when health reaches 0 after shield breaks', () => {
        const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
        const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
        const totalHealth = ENEMY_STATS[EnemyType.SHIELDED].health;

        const result = service.damageEnemy(enemy.id, maxShield + totalHealth);

        expect(result.killed).toBe(true);
      });
    });

    describe('Swarm enemy death spawning', () => {
      it('should spawn mini-enemies when a SWARM enemy dies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
        const spawnCount = ENEMY_STATS[EnemyType.SWARM].spawnOnDeath!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        expect(result.killed).toBe(true);
        expect(result.spawnedEnemies.length).toBe(spawnCount);
      });

      it('should register spawned mini-enemies in the enemies map', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
        const spawnCount = ENEMY_STATS[EnemyType.SWARM].spawnOnDeath!;
        const sizeBeforeDeath = service.getEnemies().size;

        service.damageEnemy(swarm.id, swarm.health);

        // Mini-swarm enemies should be registered (parent still in map until removeEnemy is called)
        expect(service.getEnemies().size).toBe(sizeBeforeDeath + spawnCount);
      });

      it('should create mini-swarm meshes for spawned enemies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          expect(mini.mesh).toBeTruthy();
        });
      });

      it('should set isMiniSwarm=true on spawned mini-enemies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          expect(mini.isMiniSwarm).toBe(true);
        });
      });

      it('should use MINI_SWARM_STATS for spawned mini-enemies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          expect(mini.health).toBe(MINI_SWARM_STATS.health);
          expect(mini.maxHealth).toBe(MINI_SWARM_STATS.health);
          expect(mini.speed).toBe(MINI_SWARM_STATS.speed);
          expect(mini.value).toBe(MINI_SWARM_STATS.value);
        });
      });

      it('should set leakDamage from MINI_SWARM_STATS on spawned mini-enemies', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          expect(mini.leakDamage).toBe(MINI_SWARM_STATS.leakDamage);
        });
      });

      it('mini-swarm enemies should NOT spawn more enemies on death (no recursion)', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
        const killResult = service.damageEnemy(swarm.id, swarm.health);
        const mini = killResult.spawnedEnemies[0];

        // Killing a mini-swarm should not spawn further enemies
        const miniKillResult = service.damageEnemy(mini.id, mini.health);

        expect(miniKillResult.killed).toBe(true);
        expect(miniKillResult.spawnedEnemies.length).toBe(0);
      });

      it('should not spawn mini-enemies when SWARM enemy is damaged but not killed', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;

        const result = service.damageEnemy(swarm.id, 1);

        expect(result.killed).toBe(false);
        expect(result.spawnedEnemies.length).toBe(0);
      });

      it('spawned mini-enemies should start at the parent path index position', () => {
        const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
        // Advance swarm along path
        swarm.pathIndex = 3;

        const result = service.damageEnemy(swarm.id, swarm.health);

        result.spawnedEnemies.forEach(mini => {
          // Mini path starts at parent's pathIndex node (pathIndex 0 = parent's node 3)
          expect(mini.path[0]).toBe(swarm.path[3]);
        });
      });
    });

    describe('BASIC enemy returns empty spawnedEnemies', () => {
      it('should return empty spawnedEnemies for non-swarm kill', () => {
        const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

        const result = service.damageEnemy(enemy.id, enemy.health);

        expect(result.killed).toBe(true);
        expect(result.spawnedEnemies.length).toBe(0);
      });
    });
  });

  describe('Health Bars (updateHealthBars)', () => {
    it('should scale health bar foreground by health percentage', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth * 0.5); // 50% health

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      expect(healthBarFg.scale.x).toBeCloseTo(0.5, 1);
    });

    it('should show green color above 60% health', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth * 0.3); // 70% health

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      const mat = healthBarFg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0x00ff00);
    });

    it('should show yellow color between 30% and 60% health', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth * 0.55); // 45% health

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      const mat = healthBarFg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0xffff00);
    });

    it('should show red color below 30% health', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth * 0.8); // 20% health

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      const mat = healthBarFg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(0xff0000);
    });

    it('should clamp health bar at zero for dead enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      service.damageEnemy(enemy.id, enemy.maxHealth + 50); // Overkill

      service.updateHealthBars();

      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      expect(healthBarFg.scale.x).toBe(0);
    });

    it('should not throw when enemy has no mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.mesh = undefined as any;

      expect(() => service.updateHealthBars()).not.toThrow();
    });

    it('should billboard health bars to match camera quaternion', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0));

      service.updateHealthBars(quat);

      const healthBarBg = enemy.mesh!.userData['healthBarBg'] as THREE.Mesh;
      const healthBarFg = enemy.mesh!.userData['healthBarFg'] as THREE.Mesh;
      expect(healthBarBg.quaternion.x).toBeCloseTo(quat.x, 5);
      expect(healthBarBg.quaternion.y).toBeCloseTo(quat.y, 5);
      expect(healthBarBg.quaternion.z).toBeCloseTo(quat.z, 5);
      expect(healthBarBg.quaternion.w).toBeCloseTo(quat.w, 5);
      expect(healthBarFg.quaternion.x).toBeCloseTo(quat.x, 5);
      expect(healthBarFg.quaternion.y).toBeCloseTo(quat.y, 5);
      expect(healthBarFg.quaternion.z).toBeCloseTo(quat.z, 5);
      expect(healthBarFg.quaternion.w).toBeCloseTo(quat.w, 5);
    });

    it('should billboard health bars correctly when parent mesh is rotated', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const cameraQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 3, 0));

      // Rotate the parent mesh to simulate an enemy facing a movement direction
      enemy.mesh!.rotation.y = Math.PI / 4;
      // Update the parent's world matrix so getWorldQuaternion reflects the rotation
      enemy.mesh!.updateMatrixWorld(true);

      service.updateHealthBars(cameraQuat);

      const healthBarBg = enemy.mesh!.userData['healthBarBg'] as THREE.Mesh;
      // Force world matrix update on the health bar
      healthBarBg.updateMatrixWorld(true);

      // The health bar's WORLD quaternion should equal the camera quaternion,
      // regardless of the parent mesh rotation
      const worldQuat = new THREE.Quaternion();
      healthBarBg.getWorldQuaternion(worldQuat);

      expect(worldQuat.x).toBeCloseTo(cameraQuat.x, 4);
      expect(worldQuat.y).toBeCloseTo(cameraQuat.y, 4);
      expect(worldQuat.z).toBeCloseTo(cameraQuat.z, 4);
      expect(worldQuat.w).toBeCloseTo(cameraQuat.w, 4);
    });
  });

  describe('Dead Enemy Movement Guard', () => {
    it('should not move dead enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const initialPos = { ...enemy.position };

      // Kill the enemy
      service.damageEnemy(enemy.id, enemy.maxHealth);

      // Try to move
      service.updateEnemies(0.5);

      // Position should not change
      expect(enemy.position.x).toBe(initialPos.x);
      expect(enemy.position.z).toBe(initialPos.z);
    });

    it('should not report dead enemies as reaching exit', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // Put enemy at exit and kill it
      enemy.pathIndex = enemy.path.length - 1;
      service.damageEnemy(enemy.id, enemy.maxHealth);

      const reachedExit = service.updateEnemies(0.1);

      expect(reachedExit).not.toContain(enemy.id);
    });
  });

  describe('cleanup()', () => {
    it('should remove all enemies from the map', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      service.spawnEnemy(EnemyType.HEAVY, mockScene);

      service.cleanup(mockScene);

      expect(service.getEnemies().size).toBe(0);
    });

    it('should remove all enemy meshes from the scene', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      const initialCount = mockScene.children.length;
      expect(initialCount).toBe(2);

      service.cleanup(mockScene);

      expect(mockScene.children.length).toBe(0);
    });

    it('should dispose geometries and materials for all enemies', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const geometry = enemy.mesh!.geometry;
      const material = enemy.mesh!.material as THREE.Material;

      spyOn(geometry, 'dispose');
      spyOn(material, 'dispose');

      service.cleanup(mockScene);

      expect(geometry.dispose).toHaveBeenCalled();
      expect(material.dispose).toHaveBeenCalled();
    });

    it('should be a no-op when called with no enemies', () => {
      expect(() => service.cleanup(mockScene)).not.toThrow();
      expect(service.getEnemies().size).toBe(0);
    });

    it('should handle SHIELDED enemies and dispose shield meshes', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      expect(enemy.mesh!.userData['shieldMesh']).toBeTruthy();

      expect(() => service.cleanup(mockScene)).not.toThrow();
      expect(service.getEnemies().size).toBe(0);
    });

    it('should allow spawning new enemies after cleanup', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.cleanup(mockScene);

      const newEnemy = service.spawnEnemy(EnemyType.FAST, mockScene);
      expect(newEnemy).toBeTruthy();
      expect(service.getEnemies().size).toBe(1);
    });
  });

  describe('reset()', () => {
    it('should reset enemy counter to 0', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);

      service.reset(mockScene);

      // Next spawned enemy should have id 'enemy-0' (counter reset)
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(enemy!.id).toBe('enemy-0');
    });

    it('should clear all enemies from the map', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      service.spawnEnemy(EnemyType.FAST, mockScene);
      service.spawnEnemy(EnemyType.HEAVY, mockScene);

      service.reset(mockScene);

      expect(service.getEnemies().size).toBe(0);
    });

    it('should clear the path cache', () => {
      spyOn(service, 'clearPathCache').and.callThrough();

      service.spawnEnemy(EnemyType.BASIC, mockScene);

      service.reset(mockScene);

      expect(service.clearPathCache).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle 20+ enemies without issues', () => {
      const enemyCount = 25;
      const startTime = performance.now();

      // Spawn 25 enemies
      for (let i = 0; i < enemyCount; i++) {
        service.spawnEnemy(EnemyType.BASIC, mockScene);
      }

      // Update all enemies
      service.updateEnemies(0.016); // ~60 FPS

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 16ms for 60 FPS)
      expect(duration).toBeLessThan(100); // Allow 100ms for test overhead
      expect(service.getEnemies().size).toBe(enemyCount);
    });
  });

  describe('Modifier Effects on Spawn', () => {
    it('should spawn enemy with doubled health when ARMORED_ENEMIES is active', () => {
      const mods = new Set([GameModifier.ARMORED_ENEMIES]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const baseHealth = ENEMY_STATS[EnemyType.BASIC].health;
      expect(enemy.health).toBe(baseHealth * 2);
      expect(enemy.maxHealth).toBe(baseHealth * 2);
    });

    it('should spawn enemy with increased speed when FAST_ENEMIES is active', () => {
      const mods = new Set([GameModifier.FAST_ENEMIES]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const baseSpeed = ENEMY_STATS[EnemyType.BASIC].speed;
      expect(enemy.speed).toBeCloseTo(baseSpeed * 1.5);
    });

    it('should apply SPEED_DEMONS only to FAST type enemies', () => {
      const mods = new Set([GameModifier.SPEED_DEMONS]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      const fastEnemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      const basicEnemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;

      // FAST should get 2x speed
      expect(fastEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.FAST].speed * 2.0);
      // BASIC should NOT get speed bonus from SPEED_DEMONS
      expect(basicEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.BASIC].speed);
    });

    it('should apply SPEED_DEMONS to SWIFT type enemies', () => {
      const mods = new Set([GameModifier.SPEED_DEMONS]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      const swiftEnemy = service.spawnEnemy(EnemyType.SWIFT, mockScene)!;
      expect(swiftEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.SWIFT].speed * 2.0);
    });

    it('should combine FAST_ENEMIES and SPEED_DEMONS for FAST type', () => {
      const mods = new Set([GameModifier.FAST_ENEMIES, GameModifier.SPEED_DEMONS]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      const fastEnemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      // FAST_ENEMIES 1.5x * SPEED_DEMONS 2.0x = 3.0x for FAST type
      expect(fastEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.FAST].speed * 3.0);
    });

    it('should only apply FAST_ENEMIES (not SPEED_DEMONS) to non-fast types when both active', () => {
      const mods = new Set([GameModifier.FAST_ENEMIES, GameModifier.SPEED_DEMONS]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      const heavyEnemy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      // Only FAST_ENEMIES 1.5x applies to HEAVY (not SPEED_DEMONS)
      expect(heavyEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.HEAVY].speed * 1.5);
    });

    it('should spawn with normal stats when no modifiers are active', () => {
      service.setModifierEffects({}, new Set());

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.health).toBe(ENEMY_STATS[EnemyType.BASIC].health);
      expect(enemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.BASIC].speed);
    });

    it('should combine health and speed modifiers', () => {
      const mods = new Set([GameModifier.ARMORED_ENEMIES, GameModifier.FAST_ENEMIES]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.health).toBe(ENEMY_STATS[EnemyType.BASIC].health * 2);
      expect(enemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.BASIC].speed * 1.5);
    });

    it('should clear modifier effects on reset', () => {
      const mods = new Set([GameModifier.ARMORED_ENEMIES]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      service.reset(mockScene);

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.health).toBe(ENEMY_STATS[EnemyType.BASIC].health);
    });

    it('should floor enemy speed at MIN_ENEMY_SPEED even with extreme modifiers', () => {
      // Simulate a near-zero speed multiplier
      service.setModifierEffects({ enemySpeedMultiplier: 0.001 }, new Set());

      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy.speed).toBeGreaterThanOrEqual(0.1);
    });

    it('should apply ARMORED + FAST + SPEED_DEMONS combo correctly', () => {
      const mods = new Set([GameModifier.ARMORED_ENEMIES, GameModifier.FAST_ENEMIES, GameModifier.SPEED_DEMONS]);
      const effects = mergeModifierEffects(mods);
      service.setModifierEffects(effects, mods);

      const fastEnemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      // Health: 2x, Speed: 1.5x * 2.0x = 3.0x for FAST type
      expect(fastEnemy.health).toBe(ENEMY_STATS[EnemyType.FAST].health * 2);
      expect(fastEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.FAST].speed * 3.0);

      const heavyEnemy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      // Health: 2x, Speed: only FAST_ENEMIES 1.5x (SPEED_DEMONS excluded for non-fast)
      expect(heavyEnemy.health).toBe(ENEMY_STATS[EnemyType.HEAVY].health * 2);
      expect(heavyEnemy.speed).toBeCloseTo(ENEMY_STATS[EnemyType.HEAVY].speed * 1.5);
    });
  });

  describe('enemy mesh geometry', () => {
    let meshesToDispose: THREE.Mesh[];

    beforeEach(() => {
      meshesToDispose = [];
    });

    afterEach(() => {
      meshesToDispose.forEach(mesh => {
        mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach(m => m.dispose());
        } else {
          (mat as THREE.Material).dispose();
        }
        // Dispose child meshes (health bars, crowns, shields)
        mesh.children.forEach(child => {
          const childMesh = child as THREE.Mesh;
          if (childMesh.geometry) childMesh.geometry.dispose();
          if (childMesh.material) {
            const childMat = childMesh.material;
            if (Array.isArray(childMat)) {
              childMat.forEach(m => m.dispose());
            } else {
              (childMat as THREE.Material).dispose();
            }
          }
        });
      });
    });

    it('BASIC enemy creates a SphereGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.SphereGeometry);
    });

    it('FAST enemy creates a CapsuleGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.FAST, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.CapsuleGeometry);
    });

    it('HEAVY enemy creates a BoxGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.BoxGeometry);
    });

    it('SWIFT enemy creates a TetrahedronGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.SWIFT, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.TetrahedronGeometry);
    });

    it('BOSS enemy creates a SphereGeometry mesh with a bossCrown in userData', () => {
      const enemy = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.SphereGeometry);
      const crown = enemy.mesh!.userData['bossCrown'] as THREE.Mesh;
      expect(crown).toBeTruthy();
      expect(crown).toBeInstanceOf(THREE.Mesh);
      expect(crown.geometry).toBeInstanceOf(THREE.TorusGeometry);
    });

    it('SHIELDED enemy creates an IcosahedronGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.SHIELDED, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.IcosahedronGeometry);
    });

    it('SWARM enemy creates an OctahedronGeometry mesh', () => {
      const enemy = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.OctahedronGeometry);
    });

    it('FLYING enemy creates a BufferGeometry (custom diamond)', () => {
      const enemy = service.spawnEnemy(EnemyType.FLYING, mockScene)!;
      meshesToDispose.push(enemy.mesh!);

      expect(enemy.mesh!.geometry).toBeInstanceOf(THREE.BufferGeometry);
      // Should NOT be one of the named geometry subclasses — it's a custom diamond
      expect(enemy.mesh!.geometry).not.toBeInstanceOf(THREE.SphereGeometry);
      expect(enemy.mesh!.geometry).not.toBeInstanceOf(THREE.BoxGeometry);
    });

    it('Mini-swarm mesh uses OctahedronGeometry', () => {
      const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
      const result = service.damageEnemy(swarm.id, swarm.health);

      expect(result.spawnedEnemies.length).toBeGreaterThan(0);
      const mini = result.spawnedEnemies[0];
      meshesToDispose.push(mini.mesh!);

      expect(mini.mesh!.geometry).toBeInstanceOf(THREE.OctahedronGeometry);
    });
  });

  describe('updateStatusVisuals', () => {
    let enemy: NonNullable<ReturnType<typeof service.spawnEnemy>>;
    let mesh: THREE.Mesh;

    beforeEach(() => {
      enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      mesh = enemy.mesh!;
    });

    it('enemy with BURN effect gets emissive color 0xff6622', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xff6622);
    });

    it('enemy with POISON effect gets emissive color 0x44ff22', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.POISON]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0x44ff22);
    });

    it('enemy with SLOW effect gets emissive color 0x4488ff', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.SLOW]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0x4488ff);
    });

    it('enemy with no effects reverts to base emissive color', () => {
      const baseColor = ENEMY_STATS[EnemyType.BASIC].color;

      // First apply an effect
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.BURN]);
      service.updateStatusVisuals(activeEffects);

      // Then clear effects
      const noEffects = new Map<string, StatusEffectType[]>();
      service.updateStatusVisuals(noEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(baseColor);
    });

    it('BURN takes priority over POISON when both active', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.POISON, StatusEffectType.BURN]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xff6622);
    });

    it('BURN takes priority over SLOW when both active', () => {
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(enemy.id, [StatusEffectType.SLOW, StatusEffectType.BURN]);

      service.updateStatusVisuals(activeEffects);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(0xff6622);
    });

    it('boss crown mesh is tinted along with body', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;

      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(boss.id, [StatusEffectType.BURN]);
      service.updateStatusVisuals(activeEffects);

      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      expect(crown).toBeTruthy();
      const crownMat = crown.material as THREE.MeshStandardMaterial;
      expect(crownMat.emissive.getHex()).toBe(0xff6622);
    });

    it('boss crown reverts to base color when effects expire', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;

      // Apply then clear
      const activeEffects = new Map<string, StatusEffectType[]>();
      activeEffects.set(boss.id, [StatusEffectType.BURN]);
      service.updateStatusVisuals(activeEffects);

      const noEffects = new Map<string, StatusEffectType[]>();
      service.updateStatusVisuals(noEffects);

      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      const crownMat = crown.material as THREE.MeshStandardMaterial;
      expect(crownMat.emissive.getHex()).toBe(ENEMY_STATS[EnemyType.BOSS].color);
    });

    it('mini-swarm uses correct base emissive intensity on revert', () => {
      // Spawn a swarm and kill it to get minis
      const swarm = service.spawnEnemy(EnemyType.SWARM, mockScene)!;
      const result = service.damageEnemy(swarm.id, 9999);
      result.spawnedEnemies.forEach(mini => {
        if (mini.mesh) mockScene.add(mini.mesh);
      });

      const mini = result.spawnedEnemies[0];
      if (mini && mini.mesh) {
        // Apply then clear effect
        const activeEffects = new Map<string, StatusEffectType[]>();
        activeEffects.set(mini.id, [StatusEffectType.POISON]);
        service.updateStatusVisuals(activeEffects);

        const noEffects = new Map<string, StatusEffectType[]>();
        service.updateStatusVisuals(noEffects);

        const mat = mini.mesh.material as THREE.MeshStandardMaterial;
        expect(mat.emissiveIntensity).toBe(ENEMY_VISUAL_CONFIG.miniSwarmEmissive);
      }
    });
  });

  describe('getPathToExit', () => {
    it('should return world coordinates from spawner to exit', () => {
      const path = service.getPathToExit();

      expect(path.length).toBeGreaterThan(0);
      // First point should be near the spawner (0,0) in world coords
      // worldX = (col - width/2) * tileSize = (0 - 5) * 1 = -5
      // worldZ = (row - height/2) * tileSize = (0 - 5) * 1 = -5
      expect(path[0].x).toBeCloseTo(-5);
      expect(path[0].z).toBeCloseTo(-5);
      // Last point should be near the exit (9,9) in world coords = (4, 4)
      const last = path[path.length - 1];
      expect(last.x).toBeCloseTo(4);
      expect(last.z).toBeCloseTo(4);
    });

    it('should return empty array when no spawner tiles exist', () => {
      // Board with no spawner
      const board: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        board[row] = [];
        for (let col = 0; col < 10; col++) {
          board[row][col] = GameBoardTile.createBase(row, col);
        }
      }
      gameBoardService.getGameBoard.and.returnValue(board);

      const path = service.getPathToExit();
      expect(path.length).toBe(0);
    });

    it('should return empty array when no exit tiles exist', () => {
      // Board with spawner but no exit
      const board: GameBoardTile[][] = [];
      for (let row = 0; row < 10; row++) {
        board[row] = [];
        for (let col = 0; col < 10; col++) {
          if (row === 0 && col === 0) {
            board[row][col] = GameBoardTile.createSpawner(row, col);
          } else {
            board[row][col] = GameBoardTile.createBase(row, col);
          }
        }
      }
      gameBoardService.getGameBoard.and.returnValue(board);

      const path = service.getPathToExit();
      expect(path.length).toBe(0);
    });
  });

  describe('enemy facing direction', () => {
    it('should rotate enemy mesh to face movement direction', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy).toBeTruthy();
      expect(enemy.mesh).toBeTruthy();

      // Initial rotation should be 0 (default)
      const initialRotY = enemy.mesh!.rotation.y;
      expect(initialRotY).toBe(0);

      // Update enemies to move them along path — rotation should change
      service.updateEnemies(0.016);

      // The enemy should now face its movement direction
      // Path goes from (0,0) toward (9,9), so rotation should be non-zero
      // unless the first segment happens to align with default facing
      const afterRotY = enemy.mesh!.rotation.y;
      // atan2 of some direction vector — just verify it was set (not NaN)
      expect(isNaN(afterRotY)).toBe(false);
    });

    it('should face correct direction for known path segment', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      expect(enemy).toBeTruthy();
      expect(enemy.path.length).toBeGreaterThanOrEqual(2);

      // Compute expected angle from the first path segment
      // path nodes use {x: col, y: row} — gridToWorld(row, col) = (col - w/2, row - h/2)
      const boardWidth = 10;
      const boardHeight = 10;
      const node0 = enemy.path[0]; // {x: col, y: row}
      const node1 = enemy.path[1];
      const world0x = (node0.x - boardWidth / 2);
      const world0z = (node0.y - boardHeight / 2);
      const world1x = (node1.x - boardWidth / 2);
      const world1z = (node1.y - boardHeight / 2);
      const dx = world1x - world0x;
      const dz = world1z - world0z;
      const expectedAngle = Math.atan2(dx, dz);

      service.updateEnemies(0.016);
      const rotY = enemy.mesh!.rotation.y;

      // Rotation should match the expected angle from the path direction
      expect(rotY).toBeCloseTo(expectedAngle, 1);
    });
  });

  describe('updateEnemyAnimations', () => {
    it('should spin boss crown over time', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      expect(boss).toBeTruthy();
      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      expect(crown).toBeTruthy();

      const initialRotZ = crown.rotation.z;
      service.updateEnemyAnimations(0.5);

      expect(crown.rotation.z).toBeGreaterThan(initialRotZ);
    });

    it('should not throw for enemies without crowns', () => {
      service.spawnEnemy(EnemyType.BASIC, mockScene);
      expect(() => service.updateEnemyAnimations(0.016)).not.toThrow();
    });

    it('should skip dead enemies', () => {
      const boss = service.spawnEnemy(EnemyType.BOSS, mockScene)!;
      const crown = boss.mesh!.userData['bossCrown'] as THREE.Mesh;
      const initialRotZ = crown.rotation.z;

      // Kill the boss
      service.damageEnemy(boss.id, boss.maxHealth + 100);
      service.updateEnemyAnimations(0.5);

      // Crown should not have rotated
      expect(crown.rotation.z).toBe(initialRotZ);
    });
  });

  // ---------------------------------------------------------------------------
  // repathAffectedEnemies — deferred repathing system
  // ---------------------------------------------------------------------------
  // GridNode convention: x=col, y=row. Board: 10x10, spawner (0,0), exit (9,9).
  // World coords: x = col-5, z = row-5  (tileSize=1, centered on origin).
  // ---------------------------------------------------------------------------

  describe('repathAffectedEnemies', () => {

    /** Build a minimal GridNode for use in path arrays. */
    function node(col: number, row: number): import('../models/enemy.model').GridNode {
      return { x: col, y: row, g: 0, h: 0, f: 0 };
    }

    it('should flag ground enemies whose remaining path crosses the changed tile', () => {
      // Path goes through (row=2, col=3) — change that tile
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0), node(3, 2), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(2, 3); // row=2, col=3

      expect(enemy.needsRepath).toBe(true);
    });

    it('should NOT flag enemies whose remaining path does not cross the changed tile', () => {
      // Path goes right along row 0 — does not pass through (row=5, col=5)
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(5, 5);

      expect(enemy.needsRepath).toBeFalsy();
    });

    it('should skip flying enemies even when their path crosses the changed tile', () => {
      const enemy = service.spawnEnemy(EnemyType.FLYING, mockScene)!;
      // Manually override path to include the changed tile
      enemy.path = [node(0, 0), node(3, 2), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(2, 3); // row=2, col=3

      expect(enemy.needsRepath).toBeFalsy();
    });

    it('should flag ALL ground enemies when called with (-1, -1)', () => {
      // Spawn three different ground enemies with paths that do NOT cross any
      // specific tile — force-all mode (-1,-1) must flag them regardless.
      const e1 = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const e2 = service.spawnEnemy(EnemyType.HEAVY, mockScene)!;
      const e3 = service.spawnEnemy(EnemyType.FAST, mockScene)!;

      // Give each a path that stays far from (0,0) so no tile match would fire
      e1.path = [node(4, 4), node(5, 4), node(9, 9)]; e1.pathIndex = 0;
      e2.path = [node(4, 4), node(5, 4), node(9, 9)]; e2.pathIndex = 0;
      e3.path = [node(4, 4), node(5, 4), node(9, 9)]; e3.pathIndex = 0;

      service.repathAffectedEnemies(-1, -1);

      expect(e1.needsRepath).toBe(true);
      expect(e2.needsRepath).toBe(true);
      expect(e3.needsRepath).toBe(true);
    });

    it('should clear the path cache', () => {
      spyOn(service, 'clearPathCache').and.callThrough();
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(1, 0);

      expect(service.clearPathCache).toHaveBeenCalled();
    });

    it('should not immediately change enemy path or pathIndex', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      const originalPath = [node(0, 0), node(1, 0), node(2, 0), node(3, 0), node(9, 9)];
      enemy.path = [...originalPath];
      enemy.pathIndex = 1;

      service.repathAffectedEnemies(3, 0); // row=3, col=0 — NOT on this path

      // Flagging a different enemy should not touch path or pathIndex
      // Use force-all to definitely flag this enemy
      service.repathAffectedEnemies(-1, -1);

      // Path and pathIndex must be unchanged — repath is deferred to next waypoint
      expect(enemy.path.length).toBe(originalPath.length);
      expect(enemy.pathIndex).toBe(1);
      for (let i = 0; i < originalPath.length; i++) {
        expect(enemy.path[i].x).toBe(originalPath[i].x);
        expect(enemy.path[i].y).toBe(originalPath[i].y);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // pathCrossesTile — tested indirectly via repathAffectedEnemies
  // (private method; behaviour is observable through the needsRepath flag)
  // ---------------------------------------------------------------------------

  describe('pathCrossesTile (via repathAffectedEnemies)', () => {

    function node(col: number, row: number): import('../models/enemy.model').GridNode {
      return { x: col, y: row, g: 0, h: 0, f: 0 };
    }

    it('should return true (flag enemy) when tile appears after current pathIndex', () => {
      // Tile at index 5 — enemy is at pathIndex=2, so tile is ahead
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [
        node(0, 0), node(1, 0), node(2, 0), // indices 0-2 — already passed
        node(3, 0), node(4, 0), node(5, 0),  // indices 3-5 — upcoming; tile at idx 5
        node(9, 9)
      ];
      enemy.pathIndex = 2;

      service.repathAffectedEnemies(0, 5); // row=0, col=5 — node at index 5

      expect(enemy.needsRepath).toBe(true);
    });

    it('should return false (no flag) when tile is strictly before current pathIndex', () => {
      // Tile is at index 1 — enemy is already at pathIndex=3, so tile is behind
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [
        node(0, 0), node(1, 0), // indices 0-1 — behind
        node(2, 0), node(3, 0), node(9, 9)
      ];
      enemy.pathIndex = 3;

      service.repathAffectedEnemies(0, 1); // row=0, col=1 — node at index 1

      expect(enemy.needsRepath).toBeFalsy();
    });

    it('should return false (no flag) when tile is not in the path at all', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(9, 9)];
      enemy.pathIndex = 0;

      service.repathAffectedEnemies(7, 7); // row=7, col=7 — not in path

      expect(enemy.needsRepath).toBeFalsy();
    });
  });

  // ---------------------------------------------------------------------------
  // Deferred repath execution in updateEnemies
  // ---------------------------------------------------------------------------
  // Strategy: place enemy at the world position of pathIndex node so that
  // a deltaTime of 0.6s causes moveDistance (2.0 * 0.6 = 1.2) >= distanceToNext (1.0),
  // triggering a snap and executeRepath.
  // Board: 10x10 with spawner (0,0), exit (9,9), all other tiles traversable.
  // gridToWorld(row=r, col=c) => {x: c-5, z: r-5}
  // ---------------------------------------------------------------------------

  describe('deferred repath execution in updateEnemies', () => {

    function node(col: number, row: number): import('../models/enemy.model').GridNode {
      return { x: col, y: row, g: 0, h: 0, f: 0 };
    }

    /**
     * Return the world {x, z} for a grid (row, col) on a 10x10 board with tileSize=1.
     * Mirrors gridToWorld: x = col - 5, z = row - 5.
     */
    function worldOf(row: number, col: number): { x: number; z: number } {
      return { x: col - 5, z: row - 5 };
    }

    it('should execute repath when enemy reaches a waypoint with needsRepath=true', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Set a straight 4-node path along row=0: col 0→1→2→3
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0)];
      enemy.pathIndex = 0;
      // Position enemy exactly at world coords of node 0 (row=0, col=0)
      const w0 = worldOf(0, 0);
      enemy.position.x = w0.x;
      enemy.position.z = w0.z;
      enemy.needsRepath = true;

      const pathBefore = enemy.path.slice();

      // deltaTime=0.6 → moveDistance=2.0*0.6=1.2 >= 1.0 → snaps to node 1 → executeRepath fires
      service.updateEnemies(0.6);

      // Path must now be the A* result from current grid position, not the original stub
      expect(enemy.path).not.toEqual(pathBefore);
      // A* path from (row=0, col=1) to exit (9,9) must end at (9,9)
      const last = enemy.path[enemy.path.length - 1];
      expect(last.x).toBe(9);
      expect(last.y).toBe(9);
    });

    it('should NOT repath an enemy that has needsRepath=false', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0)];
      enemy.pathIndex = 0;
      const w0 = worldOf(0, 0);
      enemy.position.x = w0.x;
      enemy.position.z = w0.z;
      enemy.needsRepath = false;

      const pathBefore = enemy.path.slice();

      service.updateEnemies(0.6);

      // Path must be unchanged — no repath was requested
      expect(enemy.path.length).toBe(pathBefore.length);
      for (let i = 0; i < pathBefore.length; i++) {
        expect(enemy.path[i].x).toBe(pathBefore[i].x);
        expect(enemy.path[i].y).toBe(pathBefore[i].y);
      }
    });

    it('should repath from the snapped grid position, not the original start', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      // Path: row=0, col 0→1→2 then onwards
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(3, 0), node(9, 9)];
      enemy.pathIndex = 0;
      const w0 = worldOf(0, 0);
      enemy.position.x = w0.x;
      enemy.position.z = w0.z;
      enemy.needsRepath = true;

      service.updateEnemies(0.6); // snaps to col=1, row=0 → executeRepath fires

      // After repath, path[0] must be the arrived-at node (col=1, row=0)
      expect(enemy.path[0].x).toBe(1);
      expect(enemy.path[0].y).toBe(0);
    });

    it('should clear needsRepath flag after executing repath', () => {
      const enemy = service.spawnEnemy(EnemyType.BASIC, mockScene)!;
      enemy.path = [node(0, 0), node(1, 0), node(2, 0), node(9, 9)];
      enemy.pathIndex = 0;
      const w0 = worldOf(0, 0);
      enemy.position.x = w0.x;
      enemy.position.z = w0.z;
      enemy.needsRepath = true;

      service.updateEnemies(0.6); // triggers executeRepath

      expect(enemy.needsRepath).toBe(false);
    });
  });
});
