import { EnemyType, ENEMY_STATS } from './enemy.model';
import { EnemyInfo, ENEMY_INFO } from './enemy-info.model';

describe('ENEMY_INFO', () => {
  const allTypes = Object.values(EnemyType);

  it('should have entries for all 14 EnemyType values', () => {
    // 9 original + MINER (sprint 21) + UNSHAKEABLE (sprint 22) + VEINSEEKER (sprint 23) = 12
    // + GLIDER (sprint 37) + TITAN (sprint 38) = 13
    // + WYRM_ASCENDANT (sprint 39) = 14.
    expect(allTypes.length).toBe(14);
    for (const type of allTypes) {
      expect(ENEMY_INFO[type]).withContext(`Missing entry for ${type}`).toBeDefined();
    }
  });

  it('each entry should have the correct type field', () => {
    for (const type of allTypes) {
      expect(ENEMY_INFO[type].type).toBe(type);
    }
  });

  it('each entry should have a non-empty name', () => {
    for (const type of allTypes) {
      expect(ENEMY_INFO[type].name.length).withContext(`Empty name for ${type}`).toBeGreaterThan(0);
    }
  });

  it('each entry should have a non-empty description', () => {
    for (const type of allTypes) {
      expect(ENEMY_INFO[type].description.length).withContext(`Empty description for ${type}`).toBeGreaterThan(0);
    }
  });

  it('each entry should have positive health', () => {
    for (const type of allTypes) {
      expect(ENEMY_INFO[type].health).withContext(`Non-positive health for ${type}`).toBeGreaterThan(0);
    }
  });

  it('each entry should have positive speed', () => {
    for (const type of allTypes) {
      expect(ENEMY_INFO[type].speed).withContext(`Non-positive speed for ${type}`).toBeGreaterThan(0);
    }
  });

  it('each entry should have positive reward', () => {
    for (const type of allTypes) {
      expect(ENEMY_INFO[type].reward).withContext(`Non-positive reward for ${type}`).toBeGreaterThan(0);
    }
  });

  it('each entry should have a non-negative leakDamage', () => {
    for (const type of allTypes) {
      expect(ENEMY_INFO[type].leakDamage).withContext(`Negative leakDamage for ${type}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('FLYING should have Slow in its immunities', () => {
    expect(ENEMY_INFO[EnemyType.FLYING].immunities).toContain('Slow');
  });

  it('BASIC should have no immunities', () => {
    expect(ENEMY_INFO[EnemyType.BASIC].immunities.length).toBe(0);
  });

  it('BOSS should have leakDamage of 3', () => {
    expect(ENEMY_INFO[EnemyType.BOSS].leakDamage).toBe(3);
  });

  it('HEAVY should have leakDamage of 2', () => {
    expect(ENEMY_INFO[EnemyType.HEAVY].leakDamage).toBe(2);
  });

  it('SHIELDED should have leakDamage of 2', () => {
    expect(ENEMY_INFO[EnemyType.SHIELDED].leakDamage).toBe(2);
  });

  it('BASIC should have leakDamage of 1', () => {
    expect(ENEMY_INFO[EnemyType.BASIC].leakDamage).toBe(1);
  });

  it('all colors should be valid positive hex numbers', () => {
    for (const type of allTypes) {
      const color = ENEMY_INFO[type].color;
      expect(color).withContext(`Invalid color for ${type}`).toBeGreaterThanOrEqual(0);
      expect(color).withContext(`Color exceeds 0xFFFFFF for ${type}`).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('SWARM should have a special ability describing mini-swarms', () => {
    expect(ENEMY_INFO[EnemyType.SWARM].special).not.toBeNull();
    expect(ENEMY_INFO[EnemyType.SWARM].special).toContain('mini-swarm');
  });

  it('SHIELDED should have a special ability mentioning shield', () => {
    expect(ENEMY_INFO[EnemyType.SHIELDED].special).not.toBeNull();
    expect(ENEMY_INFO[EnemyType.SHIELDED].special!.toLowerCase()).toContain('shield');
  });

  it('SHIELDED special should derive shield value from ENEMY_STATS maxShield', () => {
    const maxShield = ENEMY_STATS[EnemyType.SHIELDED].maxShield!;
    expect(ENEMY_INFO[EnemyType.SHIELDED].special).toContain(String(maxShield));
  });

  it('FLYING should have a special ability', () => {
    expect(ENEMY_INFO[EnemyType.FLYING].special).not.toBeNull();
  });

  it('immunities should be string arrays', () => {
    for (const type of allTypes) {
      expect(Array.isArray(ENEMY_INFO[type].immunities)).toBeTrue();
    }
  });

  it('Object.values(ENEMY_INFO) should return 14 entries in a stable order', () => {
    // Sprint 39: WYRM_ASCENDANT added → 14 entries total.
    const infoList = Object.values(ENEMY_INFO);
    expect(infoList.length).toBe(14);
    for (const info of infoList) {
      // Each item must satisfy the EnemyInfo interface shape
      expect(info.type).toBeDefined();
      expect(info.name).toBeDefined();
      expect(info.description).toBeDefined();
    }
  });
});
