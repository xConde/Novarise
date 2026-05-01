import { KEYWORD_ICON_PATHS, KeywordIconName } from './keyword-icon-paths';

describe('KEYWORD_ICON_PATHS', () => {
  const KEYWORDS: KeywordIconName[] = ['terraform', 'link', 'exhaust', 'retain', 'innate', 'ethereal'];

  it('contains all 6 required keyword entries', () => {
    expect(Object.keys(KEYWORD_ICON_PATHS).length).toBe(6);
    for (const keyword of KEYWORDS) {
      expect(KEYWORD_ICON_PATHS[keyword]).toBeDefined();
    }
  });

  describe('each keyword entry', () => {
    KEYWORDS.forEach((keyword) => {
      describe(keyword, () => {
        it('has viewBox "0 0 24 24"', () => {
          expect(KEYWORD_ICON_PATHS[keyword].viewBox).toBe('0 0 24 24');
        });

        it('has between 1 and 3 path elements', () => {
          const count = KEYWORD_ICON_PATHS[keyword].paths.length;
          expect(count).toBeGreaterThanOrEqual(1);
          expect(count).toBeLessThanOrEqual(3);
        });

        it('has no empty paths array', () => {
          expect(KEYWORD_ICON_PATHS[keyword].paths.length).toBeGreaterThan(0);
        });

        it('each path element has a tag and attrs', () => {
          for (const path of KEYWORD_ICON_PATHS[keyword].paths) {
            expect(path.tag).toBeTruthy();
            expect(path.attrs).toBeDefined();
          }
        });
      });
    });
  });
});
