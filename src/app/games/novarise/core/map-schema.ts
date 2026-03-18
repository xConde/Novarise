/** Current schema version. Increment when TerrainGridState shape changes. */
export const CURRENT_SCHEMA_VERSION = 2;

/** Minimum schema version we can migrate from. */
export const MIN_SUPPORTED_VERSION = 1;

/**
 * Migration function: takes data of version N and returns data of version N+1.
 * Returns null if migration fails.
 */
export type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown> | null;

/**
 * Ordered migrations. Index 0 migrates v1→v2, index 1 would migrate v2→v3, etc.
 * Each function receives the raw parsed JSON and returns the migrated version.
 */
export const MIGRATIONS: MigrationFn[] = [
  // v1 → v2: spawnPoint/exitPoint → spawnPoints/exitPoints arrays
  (data: Record<string, unknown>) => {
    const legacy = data as Record<string, unknown>;
    if (legacy['spawnPoint'] && !legacy['spawnPoints']) {
      legacy['spawnPoints'] = [legacy['spawnPoint']];
      delete legacy['spawnPoint'];
    }
    if (legacy['exitPoint'] && !legacy['exitPoints']) {
      legacy['exitPoints'] = [legacy['exitPoint']];
      delete legacy['exitPoint'];
    }
    legacy['version'] = '2.0.0';
    return legacy;
  },
];

/**
 * Determine the schema version of raw map data.
 * - Has schemaVersion field → use that
 * - Has spawnPoint (singular) → v1
 * - Has spawnPoints (plural) → v2
 * - Otherwise → v1 (best guess for very old data)
 */
export function detectSchemaVersion(data: Record<string, unknown>): number {
  if (typeof data['schemaVersion'] === 'number') return data['schemaVersion'];
  if (data['spawnPoints'] && Array.isArray(data['spawnPoints'])) return 2;
  if (data['spawnPoint']) return 1;
  return 1; // fallback for unversioned data
}

/**
 * Run migration chain from detected version to current.
 * Returns the migrated data with schemaVersion stamped, or null on failure.
 */
export function migrateMap(raw: Record<string, unknown>): Record<string, unknown> | null {
  let version = detectSchemaVersion(raw);

  if (version < MIN_SUPPORTED_VERSION) {
    console.warn(`Map schema version ${version} is below minimum supported (${MIN_SUPPORTED_VERSION})`);
    return null;
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    console.warn(`Map schema version ${version} is newer than current (${CURRENT_SCHEMA_VERSION}) — cannot load`);
    return null;
  }

  let data = { ...raw };
  while (version < CURRENT_SCHEMA_VERSION) {
    const migrationIndex = version - 1; // v1→v2 is index 0
    if (migrationIndex >= MIGRATIONS.length) {
      console.warn(`Missing migration for v${version} → v${version + 1}`);
      return null;
    }
    const result = MIGRATIONS[migrationIndex](data);
    if (!result) {
      console.warn(`Migration v${version} → v${version + 1} failed`);
      return null;
    }
    data = result;
    version++;
  }

  data['schemaVersion'] = CURRENT_SCHEMA_VERSION;
  return data;
}

export interface MapValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single spawn/exit point: must be an object with numeric x and z
 * within [0, gridSize). Returns an error string or null if valid.
 */
function validatePoint(point: unknown, fieldName: string, index: number, gridSize: number): string | null {
  if (!point || typeof point !== 'object') {
    return `${fieldName}[${index}] is not an object`;
  }
  const p = point as Record<string, unknown>;
  if (typeof p['x'] !== 'number' || typeof p['z'] !== 'number') {
    return `${fieldName}[${index}] missing numeric x/z fields`;
  }
  const x = p['x'] as number;
  const z = p['z'] as number;
  if (gridSize > 0 && (x < 0 || x >= gridSize || z < 0 || z >= gridSize)) {
    return `${fieldName}[${index}] coordinates (${x},${z}) out of bounds for gridSize ${gridSize}`;
  }
  if (!Number.isInteger(x) || !Number.isInteger(z)) {
    return `${fieldName}[${index}] coordinates must be integers`;
  }
  return null;
}

export function validateMapData(data: unknown): MapValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Map data is not an object'], warnings: [] };
  }

  const d = data as Record<string, unknown>;

  // Required fields
  if (typeof d['gridSize'] !== 'number' || d['gridSize'] < 5 || d['gridSize'] > 50) {
    errors.push(`Invalid gridSize: ${d['gridSize']} (must be 5-50)`);
  }

  if (!Array.isArray(d['tiles'])) {
    errors.push('Missing or invalid tiles array');
  } else {
    const tiles = d['tiles'] as unknown[][];
    if (tiles.length > 0 && !Array.isArray(tiles[0])) {
      errors.push('Tiles must be a 2D array');
    }
  }

  if (!Array.isArray(d['heightMap'])) {
    errors.push('Missing or invalid heightMap array');
  }

  const gridSize = typeof d['gridSize'] === 'number' ? d['gridSize'] : 0;

  if (!Array.isArray(d['spawnPoints']) || (d['spawnPoints'] as unknown[]).length === 0) {
    errors.push('Must have at least one spawn point');
  } else {
    const points = d['spawnPoints'] as unknown[];
    for (let i = 0; i < points.length; i++) {
      const pointError = validatePoint(points[i], 'spawnPoints', i, gridSize);
      if (pointError) errors.push(pointError);
    }
  }

  if (!Array.isArray(d['exitPoints']) || (d['exitPoints'] as unknown[]).length === 0) {
    errors.push('Must have at least one exit point');
  } else {
    const points = d['exitPoints'] as unknown[];
    for (let i = 0; i < points.length; i++) {
      const pointError = validatePoint(points[i], 'exitPoints', i, gridSize);
      if (pointError) errors.push(pointError);
    }
  }

  // Warnings (non-blocking)
  if (typeof d['version'] !== 'string') {
    warnings.push('Missing version string — will be set to current');
  }

  return { valid: errors.length === 0, errors, warnings };
}
