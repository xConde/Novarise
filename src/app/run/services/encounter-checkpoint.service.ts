import { Injectable } from '@angular/core';
import {
  EncounterCheckpoint,
  CHECKPOINT_VERSION,
} from '../../game/game-board/models/encounter-checkpoint.model';

const CHECKPOINT_KEY = 'novarise_encounter_checkpoint';

@Injectable({ providedIn: 'root' })
export class EncounterCheckpointService {

  /** True if the last saveCheckpoint() call failed (quota exceeded). */
  lastSaveError = false;

  /** Migration functions from version N to N+1. */
  private readonly migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
    // Example for future: 1 → 2 migration
    // 1: (data) => { data['newField'] = 'default'; data['version'] = 2; return data; },
  };

  /**
   * Save a checkpoint to localStorage.
   * Returns true on success, false on quota exceeded or other error.
   * Sets lastSaveError to reflect the outcome.
   */
  saveCheckpoint(checkpoint: EncounterCheckpoint): boolean {
    try {
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
      this.lastSaveError = false;
      return true;
    } catch {
      this.lastSaveError = true;
      return false;
    }
  }

  /**
   * Load checkpoint from localStorage.
   * Applies version migrations if needed.
   * Returns null if no checkpoint, corrupt data, version too new, or invalid structure.
   */
  loadCheckpoint(): EncounterCheckpoint | null {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return null;
      let parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed['version'] !== 'number') return null;

      // Apply migrations if needed
      while ((parsed['version'] as number) < CHECKPOINT_VERSION) {
        const migrate = this.migrations[parsed['version'] as number];
        if (!migrate) {
          // No migration path — discard checkpoint
          this.clearCheckpoint();
          return null;
        }
        parsed = migrate(parsed);
      }

      if ((parsed['version'] as number) !== CHECKPOINT_VERSION) {
        this.clearCheckpoint();
        return null;
      }

      if (!this.isValidCheckpoint(parsed)) {
        this.clearCheckpoint();
        return null;
      }

      return parsed as unknown as EncounterCheckpoint;
    } catch {
      return null;
    }
  }

  /** Remove checkpoint from localStorage. */
  clearCheckpoint(): void {
    localStorage.removeItem(CHECKPOINT_KEY);
  }

  /** Check if a checkpoint exists. */
  hasCheckpoint(): boolean {
    return localStorage.getItem(CHECKPOINT_KEY) !== null;
  }

  /**
   * Quick peek at the checkpointed node ID without parsing the full object.
   * Returns null if no checkpoint or parse error.
   */
  getCheckpointNodeId(): string | null {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { nodeId?: string };
      return parsed?.nodeId ?? null;
    } catch {
      return null;
    }
  }

  private isValidCheckpoint(data: Record<string, unknown>): boolean {
    return (
      typeof data['version'] === 'number' &&
      typeof data['timestamp'] === 'number' &&
      typeof data['nodeId'] === 'string' &&
      data['encounterConfig'] !== null &&
      data['encounterConfig'] !== undefined &&
      data['gameState'] !== null &&
      data['gameState'] !== undefined
    );
  }
}
