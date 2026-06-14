import { EPILOGUE_COPY, getEpilogueCopy, EpilogueCopy } from './epilogue-copy.constants';
import { ACT3_BOSS_PRESETS } from './boss-presets';

describe('EPILOGUE_COPY', () => {
  it('has a neutral fallback entry keyed by empty string', () => {
    expect(EPILOGUE_COPY['']).toBeDefined();
  });

  it('fallback entry has non-empty line1, line2, and attribution', () => {
    const entry = EPILOGUE_COPY[''];
    expect(entry.line1.length).toBeGreaterThan(0);
    expect(entry.line2.length).toBeGreaterThan(0);
    expect(entry.attribution.length).toBeGreaterThan(0);
  });

  it('has an entry for every Act-3 boss preset id', () => {
    for (const preset of ACT3_BOSS_PRESETS) {
      expect(EPILOGUE_COPY[preset.id])
        .withContext(`missing entry for preset id "${preset.id}"`)
        .toBeDefined();
    }
  });

  it('all entries have non-empty line1, line2, and attribution', () => {
    for (const [key, entry] of Object.entries(EPILOGUE_COPY) as [string, EpilogueCopy][]) {
      expect(entry.line1.length)
        .withContext(`line1 empty for key "${key}"`)
        .toBeGreaterThan(0);
      expect(entry.line2.length)
        .withContext(`line2 empty for key "${key}"`)
        .toBeGreaterThan(0);
      expect(entry.attribution.length)
        .withContext(`attribution empty for key "${key}"`)
        .toBeGreaterThan(0);
    }
  });

  describe('getEpilogueCopy()', () => {
    it('returns the matching entry for a known preset id', () => {
      const result = getEpilogueCopy('vanguard_convergence');
      expect(result).toBe(EPILOGUE_COPY['vanguard_convergence']);
    });

    it('returns the fallback for an unknown id', () => {
      const result = getEpilogueCopy('unknown_boss_id_xyz');
      expect(result).toBe(EPILOGUE_COPY['']);
    });

    it('returns the fallback for an empty string', () => {
      const result = getEpilogueCopy('');
      expect(result).toBe(EPILOGUE_COPY['']);
    });

    it('fallback copy references the Nova Sovereign narrative (default experience)', () => {
      const result = getEpilogueCopy('');
      // The fallback is the original hard-coded debrief — ensure it references
      // the Sovereign so the default experience is unchanged.
      expect(result.line1).toContain('Sovereign');
    });

    it('vanguard_convergence copy references armored/Titan narrative', () => {
      const result = getEpilogueCopy('vanguard_convergence');
      const combined = `${result.line1} ${result.line2}`;
      expect(combined.toLowerCase()).toContain('titan');
    });

    it('celestial_deluge copy references aerial/flying narrative', () => {
      const result = getEpilogueCopy('celestial_deluge');
      const combined = `${result.line1} ${result.line2}`;
      // Copy references flyers / air threat
      expect(combined.toLowerCase()).toMatch(/fly|air|sky/);
    });

    it('ironclad_march copy references march/armored narrative', () => {
      const result = getEpilogueCopy('ironclad_march');
      const combined = `${result.line1} ${result.line2}`;
      expect(combined.toLowerCase()).toContain('march');
    });

    it('returns distinct copy for each Act-3 preset', () => {
      const ids = ACT3_BOSS_PRESETS.map(p => p.id);
      const copies = ids.map(id => getEpilogueCopy(id).line1);
      // Each preset should have a unique opening line
      const unique = new Set(copies);
      expect(unique.size).toBe(ids.length);
    });
  });
});
