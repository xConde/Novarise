import { Injectable } from '@angular/core';
import { RunState, RunStatus } from '../models/run-state.model';
import { NodeMap } from '../models/node-map.model';
import { MAX_ASCENSION_LEVEL } from '../models/ascension.model';
import { CardType } from '../models/card.model';
import { getCardDefinition } from '../constants/card-definitions';

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
      // Production starter deck always includes tower cards; a saved run with
      // zero tower cards is a corrupt state (left behind by smoke-test deck
      // overrides during the card-branding glyph review). Reset rather than
      // restore — the player gets a fresh run with the correct deck.
      if (!hasAnyTowerCard(state.deckCardIds)) {
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

  /** Record a new ascension high-water mark. Caps at MAX_ASCENSION_LEVEL. */
  setMaxAscension(level: number): void {
    const clamped = Math.min(level, MAX_ASCENSION_LEVEL);
    const current = this.getMaxAscension();
    if (clamped > current) {
      localStorage.setItem(MAX_ASCENSION_KEY, String(clamped));
    }
  }

  /** Returns true when the player has beaten A20 (full mastery). */
  isAscensionMastered(): boolean {
    return this.getMaxAscension() >= MAX_ASCENSION_LEVEL;
  }
}

/**
 * Returns true when the saved deck contains at least one tower card. Used as
 * a corruption guard — the production starter deck always has 16 tower cards,
 * so a deck with zero towers can only have come from a development-time
 * override (see the glyph-review smoke override that landed pre-merge in
 * `feat/card-branding`). Defends against any future override that ships
 * without a clean revert as well.
 */
function hasAnyTowerCard(deckCardIds: ReadonlyArray<unknown>): boolean {
  if (!Array.isArray(deckCardIds) || deckCardIds.length === 0) return false;
  for (const id of deckCardIds) {
    if (typeof id !== 'string') continue;
    try {
      const def = getCardDefinition(id as Parameters<typeof getCardDefinition>[0]);
      if (def?.type === CardType.TOWER) return true;
    } catch {
      // Unknown card id (deleted from registry) — keep scanning.
    }
  }
  return false;
}
