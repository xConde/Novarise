import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { EpilogueCopy, getEpilogueCopy } from '../../constants/epilogue-copy.constants';

// ── Timing constants ──────────────────────────────────────────────────────────
/** Delay before the title stage becomes visible (ms). */
const TITLE_DELAY_MS = 200;
/** Delay before the epilogue copy becomes visible (ms). */
const COPY_DELAY_MS = 900;
/** Delay before the ascension-unlock line becomes visible (ms). */
const ASCENSION_DELAY_MS = 1600;
/** Delay before the Continue button becomes visible (ms). */
const BUTTON_DELAY_MS = 2200;

@Component({
  selector: 'app-run-epilogue',
  templateUrl: './run-epilogue.component.html',
  styleUrls: ['./run-epilogue.component.scss'],
})
export class RunEpilogueComponent implements OnInit, OnDestroy {
  /**
   * The ascension level just unlocked by this victory.
   * `advanceAct()` calls `setMaxAscension(ascensionLevel + 1)`, so the
   * newly-unlocked level is `runState.ascensionLevel + 1`. Pass 0 when no
   * new level was unlocked (e.g. the player was already at the cap).
   */
  @Input() unlockedAscensionLevel = 0;

  /**
   * The `BossPreset.id` of the Act-3 boss that was just defeated.
   * Selects the matching debrief variant from EPILOGUE_COPY.
   * Defaults to '' which renders the neutral fallback copy — preserving
   * the existing appearance when no preset id is supplied.
   *
   * CROSS-BATCH CONTRACT: Batch 4 binds [bossPresetId] from run state in
   * run.component.html. This component only reads it.
   */
  @Input() bossPresetId = '';

  /** Emitted when the player clicks Continue — parent transitions to 'summary'. */
  @Output() continued = new EventEmitter<void>();

  /** Per-stage visibility flags driven by setTimeout cascades in ngOnInit. */
  titleVisible = false;
  copyVisible = false;
  ascensionVisible = false;
  buttonVisible = false;

  /** Resolved debrief copy for the current bossPresetId. */
  epilogueCopy: EpilogueCopy = getEpilogueCopy('');

  private timeouts: ReturnType<typeof setTimeout>[] = [];

  ngOnInit(): void {
    this.epilogueCopy = getEpilogueCopy(this.bossPresetId);
    this.scheduleReveal();
  }

  get showAscensionLine(): boolean {
    return this.unlockedAscensionLevel > 0;
  }

  onContinue(): void {
    this.continued.emit();
  }

  private scheduleReveal(): void {
    this.timeouts.push(setTimeout(() => { this.titleVisible = true; }, TITLE_DELAY_MS));
    this.timeouts.push(setTimeout(() => { this.copyVisible = true; }, COPY_DELAY_MS));
    if (this.showAscensionLine) {
      this.timeouts.push(setTimeout(() => { this.ascensionVisible = true; }, ASCENSION_DELAY_MS));
    }
    this.timeouts.push(setTimeout(() => { this.buttonVisible = true; }, BUTTON_DELAY_MS));
  }

  ngOnDestroy(): void {
    for (const t of this.timeouts) {
      clearTimeout(t);
    }
  }
}
