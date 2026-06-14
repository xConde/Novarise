/**
 * EPILOGUE_COPY — debrief paragraphs shown on the victory epilogue screen.
 *
 * Each Act-3 boss preset has a distinct debrief flavour keyed by the preset's
 * `id` string. The fallback entry ('') is rendered when no preset id is
 * provided (e.g. a non-Act-3 victory, no id passed, or an unknown future id).
 *
 * Copy voice: military-industrial with sci-fi accents.
 * Line lengths are kept under 80 characters to fit the 38rem copy column.
 *
 * Keys match `BossPreset.id` from boss-presets.ts (ACT3_BOSS_PRESETS).
 */
export interface EpilogueCopy {
  /** Opening action paragraph. */
  readonly line1: string;
  /** Closing reflection paragraph. */
  readonly line2: string;
  /** Attribution byline shown in the debrief style. */
  readonly attribution: string;
}

export const EPILOGUE_COPY: Readonly<Record<string, EpilogueCopy>> = {
  /**
   * vanguard_convergence — elite-armor pressure route.
   * The Sovereign arrived escorted by Titans and Unshakeables; the debrief
   * reflects a hard-won attrition battle that finally broke their line.
   */
  vanguard_convergence: {
    line1:
      "The Sovereign's armored vanguard collapsed at 0417 hours. " +
      'Titan escorts neutralised. Uplink confirmed: Spire core intact.',
    line2:
      'They threw their heaviest units at us — Titans, Unshakeables, ' +
      'the works. None of it was enough. Engineers are pulling sensor ' +
      'data from the wreckage now. The line held.',
    attribution: '— Field Debrief, Armored-Threat Response Unit',
  },

  /**
   * celestial_deluge — air/swarm saturation route.
   * Waves of flying units and swarms tried to overwhelm coverage before
   * the Sovereign descended; the debrief reflects the sky-clearing victory.
   */
  celestial_deluge: {
    line1:
      'Air-superiority threat neutralised at 0339 hours. ' +
      'Swarm saturation broken. Sovereign signal lost. Spire uplink green.',
    line2:
      'They thought numbers would carry them. ' +
      'Every flyer they sent became scrap. ' +
      'When the Sovereign finally descended there was nothing left to ' +
      'shield it. The sky belongs to us tonight.',
    attribution: '— Field Debrief, Air-Defense Coordination Post',
  },

  /**
   * ironclad_march — armored frontal-pressure route.
   * Methodical shielded columns backed by Titans; debrief reflects a
   * grinding positional defense that finally stopped the march.
   */
  ironclad_march: {
    line1:
      'Ironclad column advance halted at 0502 hours. ' +
      'Final Titan element destroyed. Sovereign signal terminated.',
    line2:
      'They marched in formation expecting to walk through us. ' +
      'We made them pay for every meter. ' +
      'The Sovereign reached our line alone — and we were waiting. ' +
      'The march ends here.',
    attribution: '— Field Debrief, Forward Defensive Perimeter Alpha',
  },

  /**
   * Neutral / fallback — shown when no matching preset id is found.
   * Matches the original hard-coded debrief so the default experience is
   * unchanged when bossPresetId is empty or unknown.
   */
  '': {
    line1:
      'The Sovereign\'s siege lattice collapsed at 0300 hours. ' +
      'Uplink confirmed: the Spire\'s core transmitters are intact.',
    line2:
      'What they sent against us was their best — and it wasn\'t enough. ' +
      'The line held. Engineers are already pulling signal data from ' +
      'the wreckage. The war is not over, but tonight, the Spire endures.',
    attribution: '— Field Debrief, Relay Station Gamma-7',
  },
};

/**
 * Look up the epilogue copy for the given boss preset id.
 * Falls back to the neutral entry when the id is unknown or empty.
 */
export function getEpilogueCopy(bossPresetId: string): EpilogueCopy {
  return EPILOGUE_COPY[bossPresetId] ?? EPILOGUE_COPY[''];
}
