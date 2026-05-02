import { EFFECT_ICON_PATHS, EffectIconName } from './effect-icon-paths';

describe('EFFECT_ICON_PATHS', () => {
  const EFFECTS: EffectIconName[] = [
    'damage', 'burn', 'poison', 'slow', 'heal', 'gold',
    'draw', 'energy', 'buff', 'scout', 'recycle',
  ];

  it('contains all 11 required effect entries', () => {
    expect(Object.keys(EFFECT_ICON_PATHS).length).toBe(11);
    for (const fx of EFFECTS) {
      expect(EFFECT_ICON_PATHS[fx]).toBeDefined();
    }
  });

  describe('each effect entry', () => {
    EFFECTS.forEach((fx) => {
      describe(fx, () => {
        it('uses viewBox "0 0 24 24"', () => {
          expect(EFFECT_ICON_PATHS[fx].viewBox).toBe('0 0 24 24');
        });

        it('has between 1 and 5 path elements', () => {
          const count = EFFECT_ICON_PATHS[fx].paths.length;
          expect(count).toBeGreaterThanOrEqual(1);
          expect(count).toBeLessThanOrEqual(5);
        });

        it('declares a tag and attrs on every path element', () => {
          for (const path of EFFECT_ICON_PATHS[fx].paths) {
            expect(path.tag).toBeTruthy();
            expect(path.attrs).toBeDefined();
          }
        });
      });
    });
  });
});
