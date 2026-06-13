import { Provider } from '@angular/core';

import { EnemyService, DamageResult } from '../../services/enemy.service';
import { StatusEffectService } from '../../services/status-effect.service';
import { CombatLoopService } from '../../services/combat-loop.service';
import { WaveService } from '../../services/wave.service';
import { ScreenShakeService } from '../../services/screen-shake.service';
import { Enemy } from '../../models/enemy.model';
import { TowerType } from '../../models/tower.model';
import { GameStateService } from '../../services/game-state.service';
import { GameStatsService } from '../../services/game-stats.service';
import { GameEndService } from '../../services/game-end.service';
import { GameNotificationService } from '../../services/game-notification.service';
import { AudioService } from '../../services/audio.service';
import { PathMutationService } from '../../services/path-mutation.service';
import { ElevationService } from '../../services/elevation.service';
import { TowerCombatService } from '../../services/tower-combat.service';
import { TowerGraphService } from '../../services/tower-graph.service';
import { DamagePopupService } from '../../services/damage-popup.service';
import { RunEventBusService } from '../../../../run/services/run-event-bus.service';
import { CardEffectService } from '../../../../run/services/card-effect.service';
import { RelicService } from '../../../../run/services/relic.service';
import { RunService } from '../../../../run/services/run.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { createRelicServiceSpy, createCardEffectServiceSpy } from './run-card.spies';

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
    'buildOccupiedSpawnerSet', 'applyDetour', 'tickNovaSovereignEffects',
  ];
  const spy = jasmine.createSpyObj<EnemyService>('EnemyService', methods);
  spy.getEnemies.and.returnValue(enemyMap);
  spy.damageEnemy.and.callFake((id: string, damage: number): DamageResult => {
    const enemy = enemyMap.get(id);
    if (!enemy || enemy.health <= 0) return { killed: false, spawnedEnemies: [], damageDealt: 0, shieldHit: false };
    enemy.health -= damage;
    return { killed: enemy.health <= 0, spawnedEnemies: [], damageDealt: damage, shieldHit: false };
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
    livesLostThisFrame: 0,
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

/**
 * Returns a Provider[] wiring the full real DI graph required by
 * CombatLoopService in tests. Mirrors what GameBoardComponent.providers
 * supplies in production so specs get the same graph without gap-filling via
 * @Optional().
 *
 * Usage:
 *   TestBed.configureTestingModule({
 *     providers: [
 *       ...createCombatLoopServiceTestProviders(combatSpy, relicSpy, cardSpy),
 *       // spread additional overrides as needed
 *     ]
 *   });
 *
 * @param combatSpy  TowerCombatService spy (required — caller controls its return values).
 * @param relicSpy   RelicService spy; a fresh one is created when omitted.
 * @param cardSpy    CardEffectService spy; a fresh one is created when omitted.
 * @param runSpy     RunService spy; built from createRunServiceSpy() shape when omitted.
 */
export function createCombatLoopServiceTestProviders(
  combatSpy: jasmine.SpyObj<TowerCombatService>,
  relicSpy?: jasmine.SpyObj<RelicService>,
  cardSpy?: jasmine.SpyObj<CardEffectService>,
  runSpy?: jasmine.SpyObj<RunService>,
): Provider[] {
  const resolvedRelicSpy = relicSpy ?? createRelicServiceSpy();
  const resolvedCardSpy = cardSpy ?? createCardEffectServiceSpy();

  const resolvedRunSpy = runSpy ?? (() => {
    const s = jasmine.createSpyObj<RunService>('RunService', [
      'isInRun', 'getCurrentEncounter', 'nextRandom',
    ]);
    s.isInRun.and.returnValue(true);
    s.getCurrentEncounter.and.returnValue(null as unknown as ReturnType<RunService['getCurrentEncounter']>);
    s.nextRandom.and.returnValue(0);
    return s;
  })();

  const gameStateSpy = jasmine.createSpyObj<GameStateService>('GameStateService', [
    'getState', 'addGoldAndScore', 'loseLife', 'addStreakBonus',
    'getStreak', 'completeWave', 'awardInterest', 'addElapsedTime', 'getModifierEffects',
  ]);
  gameStateSpy.addStreakBonus.and.returnValue(0);
  gameStateSpy.getStreak.and.returnValue(0);
  gameStateSpy.awardInterest.and.returnValue(0);
  gameStateSpy.getModifierEffects.and.returnValue({});

  const waveSpy = jasmine.createSpyObj<WaveService>('WaveService', [
    'spawnForTurn', 'isSpawning', 'getWaveReward', 'getCurrentWaveDefinition',
  ]);
  waveSpy.spawnForTurn.and.stub();
  waveSpy.isSpawning.and.returnValue(true);
  waveSpy.getWaveReward.and.returnValue(50);
  waveSpy.getCurrentWaveDefinition.and.returnValue(null);

  const enemySpy = jasmine.createSpyObj<EnemyService>('EnemyService', [
    'getEnemies', 'stepEnemiesOneTurn', 'removeEnemy', 'startDyingAnimation',
    'getLivingEnemyCount', 'tickMinerDigs', 'tickNovaSovereignEffects',
  ]);
  enemySpy.getEnemies.and.returnValue(new Map());
  enemySpy.stepEnemiesOneTurn.and.returnValue([]);
  enemySpy.getLivingEnemyCount.and.returnValue(0);

  const gameStatsSpy = jasmine.createSpyObj<GameStatsService>('GameStatsService', [
    'recordGoldEarned', 'recordEnemyLeaked',
  ]);

  const gameEndSpy = jasmine.createSpyObj<GameEndService>('GameEndService', [
    'isRecorded', 'recordEnd',
  ]);
  gameEndSpy.isRecorded.and.returnValue(false);
  gameEndSpy.recordEnd.and.returnValue({ newlyUnlockedAchievements: [], completedChallenges: [] });

  const eventBusSpy = jasmine.createSpyObj<RunEventBusService>('RunEventBusService', ['emit']);

  const statusEffectSpy = jasmine.createSpyObj<StatusEffectService>('StatusEffectService', [
    'tickTurn', 'getSlowTileReduction', 'apply', 'hasEffect',
    'getEffects', 'getAllActiveEffects', 'removeAllEffects', 'cleanup',
  ]);
  statusEffectSpy.tickTurn.and.returnValue([]);
  statusEffectSpy.getSlowTileReduction.and.returnValue(0);
  statusEffectSpy.getAllActiveEffects.and.returnValue(new Map());
  statusEffectSpy.getEffects.and.returnValue([]);

  const notificationSpy = jasmine.createSpyObj<GameNotificationService>(
    'GameNotificationService', ['show', 'dismiss', 'clear', 'getNotifications'],
  );

  const audioSpy = jasmine.createSpyObj<AudioService>('AudioService', [
    'playTowerFire', 'playEnemyHit', 'playEnemyDeath', 'playWaveStart',
    'playWaveClear', 'playGoldEarned', 'playTowerPlace', 'playTowerUpgrade',
    'playTowerSell', 'playDefeat', 'playVictory', 'playLifeLoss',
    'playAchievementSound', 'playStreakSound', 'playChallengeSound',
    'playSfx', 'playSequence', 'setVolume', 'toggleMute', 'cleanup',
    'resetFrameCounters',
  ]);

  const screenShakeSpy = jasmine.createSpyObj<ScreenShakeService>('ScreenShakeService', [
    'trigger', 'update', 'cleanup',
  ]);

  const pathMutationSpy = jasmine.createSpyObj<PathMutationService>('PathMutationService', ['tickTurn']);

  const elevationSpy = jasmine.createSpyObj<ElevationService>('ElevationService', ['tickTurn']);

  const towerGraphSpy = jasmine.createSpyObj<TowerGraphService>('TowerGraphService', [
    'registerTower', 'unregisterTower', 'getNeighbors', 'getClusterTowers',
    'getClusterSize', 'isInStraightLineOf', 'severTower', 'tickTurn', 'setPlacedTowersGetter',
  ]);
  towerGraphSpy.getNeighbors.and.returnValue([]);
  towerGraphSpy.getClusterTowers.and.returnValue([]);
  towerGraphSpy.getClusterSize.and.returnValue(1);
  towerGraphSpy.isInStraightLineOf.and.returnValue(false);

  const damagePopupSpy = jasmine.createSpyObj<DamagePopupService>('DamagePopupService', [
    'spawn', 'accumulate', 'flush', 'flushOne', 'update', 'cleanup', 'clearAccumulators',
  ]);

  const settingsSpy = jasmine.createSpyObj<SettingsService>('SettingsService', ['get', 'update']);
  settingsSpy.get.and.returnValue({ colorblindAssist: false } as ReturnType<SettingsService['get']>);

  return [
    CombatLoopService,
    { provide: GameStateService, useValue: gameStateSpy },
    { provide: WaveService, useValue: waveSpy },
    { provide: TowerCombatService, useValue: combatSpy },
    { provide: EnemyService, useValue: enemySpy },
    { provide: GameStatsService, useValue: gameStatsSpy },
    { provide: GameEndService, useValue: gameEndSpy },
    { provide: StatusEffectService, useValue: statusEffectSpy },
    { provide: RelicService, useValue: resolvedRelicSpy },
    { provide: RunEventBusService, useValue: eventBusSpy },
    { provide: CardEffectService, useValue: resolvedCardSpy },
    { provide: GameNotificationService, useValue: notificationSpy },
    { provide: AudioService, useValue: audioSpy },
    { provide: ScreenShakeService, useValue: screenShakeSpy },
    { provide: PathMutationService, useValue: pathMutationSpy },
    { provide: ElevationService, useValue: elevationSpy },
    { provide: RunService, useValue: resolvedRunSpy },
    { provide: TowerGraphService, useValue: towerGraphSpy },
    { provide: DamagePopupService, useValue: damagePopupSpy },
    { provide: SettingsService, useValue: settingsSpy },
  ];
}
