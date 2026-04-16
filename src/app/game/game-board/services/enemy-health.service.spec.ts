import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { EnemyHealthService } from './enemy-health.service';
import { Enemy, EnemyType, ENEMY_STATS } from '../models/enemy.model';
import { HEALTH_BAR_CONFIG, SHIELD_VISUAL_CONFIG } from '../constants/ui.constants';
import { DEATH_ANIM_CONFIG, HIT_FLASH_CONFIG, SHIELD_BREAK_CONFIG } from '../constants/effects.constants';

/** Build a minimal Enemy fixture for the given type. */
function makeEnemy(type: EnemyType = EnemyType.BASIC, overrides: Partial<Enemy> = {}): Enemy {
  const stats = ENEMY_STATS[type];
  return {
    id: `test-${type}-${Math.random().toString(36).slice(2)}`,
    type,
    position: { x: 0, y: stats.size, z: 0 },
    gridPosition: { row: 0, col: 0 },
    health: stats.health,
    maxHealth: stats.health,
    speed: stats.speed,
    value: stats.value,
    leakDamage: stats.leakDamage,
    path: [],
    pathIndex: 0,
    distanceTraveled: 0,
    ...overrides,
  };
}

/** Create a minimal Mesh with MeshStandardMaterial (matches enemy mesh format). */
function makeEnemyMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  return new THREE.Mesh(geo, mat);
}

/** Attach health bar children to a mesh (mirrors EnemyMeshFactoryService output). */
function attachHealthBar(mesh: THREE.Mesh): { bg: THREE.Mesh; fg: THREE.Mesh } {
  const bgGeo = new THREE.PlaneGeometry(HEALTH_BAR_CONFIG.width, HEALTH_BAR_CONFIG.height);
  const bgMat = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor });
  const bg = new THREE.Mesh(bgGeo, bgMat);
  mesh.userData['healthBarBg'] = bg;

  const fgGeo = new THREE.PlaneGeometry(HEALTH_BAR_CONFIG.width, HEALTH_BAR_CONFIG.height);
  const fgMat = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen });
  const fg = new THREE.Mesh(fgGeo, fgMat);
  mesh.userData['healthBarFg'] = fg;

  mesh.add(bg);
  mesh.add(fg);

  return { bg, fg };
}

/** Attach a shield dome mesh to a mesh (mirrors EnemyMeshFactoryService output). */
function attachShieldMesh(mesh: THREE.Mesh): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 12, 12);
  const mat = new THREE.MeshStandardMaterial({
    color: SHIELD_VISUAL_CONFIG.color,
    opacity: SHIELD_VISUAL_CONFIG.opacity,
    transparent: true,
  });
  const shield = new THREE.Mesh(geo, mat);
  mesh.userData['shieldMesh'] = shield;
  mesh.add(shield);
  return shield;
}

/** Dispose a mesh and all its children. */
function disposeMesh(mesh: THREE.Mesh): void {
  mesh.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        (child.material as THREE.Material).dispose();
      }
    }
  });
}

describe('EnemyHealthService', () => {
  let service: EnemyHealthService;
  const disposables: THREE.Mesh[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EnemyHealthService] });
    service = TestBed.inject(EnemyHealthService);
  });

  afterEach(() => {
    disposables.forEach(disposeMesh);
    disposables.length = 0;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ─── Health bars ────────────────────────────────────────────────────────────

  describe('updateHealthBars', () => {
    it('should set health bar fg scale.x to 1 when at full health', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const { fg } = attachHealthBar(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateHealthBars(enemies);

      expect(fg.scale.x).toBeCloseTo(1);
    });

    it('should set health bar fg scale.x to 0.5 at half health', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const { fg } = attachHealthBar(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, {
        mesh,
        health: ENEMY_STATS[EnemyType.BASIC].health / 2,
      });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateHealthBars(enemies);

      expect(fg.scale.x).toBeCloseTo(0.5);
    });

    it('should set green color when health > thresholdHigh', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const { fg } = attachHealthBar(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh }); // full health
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateHealthBars(enemies);

      const mat = fg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(HEALTH_BAR_CONFIG.colorGreen);
    });

    it('should set yellow color when health is between thresholds', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const { fg } = attachHealthBar(mesh);
      const maxHealth = ENEMY_STATS[EnemyType.BASIC].health;
      const midHealth = Math.round(maxHealth * (HEALTH_BAR_CONFIG.thresholdHigh - 0.1));
      const enemy = makeEnemy(EnemyType.BASIC, { mesh, health: midHealth });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateHealthBars(enemies);

      const mat = fg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(HEALTH_BAR_CONFIG.colorYellow);
    });

    it('should set red color when health is below thresholdLow', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const { fg } = attachHealthBar(mesh);
      const maxHealth = ENEMY_STATS[EnemyType.BASIC].health;
      const lowHealth = Math.round(maxHealth * (HEALTH_BAR_CONFIG.thresholdLow - 0.1));
      const enemy = makeEnemy(EnemyType.BASIC, { mesh, health: lowHealth });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateHealthBars(enemies);

      const mat = fg.material as THREE.MeshBasicMaterial;
      expect(mat.color.getHex()).toBe(HEALTH_BAR_CONFIG.colorRed);
    });

    it('should skip dying enemies', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const { fg } = attachHealthBar(mesh);
      const maxHealth = ENEMY_STATS[EnemyType.BASIC].health;
      const enemy = makeEnemy(EnemyType.BASIC, {
        mesh,
        health: maxHealth / 2,
        dying: true,
      });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateHealthBars(enemies);

      // scale should remain at the default (1) since we skip dying enemies
      expect(fg.scale.x).toBeCloseTo(1);
    });

    it('should billboard health bars to face camera when cameraQuaternion is provided', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const { bg, fg } = attachHealthBar(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      const cameraQuat = new THREE.Quaternion();
      cameraQuat.setFromEuler(new THREE.Euler(0.5, 0.3, 0));
      service.updateHealthBars(enemies, cameraQuat);

      // Both bar planes should have had their quaternion set
      // They won't be identity after billboarding
      const identity = new THREE.Quaternion();
      expect(bg.quaternion.equals(identity)).toBe(false);
      expect(fg.quaternion.equals(identity)).toBe(false);
    });

    it('should be a no-op when enemy has no mesh', () => {
      const enemy = makeEnemy(EnemyType.BASIC); // no mesh
      const enemies = new Map([[enemy.id, enemy]]);
      expect(() => service.updateHealthBars(enemies)).not.toThrow();
    });

    it('should scale SHIELDED shield bar by shield/maxShield ratio', () => {
      const mesh = makeEnemyMesh();
      attachHealthBar(mesh);
      const shieldBg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.05), new THREE.MeshBasicMaterial());
      const shieldFg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.05), new THREE.MeshBasicMaterial());
      mesh.userData['shieldBarBg'] = shieldBg;
      mesh.userData['shieldBarFg'] = shieldFg;
      mesh.add(shieldBg);
      mesh.add(shieldFg);

      const enemy: Enemy = { ...makeEnemy(EnemyType.SHIELDED), mesh, shield: 30, maxShield: 60 };
      service.updateHealthBars(new Map([[enemy.id, enemy]]));

      expect(shieldFg.visible).toBe(true);
      expect(shieldFg.scale.x).toBeCloseTo(0.5);
    });

    it('should hide shield bar once shield is depleted', () => {
      const mesh = makeEnemyMesh();
      attachHealthBar(mesh);
      const shieldBg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.05), new THREE.MeshBasicMaterial());
      const shieldFg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.05), new THREE.MeshBasicMaterial());
      mesh.userData['shieldBarBg'] = shieldBg;
      mesh.userData['shieldBarFg'] = shieldFg;
      mesh.add(shieldBg);
      mesh.add(shieldFg);

      const enemy: Enemy = { ...makeEnemy(EnemyType.SHIELDED), mesh, shield: 0, maxShield: 60 };
      service.updateHealthBars(new Map([[enemy.id, enemy]]));

      expect(shieldFg.visible).toBe(false);
      expect(shieldBg.visible).toBe(false);
    });
  });

  // ─── Hit flash ──────────────────────────────────────────────────────────────

  describe('startHitFlash', () => {
    it('should set hitFlashTimer on the enemy', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startHitFlash(enemies, enemy.id);

      expect(enemy.hitFlashTimer).toBeCloseTo(HIT_FLASH_CONFIG.duration);
    });

    it('should apply white emissive to the mesh material', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startHitFlash(enemies, enemy.id);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissive.getHex()).toBe(HIT_FLASH_CONFIG.color);
      expect(mat.emissiveIntensity).toBeCloseTo(HIT_FLASH_CONFIG.emissiveIntensity);
    });

    it('should snapshot the pre-flash emissive values', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x223344);
      mat.emissiveIntensity = 0.4;
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startHitFlash(enemies, enemy.id);

      expect(mesh.userData['preFlashEmissive']).toBe(0x223344);
      expect(mesh.userData['preFlashEmissiveIntensity']).toBeCloseTo(0.4);
    });

    it('should be a no-op when the enemy is dying', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh, dying: true });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startHitFlash(enemies, enemy.id);

      expect(enemy.hitFlashTimer).toBeUndefined();
    });

    it('should be a no-op for unknown enemy id', () => {
      const enemies = new Map<string, Enemy>();
      expect(() => service.startHitFlash(enemies, 'ghost-id')).not.toThrow();
    });

    it('should throttle: skip if already mid-flash', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh, hitFlashTimer: 0.05 });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startHitFlash(enemies, enemy.id);

      // Timer should remain at the existing value (0.05), not reset to full duration
      expect(enemy.hitFlashTimer).toBeCloseTo(0.05);
    });
  });

  describe('updateHitFlashes', () => {
    it('should reduce hitFlashTimer by deltaTime', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);
      service.startHitFlash(enemies, enemy.id);
      const initialTimer = enemy.hitFlashTimer!;

      service.updateHitFlashes(enemies, 0.05);

      expect(enemy.hitFlashTimer!).toBeCloseTo(initialTimer - 0.05);
    });

    it('should restore emissive values when timer expires', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x445566);
      mat.emissiveIntensity = 0.3;
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startHitFlash(enemies, enemy.id);
      // Advance past the flash duration
      service.updateHitFlashes(enemies, HIT_FLASH_CONFIG.duration + 0.1);

      expect(mat.emissive.getHex()).toBe(0x445566);
      expect(mat.emissiveIntensity).toBeCloseTo(0.3);
    });

    it('should cancel flash and set timer to 0 when enemy becomes dying', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);
      service.startHitFlash(enemies, enemy.id);
      enemy.dying = true;

      service.updateHitFlashes(enemies, 0.01);

      expect(enemy.hitFlashTimer).toBe(0);
    });

    it('should be a no-op when deltaTime <= 0', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh, hitFlashTimer: 0.1 });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateHitFlashes(enemies, 0);

      expect(enemy.hitFlashTimer).toBeCloseTo(0.1);
    });

    it('should restore boss crown emissive when flash expires', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const crownGeo = new THREE.TorusGeometry(0.5, 0.1, 8, 16);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crownMat.emissive.setHex(0xaa8800);
      crownMat.emissiveIntensity = 0.8;
      mesh.userData['bossCrown'] = crown;
      mesh.add(crown);
      disposables.push(crown);

      const enemy = makeEnemy(EnemyType.BOSS, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startHitFlash(enemies, enemy.id);
      service.updateHitFlashes(enemies, HIT_FLASH_CONFIG.duration + 0.1);

      expect(crownMat.emissive.getHex()).toBe(0xaa8800);
      expect(crownMat.emissiveIntensity).toBeCloseTo(0.8);
    });
  });

  // ─── Dying animation ────────────────────────────────────────────────────────

  describe('startDyingAnimation', () => {
    it('should set dying=true on the enemy', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startDyingAnimation(enemies, enemy.id);

      expect(enemy.dying).toBe(true);
    });

    it('should set dyingTimer to DEATH_ANIM_CONFIG.duration for non-boss', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startDyingAnimation(enemies, enemy.id);

      expect(enemy.dyingTimer).toBeCloseTo(DEATH_ANIM_CONFIG.duration);
    });

    it('should set dyingTimer to DEATH_ANIM_CONFIG.durationBoss for BOSS', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BOSS, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startDyingAnimation(enemies, enemy.id);

      expect(enemy.dyingTimer).toBeCloseTo(DEATH_ANIM_CONFIG.durationBoss);
    });

    it('should set mesh material transparent=true', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startDyingAnimation(enemies, enemy.id);

      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.transparent).toBe(true);
    });

    it('should be a no-op when called on unknown id', () => {
      const enemies = new Map<string, Enemy>();
      expect(() => service.startDyingAnimation(enemies, 'ghost-id')).not.toThrow();
    });

    it('should be a no-op when called twice (idempotent)', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);

      service.startDyingAnimation(enemies, enemy.id);
      const timerAfterFirst = enemy.dyingTimer!;
      enemy.dyingTimer = timerAfterFirst - 0.1;

      service.startDyingAnimation(enemies, enemy.id);

      // Timer should not have been reset
      expect(enemy.dyingTimer).toBeCloseTo(timerAfterFirst - 0.1);
    });
  });

  describe('updateDyingAnimations', () => {
    it('should reduce dyingTimer by deltaTime', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);
      service.startDyingAnimation(enemies, enemy.id);
      const initial = enemy.dyingTimer!;
      const scene = new THREE.Scene();

      service.updateDyingAnimations(enemies, 0.1, scene, () => {});

      expect(enemy.dyingTimer!).toBeCloseTo(initial - 0.1);
    });

    it('should shrink mesh scale over time', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);
      service.startDyingAnimation(enemies, enemy.id);
      const scene = new THREE.Scene();

      service.updateDyingAnimations(enemies, DEATH_ANIM_CONFIG.duration * 0.5, scene, () => {});

      expect(mesh.scale.x).toBeLessThan(1);
    });

    it('should call removeEnemy when timer reaches 0', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);
      service.startDyingAnimation(enemies, enemy.id);
      const scene = new THREE.Scene();
      const removeEnemy = jasmine.createSpy('removeEnemy');

      service.updateDyingAnimations(enemies, DEATH_ANIM_CONFIG.duration + 0.1, scene, removeEnemy);

      expect(removeEnemy).toHaveBeenCalledWith(enemy.id, scene);
    });

    it('should call removeEnemy with BOSS duration for BOSS enemies', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BOSS, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);
      service.startDyingAnimation(enemies, enemy.id);
      const scene = new THREE.Scene();
      const removeEnemy = jasmine.createSpy('removeEnemy');

      // Duration too short for BOSS — should NOT call removeEnemy
      service.updateDyingAnimations(enemies, DEATH_ANIM_CONFIG.duration + 0.01, scene, removeEnemy);
      expect(removeEnemy).not.toHaveBeenCalled();

      // Full BOSS duration — should call removeEnemy
      service.updateDyingAnimations(enemies, DEATH_ANIM_CONFIG.durationBoss, scene, removeEnemy);
      expect(removeEnemy).toHaveBeenCalledWith(enemy.id, scene);
    });

    it('should be a no-op when deltaTime <= 0', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh });
      const enemies = new Map([[enemy.id, enemy]]);
      service.startDyingAnimation(enemies, enemy.id);
      const initialTimer = enemy.dyingTimer!;
      const scene = new THREE.Scene();

      service.updateDyingAnimations(enemies, 0, scene, () => {});

      expect(enemy.dyingTimer!).toBeCloseTo(initialTimer);
    });
  });

  // ─── Shield break animation ─────────────────────────────────────────────────

  describe('updateShieldBreakAnimations', () => {
    it('should reduce shieldBreakTimer by deltaTime', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      attachShieldMesh(mesh);
      const enemy = makeEnemy(EnemyType.SHIELDED, {
        mesh,
        shieldBreaking: true,
        shieldBreakTimer: SHIELD_BREAK_CONFIG.duration,
      });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateShieldBreakAnimations(enemies, 0.1);

      expect(enemy.shieldBreakTimer!).toBeCloseTo(SHIELD_BREAK_CONFIG.duration - 0.1);
    });

    it('should scale up the shield mesh as animation progresses', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const shield = attachShieldMesh(mesh);
      const enemy = makeEnemy(EnemyType.SHIELDED, {
        mesh,
        shieldBreaking: true,
        shieldBreakTimer: SHIELD_BREAK_CONFIG.duration,
      });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateShieldBreakAnimations(enemies, SHIELD_BREAK_CONFIG.duration * 0.5);

      expect(shield.scale.x).toBeGreaterThan(1);
    });

    it('should fade opacity toward 0 as animation progresses', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const shield = attachShieldMesh(mesh);
      const enemy = makeEnemy(EnemyType.SHIELDED, {
        mesh,
        shieldBreaking: true,
        shieldBreakTimer: SHIELD_BREAK_CONFIG.duration,
      });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateShieldBreakAnimations(enemies, SHIELD_BREAK_CONFIG.duration * 0.5);

      const mat = shield.material as THREE.MeshStandardMaterial;
      expect(mat.opacity).toBeLessThan(SHIELD_VISUAL_CONFIG.opacity);
    });

    it('should remove and dispose the shield mesh when timer expires', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      attachShieldMesh(mesh);
      const enemy = makeEnemy(EnemyType.SHIELDED, {
        mesh,
        shieldBreaking: true,
        shieldBreakTimer: SHIELD_BREAK_CONFIG.duration,
      });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateShieldBreakAnimations(enemies, SHIELD_BREAK_CONFIG.duration + 0.01);

      expect(enemy.shieldBreaking).toBe(false);
      expect(enemy.shieldBreakTimer).toBeUndefined();
      expect(mesh.userData['shieldMesh']).toBeUndefined();
    });

    it('should skip enemies with no active shield break animation', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      const enemy = makeEnemy(EnemyType.BASIC, { mesh }); // no shieldBreaking
      const enemies = new Map([[enemy.id, enemy]]);

      expect(() => service.updateShieldBreakAnimations(enemies, 0.1)).not.toThrow();
    });

    it('should be a no-op when deltaTime <= 0', () => {
      const mesh = makeEnemyMesh();
      disposables.push(mesh);
      attachShieldMesh(mesh);
      const enemy = makeEnemy(EnemyType.SHIELDED, {
        mesh,
        shieldBreaking: true,
        shieldBreakTimer: SHIELD_BREAK_CONFIG.duration,
      });
      const enemies = new Map([[enemy.id, enemy]]);

      service.updateShieldBreakAnimations(enemies, 0);

      expect(enemy.shieldBreakTimer!).toBeCloseTo(SHIELD_BREAK_CONFIG.duration);
    });
  });
});
