import { EnemyService, DamageResult } from '../../services/enemy.service';
import { StatusEffectService } from '../../services/status-effect.service';
import { CombatLoopService } from '../../services/combat-loop.service';
import { WaveService } from '../../services/wave.service';
import { ScreenShakeService } from '../../services/screen-shake.service';
import { Enemy } from '../../models/enemy.model';
import { TowerType } from '../../models/tower.model';

/**
 * Create a pre-configured EnemyService spy.
 * The damageEnemy callFake mutates enemy.health and returns killed status.
 */
export function createEnemyServiceSpy(
  enemyMap: Map<string, Enemy>
): jasmine.SpyObj<EnemyService> {
  const methods: (keyof EnemyService)[] = [
    'getEnemies', 'damageEnemy', 'damageStrongestEnemy',
    'spawnEnemy', 'removeEnemy', 'startHitFlash', 'stepEnemiesOneTurn',
    'buildOccupiedSpawnerSet', 'applyDetour',
  ];
  const spy = jasmine.createSpyObj<EnemyService>('EnemyService', methods);
  spy.getEnemies.and.returnValue(enemyMap);
  spy.damageEnemy.and.callFake((id: string, damage: number): DamageResult => {
    const enemy = enemyMap.get(id);
    if (!enemy || enemy.health <= 0) return { killed: false, spawnedEnemies: [] };
    enemy.health -= damage;
    return { killed: enemy.health <= 0, spawnedEnemies: [] };
  });
  spy.stepEnemiesOneTurn.and.returnValue([]);
  spy.buildOccupiedSpawnerSet.and.returnValue(new Set<string>());
  spy.applyDetour.and.returnValue(0);
  return spy;
}

/**
 * Create a pre-configured StatusEffectService spy.
 *
 * Default return values:
 *   - apply() — false (effect not applied)
 *   - update() — empty array (no kills from DoT)
 *   - hasEffect() — false
 *   - getEffects() / getAllActiveEffects() — empty
 *   - getSlowApplicationCount() — 0
 *   - All cleanup / removal methods — no-op void
 */
export function createStatusEffectServiceSpy(): jasmine.SpyObj<StatusEffectService> {
  // M2 S2: 'update' removed from spy method list (deleted from production).
  // tickTurn + getSlowTileReduction are the turn-based replacements.
  const spy = jasmine.createSpyObj<StatusEffectService>('StatusEffectService', [
    'apply',
    'tickTurn',
    'getSlowTileReduction',
    'hasEffect',
    'getEffects',
    'getAllActiveEffects',
    'removeEffect',
    'removeAllEffects',
    'getSlowApplicationCount',
    'cleanup',
  ]);
  spy.apply.and.returnValue(false);
  spy.tickTurn.and.returnValue([]);
  spy.getSlowTileReduction.and.returnValue(0);
  spy.hasEffect.and.returnValue(false);
  spy.getEffects.and.returnValue([]);
  spy.getAllActiveEffects.and.returnValue(new Map());
  spy.getSlowApplicationCount.and.returnValue(0);
  return spy;
}

/**
 * Create a pre-configured CombatLoopService spy.
 *
 * Default return values:
 *   - resolveTurn() — empty CombatFrameResult (no kills, no events)
 *   - getTurnNumber() — 0
 *   - reset() / resetLeakState() — no-op void
 *
 * Hardening H1: tick() was deleted — the physics loop is gone. Any spec that
 * still needs tick() semantics should cast to any and call it as a missing
 * member (that's a runtime error — those specs are xdescribe'd in H1 and
 * rewritten in H2).
 */
export function createCombatLoopServiceSpy(): jasmine.SpyObj<CombatLoopService> {
  const spy = jasmine.createSpyObj<CombatLoopService>('CombatLoopService', [
    'resolveTurn',
    'resetLeakState',
    'reset',
    'getTurnNumber',
  ]);
  const emptyFrame = {
    kills: [],
    firedTypes: new Set<TowerType>(),
    hitCount: 0,
    exitCount: 0,
    leaked: false,
    defeatTriggered: false,
    waveCompletion: null,
    gameEnd: null,
    combatAudioEvents: [],
    damageDealt: 0,
    killsByTower: [],
  };
  spy.resolveTurn.and.returnValue(emptyFrame);
  spy.getTurnNumber.and.returnValue(0);
  return spy;
}

/**
 * Create a pre-configured WaveService spy.
 *
 * Default return values:
 *   - hasCustomWaves() / isEndlessMode() / isSpawning() — false
 *   - getWaveDefinitions() — empty array
 *   - getTotalEnemiesInWave() / getWaveReward() / getMaxWaves() / getRemainingToSpawn() — 0
 *   - getCurrentEndlessTemplate() / getCurrentEndlessResult() — null
 *   - All mutating methods — no-op void
 */
export function createWaveServiceSpy(): jasmine.SpyObj<WaveService> {
  // M2 S3: 'update' removed; spawnForTurn is the turn-based replacement.
  const spy = jasmine.createSpyObj<WaveService>('WaveService', [
    'setCustomWaves',
    'clearCustomWaves',
    'hasCustomWaves',
    'getWaveDefinitions',
    'getCurrentWaveDefinition',
    'setEndlessMode',
    'isEndlessMode',
    'getCurrentEndlessTemplate',
    'getCurrentEndlessResult',
    'startWave',
    'spawnForTurn',
    'getRemainingInTurnSchedule',
    'getUpcomingSpawnsPreview',
    'isSpawning',
    'getRemainingToSpawn',
    'getTotalEnemiesInWave',
    'getWaveReward',
    'getMaxWaves',
    'reset',
  ]);
  spy.spawnForTurn.and.returnValue(0);
  spy.getRemainingInTurnSchedule.and.returnValue(0);
  spy.getUpcomingSpawnsPreview.and.returnValue([]);
  spy.hasCustomWaves.and.returnValue(false);
  spy.isEndlessMode.and.returnValue(false);
  spy.isSpawning.and.returnValue(false);
  spy.getWaveDefinitions.and.returnValue([]);
  spy.getCurrentWaveDefinition.and.returnValue(null);
  spy.getTotalEnemiesInWave.and.returnValue(0);
  spy.getWaveReward.and.returnValue(0);
  spy.getMaxWaves.and.returnValue(0);
  spy.getRemainingToSpawn.and.returnValue(0);
  spy.getCurrentEndlessTemplate.and.returnValue(null);
  spy.getCurrentEndlessResult.and.returnValue(null);
  return spy;
}

export function createScreenShakeServiceSpy(): jasmine.SpyObj<ScreenShakeService> {
  const spy = jasmine.createSpyObj<ScreenShakeService>('ScreenShakeService', [
    'trigger', 'update', 'cleanup',
  ]);
  return spy;
}
