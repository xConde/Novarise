import { EnemyType } from './enemy.model';
import { WAVE_DEFINITIONS } from './wave.model';
import { ENDLESS_CONFIG } from './wave.model';

export interface WavePreviewEntry {
  type: EnemyType;
  count: number;
  label: string;
}

// Display labels for each enemy type — kept here so the preview model is self-contained
const ENEMY_TYPE_LABELS: Record<EnemyType, string> = {
  [EnemyType.BASIC]: 'Basic',
  [EnemyType.FAST]: 'Fast',
  [EnemyType.HEAVY]: 'Heavy',
  [EnemyType.SWIFT]: 'Swift',
  [EnemyType.BOSS]: 'Boss',
  [EnemyType.SHIELDED]: 'Shielded',
  [EnemyType.SWARM]: 'Swarm'
};

// Enemy types that cycle in endless waves — matches WaveService.ENDLESS_ENEMY_CYCLE
const ENDLESS_ENEMY_CYCLE: EnemyType[] = [
  EnemyType.BASIC,
  EnemyType.FAST,
  EnemyType.HEAVY,
  EnemyType.SWIFT,
  EnemyType.SHIELDED,
  EnemyType.SWARM
];

// Base count for endless wave generation — matches WaveService.ENDLESS_BASE_COUNT
const ENDLESS_PREVIEW_BASE_COUNT = 10;

/**
 * Returns a list of WavePreviewEntry objects for the given wave index (1-based).
 *
 * For non-endless waves (waveIndex <= WAVE_DEFINITIONS.length):
 *   reads directly from WAVE_DEFINITIONS[waveIndex - 1] and aggregates by type.
 *
 * For endless waves (isEndless === true && waveIndex > WAVE_DEFINITIONS.length):
 *   replicates the WaveService.generateEndlessWave composition logic to determine
 *   which types and how many will appear, without executing the actual spawn.
 *
 * Returns an empty array when waveIndex is out of range and isEndless is false.
 */
export function getWavePreview(waveIndex: number, isEndless: boolean): WavePreviewEntry[] {
  if (waveIndex <= 0) return [];

  const definitionIndex = waveIndex - 1;

  if (definitionIndex < WAVE_DEFINITIONS.length) {
    // Static wave definition — aggregate entries by type
    const wave = WAVE_DEFINITIONS[definitionIndex];
    const counts = new Map<EnemyType, number>();

    for (const entry of wave.entries) {
      counts.set(entry.type, (counts.get(entry.type) ?? 0) + entry.count);
    }

    return Array.from(counts.entries()).map(([type, count]) => ({
      type,
      count,
      label: ENEMY_TYPE_LABELS[type]
    }));
  }

  if (!isEndless) return [];

  // Endless wave — replicate the composition logic from WaveService.generateEndlessWave
  const countMult =
    ENDLESS_CONFIG.baseCountMultiplier +
    ENDLESS_CONFIG.countScalePerWave * (waveIndex - 1);

  const isBossWave = waveIndex % ENDLESS_CONFIG.bossInterval === 0;

  const cycleIndex = (waveIndex - 1) % ENDLESS_ENEMY_CYCLE.length;
  const primaryType = ENDLESS_ENEMY_CYCLE[cycleIndex];
  const secondaryType = ENDLESS_ENEMY_CYCLE[(cycleIndex + 1) % ENDLESS_ENEMY_CYCLE.length];

  const baseCount = Math.round(ENDLESS_PREVIEW_BASE_COUNT * countMult);
  const primaryCount = Math.ceil(baseCount * 0.6);
  const secondaryCount = Math.floor(baseCount * 0.4);

  const entries: WavePreviewEntry[] = [
    { type: primaryType, count: primaryCount, label: ENEMY_TYPE_LABELS[primaryType] },
    { type: secondaryType, count: secondaryCount, label: ENEMY_TYPE_LABELS[secondaryType] }
  ];

  if (isBossWave) {
    entries.unshift({ type: EnemyType.BOSS, count: 1, label: ENEMY_TYPE_LABELS[EnemyType.BOSS] });
  }

  return entries;
}
