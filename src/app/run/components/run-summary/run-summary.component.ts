import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RunState, RunStatus, EncounterResult } from '../../models/run-state.model';
import { RelicDefinition, RELIC_DEFINITIONS, RelicId } from '../../models/relic.model';

/** Duration of a run in minutes and seconds, computed from startedAt to now. */
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1_000;

@Component({
  selector: 'app-run-summary',
  templateUrl: './run-summary.component.html',
  styleUrls: ['./run-summary.component.scss'],
})
export class RunSummaryComponent {
  @Input() runState!: RunState;
  @Output() returnToMenu = new EventEmitter<void>();
  @Output() startNewRun = new EventEmitter<void>();

  get isVictory(): boolean {
    return this.runState.status === RunStatus.VICTORY;
  }

  get totalKills(): number {
    return this.runState.encounterResults.reduce((s, r) => s + r.enemiesKilled, 0);
  }

  get totalGoldEarned(): number {
    return this.runState.encounterResults.reduce((s, r) => s + r.goldEarned, 0);
  }

  get encountersCompleted(): number {
    return this.runState.encounterResults.filter((r: EncounterResult) => r.victory).length;
  }

  get totalEncounters(): number {
    return this.runState.encounterResults.length;
  }

  get relicDefinitions(): RelicDefinition[] {
    return this.runState.relicIds
      .map(id => RELIC_DEFINITIONS[id as RelicId])
      .filter((r): r is RelicDefinition => r !== undefined);
  }

  get ascensionLabel(): string {
    return this.runState.ascensionLevel > 0
      ? `Ascension ${this.runState.ascensionLevel}`
      : '';
  }

  get runDuration(): string {
    const ms = Date.now() - this.runState.startedAt;
    const mins = Math.floor(ms / MS_PER_MINUTE);
    const secs = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND);
    return `${mins}m ${secs}s`;
  }

  get actsReached(): number {
    return this.runState.actIndex + 1;
  }

  onReturnToMenu(): void {
    this.returnToMenu.emit();
  }

  onStartNewRun(): void {
    this.startNewRun.emit();
  }
}
