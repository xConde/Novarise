import { Injectable } from '@angular/core';
import { RunState, RunStatus } from '../models/run-state.model';
import { NodeMap } from '../models/node-map.model';

/**
 * Persists and restores run state to/from localStorage.
 * Enables resume-run across browser sessions.
 */

const RUN_STATE_KEY = 'novarise_run_state';
const NODE_MAP_KEY = 'novarise_run_map';
const MAX_ASCENSION_KEY = 'novarise_run_max_ascension';

@Injectable({ providedIn: 'root' })
export class RunPersistenceService {

  /** Save current run state to localStorage. */
  saveRunState(state: RunState, nodeMap: NodeMap): void {
    try {
      localStorage.setItem(RUN_STATE_KEY, JSON.stringify(state));
      localStorage.setItem(NODE_MAP_KEY, JSON.stringify(nodeMap));
    } catch {
      // Quota exceeded — fail silently. Run state is ephemeral.
    }
  }

  /** Load saved run state. Returns null if no save exists or save is corrupt. */
  loadRunState(): RunState | null {
    try {
      const raw = localStorage.getItem(RUN_STATE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as RunState;
      // Only restore in-progress runs
      if (state.status !== RunStatus.IN_PROGRESS) {
        this.clearSavedRun();
        return null;
      }
      return state;
    } catch {
      this.clearSavedRun();
      return null;
    }
  }

  /** Load saved node map. */
  loadNodeMap(): NodeMap | null {
    try {
      const raw = localStorage.getItem(NODE_MAP_KEY);
      return raw ? JSON.parse(raw) as NodeMap : null;
    } catch {
      return null;
    }
  }

  /**
   * Load saved run state for preview purposes (does NOT clear corrupt saves).
   * Used by the start screen to show resume-run details.
   */
  loadSavedRunPreview(): RunState | null {
    return this.loadRunState();
  }

  /** Check if a saved run exists. */
  hasSavedRun(): boolean {
    return localStorage.getItem(RUN_STATE_KEY) !== null;
  }

  /** Clear saved run state. */
  clearSavedRun(): void {
    localStorage.removeItem(RUN_STATE_KEY);
    localStorage.removeItem(NODE_MAP_KEY);
  }

  /** Get/set highest ascension level beaten. */
  getMaxAscension(): number {
    const raw = localStorage.getItem(MAX_ASCENSION_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  }

  setMaxAscension(level: number): void {
    const current = this.getMaxAscension();
    if (level > current) {
      localStorage.setItem(MAX_ASCENSION_KEY, String(level));
    }
  }
}
