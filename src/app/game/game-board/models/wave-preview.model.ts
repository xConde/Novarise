import { EnemyType } from './enemy.model';
import { WAVE_DEFINITIONS } from './wave.model';
import { generateEndlessWave, ENDLESS_WAVE_TEMPLATES } from './endless-wave.model';

export interface WavePreviewEntry {
  type: EnemyType;
  count: number;
  label: string;
}

/** Optional description for the upcoming wave — set for endless waves only. */
export interface WavePreview {
  entries: WavePreviewEntry[];
  /** Short description of the wave type (e.g. "Rush — Fast enemies flood the field"). Null for scripted waves. */
  templateDescription: string | null;
}

// Display labels for each enemy type — kept here so the preview model is self-contained
const ENEMY_TYPE_LABELS: Record<EnemyType, string> = {
  [EnemyType.BASIC]: 'Basic',
  [EnemyType.FAST]: 'Fast',
  [EnemyType.HEAVY]: 'Heavy',
  [EnemyType.SWIFT]: 'Swift',
  [EnemyType.BOSS]: 'Boss',
  [EnemyType.SHIELDED]: 'Shielded',
  [EnemyType.SWARM]: 'Swarm',
  [EnemyType.FLYING]: 'Flying'
};

/**
 * Returns a list of WavePreviewEntry objects for the given wave index (1-based).
 *
 * For non-endless waves (waveIndex <= WAVE_DEFINITIONS.length):
 *   reads directly from WAVE_DEFINITIONS[waveIndex - 1] and aggregates by type.
 *
 * For endless waves (isEndless === true && waveIndex > WAVE_DEFINITIONS.length):
 *   uses generateEndlessWave() to produce the same composition that WaveService will spawn.
 *
 * Returns an empty array when waveIndex is out of range and isEndless is false.
 */
export function getWavePreview(waveIndex: number, isEndless: boolean): WavePreviewEntry[] {
  return getWavePreviewFull(waveIndex, isEndless).entries;
}

/**
 * Returns the full WavePreview (entries + templateDescription) for the given wave index (1-based).
 * Prefer this over getWavePreview() when the HUD needs to display the template name.
 */
export function getWavePreviewFull(waveIndex: number, isEndless: boolean): WavePreview {
  if (waveIndex <= 0) return { entries: [], templateDescription: null };

  const definitionIndex = waveIndex - 1;

  if (definitionIndex < WAVE_DEFINITIONS.length) {
    // Static wave definition — aggregate entries by type
    const wave = WAVE_DEFINITIONS[definitionIndex];
    const counts = new Map<EnemyType, number>();

    for (const entry of wave.entries) {
      counts.set(entry.type, (counts.get(entry.type) ?? 0) + entry.count);
    }

    const entries = Array.from(counts.entries()).map(([type, count]) => ({
      type,
      count,
      label: ENEMY_TYPE_LABELS[type]
    }));

    return { entries, templateDescription: null };
  }

  if (!isEndless) return { entries: [], templateDescription: null };

  // Endless wave — use the composition model directly (same logic as WaveService)
  const endlessWaveNumber = waveIndex - WAVE_DEFINITIONS.length;
  const result = generateEndlessWave(endlessWaveNumber);

  // Aggregate entries by type for display
  const counts = new Map<EnemyType, number>();
  for (const entry of result.entries) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + entry.count);
  }

  const entries = Array.from(counts.entries()).map(([type, count]) => ({
    type,
    count,
    label: ENEMY_TYPE_LABELS[type]
  }));

  const templateConfig = ENDLESS_WAVE_TEMPLATES[result.template];

  return { entries, templateDescription: templateConfig.description };
}
