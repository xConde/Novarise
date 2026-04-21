import { ARCHETYPE_DISPLAY } from './archetype.constants';
import { CardArchetype } from '../models/card.model';

describe('ARCHETYPE_DISPLAY', () => {
  const ALL_ARCHETYPES: CardArchetype[] = [
    'cartographer',
    'highground',
    'conduit',
    'siegeworks',
    'neutral',
  ];

  it('has a display entry for every CardArchetype', () => {
    for (const arch of ALL_ARCHETYPES) {
      expect(ARCHETYPE_DISPLAY[arch]).toBeDefined();
    }
  });

  it('every entry has a non-empty label', () => {
    for (const arch of ALL_ARCHETYPES) {
      expect(ARCHETYPE_DISPLAY[arch].label.length).toBeGreaterThan(0);
    }
  });

  it('labels are unique across all archetypes', () => {
    const labels = ALL_ARCHETYPES.map(a => ARCHETYPE_DISPLAY[a].label);
    expect(new Set(labels).size).toBe(ALL_ARCHETYPES.length);
  });

  it('colors are unique (no archetype visually collides)', () => {
    const colors = ALL_ARCHETYPES.map(a => ARCHETYPE_DISPLAY[a].color);
    expect(new Set(colors).size).toBe(ALL_ARCHETYPES.length);
  });

  it('every entry defines both color and accent', () => {
    for (const arch of ALL_ARCHETYPES) {
      expect(ARCHETYPE_DISPLAY[arch].color.length).toBeGreaterThan(0);
      expect(ARCHETYPE_DISPLAY[arch].accent.length).toBeGreaterThan(0);
    }
  });
});
