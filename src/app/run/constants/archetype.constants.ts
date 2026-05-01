import { CardArchetype } from '../models/card.model';

/**
 * Display metadata for a spatial archetype. Drives the reward-screen
 * "Deck leaning:" chip and any future archetype-aware UI surface.
 *
 * Keep labels human-readable (Title Case). Colors must stay visually
 * distinct — the chip is the only place players perceive the silent
 * 60/40 archetype-aware reward weighting firing (Phase 1 Sprint 8).
 *
 * trimVar / trimVarStrong are CSS custom property NAMES, not values.
 * Components bind them via [style.--some-var]="trimVar" and the browser
 * resolves the value from :root at render time. This decouples color
 * tuning from component code.
 */
export interface ArchetypeDisplay {
  /** Title-cased label shown in the chip. */
  readonly label: string;
  /** Primary text color for the chip label. */
  readonly color: string;
  /** Soft border/background accent — typically a translucent `color`. */
  readonly accent: string;
  /** CSS custom property name for the archetype trim outline (e.g. '--card-trim-cartographer'). */
  readonly trimVar: string;
  /** CSS custom property name for the trim at hover/selected state. */
  readonly trimVarStrong: string;
}

export const ARCHETYPE_DISPLAY: Record<CardArchetype, ArchetypeDisplay> = {
  cartographer: {
    label: 'Cartographer',
    color: '#e8c06b',
    accent: 'rgba(232, 192, 107, 0.35)',
    trimVar: '--card-trim-cartographer',
    trimVarStrong: '--card-trim-cartographer-strong',
  },
  highground: {
    label: 'Highground',
    color: '#7cc7f5',
    accent: 'rgba(124, 199, 245, 0.35)',
    trimVar: '--card-trim-highground',
    trimVarStrong: '--card-trim-highground-strong',
  },
  conduit: {
    label: 'Conduit',
    color: '#c98cf0',
    accent: 'rgba(201, 140, 240, 0.35)',
    trimVar: '--card-trim-conduit',
    trimVarStrong: '--card-trim-conduit-strong',
  },
  siegeworks: {
    label: 'Siegeworks',
    color: '#f05c5c',
    accent: 'rgba(240, 92, 92, 0.35)',
    trimVar: '--card-trim-siegeworks',
    trimVarStrong: '--card-trim-siegeworks-strong',
  },
  neutral: {
    label: 'Neutral',
    color: 'rgba(255, 255, 255, 0.75)',
    accent: 'rgba(255, 255, 255, 0.2)',
    trimVar: '--card-trim-neutral',
    trimVarStrong: '--card-trim-neutral-strong',
  },
};

/**
 * Returns the CSS custom property name for an archetype's trim color.
 * Falls back to neutral so unknown/future archetypes don't break the UI.
 */
export function getArchetypeTrimVar(archetype: CardArchetype): string {
  return ARCHETYPE_DISPLAY[archetype]?.trimVar ?? '--card-trim-neutral';
}
