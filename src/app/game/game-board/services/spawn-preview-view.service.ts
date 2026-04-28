import { Injectable } from '@angular/core';
import { GameState } from '../models/game-state.model';
import { WavePreviewEntry, getWavePreviewFull } from '../models/wave-preview.model';
import { WaveService } from './wave.service';

/**
 * SpawnPreviewViewService — view-state for the upcoming wave preview list
 * shown in the HUD during SETUP / INTERMISSION phases.
 *
 * Owns `entries` + `templateDescription`. Refresh is called from three
 * places in GameBoardComponent (and only those three):
 *   1. The state subscription, when entering a preview phase or the wave
 *      number changes.
 *   2. The fresh-encounter bootstrap, after setCustomWaves has applied.
 *   3. Step 18 of the checkpoint restore coordinator (after gameState
 *      restore has flipped phase to COMBAT/INTERMISSION).
 *
 * Component-scoped (provided in GameBoardComponent.providers). Must be
 * component-scoped because it injects the component-scoped WaveService.
 */
@Injectable()
export class SpawnPreviewViewService {
  private _entries: WavePreviewEntry[] = [];
  private _templateDescription: string | null = null;

  constructor(private waveService: WaveService) {}

  get entries(): WavePreviewEntry[] {
    return this._entries;
  }

  get templateDescription(): string | null {
    return this._templateDescription;
  }

  /**
   * Recompute preview for the wave that will start NEXT (i.e. state.wave + 1).
   * Pulls custom-wave overrides from the live WaveService.
   */
  refreshFor(state: GameState): void {
    const customDefs = this.waveService.hasCustomWaves()
      ? this.waveService.getWaveDefinitions()
      : undefined;
    const preview = getWavePreviewFull(state.wave + 1, state.isEndless, customDefs);
    this._entries = preview.entries;
    this._templateDescription = preview.templateDescription;
  }

  /** Reset to empty — useful for tests, not currently called by production code. */
  clear(): void {
    this._entries = [];
    this._templateDescription = null;
  }
}
