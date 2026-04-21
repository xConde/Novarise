import { CardArchetype } from '../models/card.model';

/**
 * Display metadata for a spatial archetype. Drives the reward-screen
 * "Deck leaning:" chip and any future archetype-aware UI surface.
 *
 * Keep labels human-readable (Title Case). Colors must stay visually
 * distinct — the chip is the only place players perceive the silent
 * 60/40 archetype-aware reward weighting firing (Phase 1 Sprint 8).
 */
export interface ArchetypeDisplay {
  /** Title-cased label shown in the chip. */
  readonly label: string;
  /** Primary text color for the chip label. */
  readonly color: string;
  /** Soft border/background accent — typically a translucent `color`. */
  readonly accent: string;
}

export const ARCHETYPE_DISPLAY: Record<CardArchetype, ArchetypeDisplay> = {
  cartographer: {
    label: 'Cartographer',
    color: '#e8c06b',
    accent: 'rgba(232, 192, 107, 0.35)',
  },
  highground: {
    label: 'Highground',
    color: '#7cc7f5',
    accent: 'rgba(124, 199, 245, 0.35)',
  },
  conduit: {
    label: 'Conduit',
    color: '#c98cf0',
    accent: 'rgba(201, 140, 240, 0.35)',
  },
  siegeworks: {
    label: 'Siegeworks',
    color: '#f05c5c',
    accent: 'rgba(240, 92, 92, 0.35)',
  },
  neutral: {
    label: 'Neutral',
    color: 'rgba(255, 255, 255, 0.75)',
    accent: 'rgba(255, 255, 255, 0.2)',
  },
};
