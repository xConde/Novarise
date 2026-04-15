import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { LastTurnSummaryComponent } from './last-turn-summary.component';
import { TurnEventRecord } from '../../services/turn-history.service';
import { TowerType } from '../../models/tower.model';

function makeRecord(overrides: Partial<TurnEventRecord> = {}): TurnEventRecord {
  return {
    turnNumber: 1,
    cardsPlayed: 0,
    kills: 0,
    damageDealt: 0,
    killsByTower: [],
    goldEarned: 0,
    livesLost: 0,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('LastTurnSummaryComponent', () => {
  let fixture: ComponentFixture<LastTurnSummaryComponent>;
  let component: LastTurnSummaryComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LastTurnSummaryComponent],
      imports: [CommonModule],
    });
    fixture = TestBed.createComponent(LastTurnSummaryComponent);
    component = fixture.componentInstance;
  });

  it('creates', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ── Empty / visibility ────────────────────────────────────────────────

  describe('empty state', () => {
    it('hasRecords is false and isEmpty is true when records is empty', () => {
      component.records = [];
      fixture.detectChanges();
      expect(component.hasRecords).toBeFalse();
      expect(component.isEmpty).toBeTrue();
    });

    it('host receives the last-turn-summary--empty class when no records', () => {
      component.records = [];
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList.contains('last-turn-summary--empty')).toBeTrue();
    });

    it('host does NOT receive the empty class once a record is present', () => {
      component.records = [makeRecord({ turnNumber: 1, kills: 2 })];
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.classList.contains('last-turn-summary--empty')).toBeFalse();
    });

    it('renders no <aside> when records is empty', () => {
      component.records = [];
      fixture.detectChanges();
      const aside = (fixture.nativeElement as HTMLElement).querySelector('aside.last-turn-summary');
      expect(aside).toBeNull();
    });
  });

  // ── displayRows ordering + cap ────────────────────────────────────────

  describe('displayRows', () => {
    it('returns records newest-first', () => {
      component.records = [
        makeRecord({ turnNumber: 1 }),
        makeRecord({ turnNumber: 2 }),
        makeRecord({ turnNumber: 3 }),
      ];
      const rows = component.displayRows;
      expect(rows.map(r => r.turnNumber)).toEqual([3, 2, 1]);
    });

    it('caps at 3 rows regardless of how many records are in the buffer', () => {
      component.records = [
        makeRecord({ turnNumber: 1 }),
        makeRecord({ turnNumber: 2 }),
        makeRecord({ turnNumber: 3 }),
        makeRecord({ turnNumber: 4 }),
        makeRecord({ turnNumber: 5 }),
      ];
      const rows = component.displayRows;
      expect(rows.length).toBe(3);
      expect(rows.map(r => r.turnNumber)).toEqual([5, 4, 3]);
    });

    it('returns fewer than 3 rows when the buffer has fewer records', () => {
      component.records = [makeRecord({ turnNumber: 7 })];
      expect(component.displayRows.length).toBe(1);
      expect(component.displayRows[0].turnNumber).toBe(7);
    });

    it('does not mutate the input records array', () => {
      const input: TurnEventRecord[] = [
        makeRecord({ turnNumber: 1 }),
        makeRecord({ turnNumber: 2 }),
      ];
      component.records = input;
      component.displayRows;
      // Original array order preserved — component reverses via a copy.
      expect(input.map(r => r.turnNumber)).toEqual([1, 2]);
    });
  });

  // ── isQuietTurn ───────────────────────────────────────────────────────

  describe('isQuietTurn', () => {
    it('returns true when all stats are zero', () => {
      expect(component.isQuietTurn(makeRecord({ turnNumber: 3 }))).toBeTrue();
    });

    it('returns false when any stat is non-zero', () => {
      expect(component.isQuietTurn(makeRecord({ kills: 1 }))).toBeFalse();
      expect(component.isQuietTurn(makeRecord({ cardsPlayed: 2 }))).toBeFalse();
      expect(component.isQuietTurn(makeRecord({ goldEarned: 10 }))).toBeFalse();
      expect(component.isQuietTurn(makeRecord({ livesLost: 1 }))).toBeFalse();
    });
  });

  // ── Row rendering ─────────────────────────────────────────────────────

  describe('row rendering', () => {
    it('renders one <li> per display row', () => {
      component.records = [
        makeRecord({ turnNumber: 1, kills: 1 }),
        makeRecord({ turnNumber: 2, kills: 2 }),
      ];
      fixture.detectChanges();
      const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('li.last-turn-summary__row');
      expect(rows.length).toBe(2);
    });

    it('tags the most-recent row with the --recent class', () => {
      component.records = [
        makeRecord({ turnNumber: 1, kills: 1 }),
        makeRecord({ turnNumber: 2, kills: 2 }),
      ];
      fixture.detectChanges();
      const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('li.last-turn-summary__row');
      expect(rows[0].classList.contains('last-turn-summary__row--recent')).toBeTrue();
      expect(rows[1].classList.contains('last-turn-summary__row--recent')).toBeFalse();
    });

    it('renders a quiet turn with the — placeholder, no stats', () => {
      component.records = [makeRecord({ turnNumber: 4 })];
      fixture.detectChanges();

      const row = (fixture.nativeElement as HTMLElement).querySelector('.last-turn-summary__row')!;
      expect(row.classList.contains('last-turn-summary__row--quiet')).toBeTrue();
      expect(row.querySelector('.last-turn-summary__quiet')).not.toBeNull();
      expect(row.querySelector('.last-turn-summary__stats')).toBeNull();
    });

    it('renders gold earned with the --gold variant', () => {
      component.records = [makeRecord({ turnNumber: 2, goldEarned: 30 })];
      fixture.detectChanges();
      const gold = (fixture.nativeElement as HTMLElement).querySelector('.last-turn-summary__stat--gold');
      expect(gold).not.toBeNull();
      expect(gold!.textContent).toContain('+30g');
    });

    it('renders lives lost with the --danger variant', () => {
      component.records = [makeRecord({ turnNumber: 2, livesLost: 2 })];
      fixture.detectChanges();
      const danger = (fixture.nativeElement as HTMLElement).querySelector('.last-turn-summary__stat--danger');
      expect(danger).not.toBeNull();
      expect(danger!.textContent).toContain('2');
    });

    it('renders cardsPlayed + kills on a non-quiet row', () => {
      component.records = [makeRecord({ turnNumber: 3, cardsPlayed: 2, kills: 5 })];
      fixture.detectChanges();
      const stats = (fixture.nativeElement as HTMLElement).querySelector('.last-turn-summary__stats')!;
      expect(stats.textContent).toMatch(/2/);
      expect(stats.textContent).toMatch(/5/);
    });
  });

  // ── Phase 16: damage + kill attribution + expand ────────────────────

  describe('damage rendering', () => {
    it('shows damage-only turns (hits but no kill) as non-quiet', () => {
      component.records = [makeRecord({ turnNumber: 4, damageDealt: 45 })];
      fixture.detectChanges();

      const row = (fixture.nativeElement as HTMLElement).querySelector('.last-turn-summary__row')!;
      expect(row.classList.contains('last-turn-summary__row--quiet')).toBeFalse();
      const stats = row.querySelector('.last-turn-summary__stats')!;
      expect(stats.textContent).toContain('45');
    });

    it('renders all stats in the required order: gold, damage, kills, lives', () => {
      component.records = [makeRecord({
        turnNumber: 5,
        goldEarned: 30,
        damageDealt: 75,
        kills: 2,
        livesLost: 1,
        killsByTower: [{ type: TowerType.BASIC, level: 1, count: 2 }],
      })];
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement)
        .querySelector('.last-turn-summary__stats')!
        .textContent!
        .replace(/\s+/g, ' ');
      const goldIdx = text.indexOf('+30g');
      const dmgIdx = text.indexOf('75');
      const killIdx = text.indexOf('2k');
      const lifeIdx = text.indexOf('−1');
      expect(goldIdx).toBeGreaterThanOrEqual(0);
      expect(dmgIdx).toBeGreaterThan(goldIdx);
      expect(killIdx).toBeGreaterThan(dmgIdx);
      expect(lifeIdx).toBeGreaterThan(killIdx);
    });

    it('skips zero stats and their separators', () => {
      component.records = [makeRecord({ turnNumber: 3, damageDealt: 20 })]; // damage only
      fixture.detectChanges();
      const seps = (fixture.nativeElement as HTMLElement)
        .querySelectorAll('.last-turn-summary__sep');
      // No separator pipes when there's only one stat
      expect(seps.length).toBe(0);
    });
  });

  describe('kill attribution', () => {
    it('returns entries sorted by count desc', () => {
      const row = makeRecord({
        turnNumber: 6,
        kills: 4,
        killsByTower: [
          { type: TowerType.BASIC, level: 1, count: 1 },
          { type: TowerType.MORTAR, level: 1, count: 2 },
          { type: TowerType.CHAIN, level: 1, count: 1 },
        ],
      });
      const entries = component.killAttribution(row);
      expect(entries[0].key).toBe(TowerType.MORTAR);
      expect(entries[0].count).toBe(2);
      expect(entries.map(e => e.count)).toEqual([2, 1, 1]);
    });

    it('omits the tier suffix for tier-1 kills (design: T1 gets nothing special)', () => {
      const row = makeRecord({
        turnNumber: 3,
        kills: 1,
        killsByTower: [{ type: TowerType.BASIC, level: 1, count: 1 }],
      });
      const entry = component.killAttribution(row)[0];
      expect(entry.shortLabel).toBe('B');
      expect(entry.fullLabel).toBe('Basic');
    });

    it('appends the tier number for tier-2 kills', () => {
      const row = makeRecord({
        turnNumber: 3,
        kills: 1,
        killsByTower: [{ type: TowerType.SNIPER, level: 2, count: 1 }],
      });
      const entry = component.killAttribution(row)[0];
      expect(entry.shortLabel).toBe('Sn2');
      expect(entry.fullLabel).toBe('Sniper Tier 2');
    });

    it('appends the tier number for tier-3 kills', () => {
      const row = makeRecord({
        turnNumber: 3,
        kills: 1,
        killsByTower: [{ type: TowerType.MORTAR, level: 3, count: 1 }],
      });
      const entry = component.killAttribution(row)[0];
      expect(entry.shortLabel).toBe('M3');
    });

    it('buckets the same tower at different levels separately', () => {
      const row = makeRecord({
        turnNumber: 5,
        kills: 3,
        killsByTower: [
          { type: TowerType.BASIC, level: 1, count: 1 },
          { type: TowerType.BASIC, level: 2, count: 2 },
        ],
      });
      const entries = component.killAttribution(row);
      expect(entries.length).toBe(2);
      // Sort is by count desc — tier-2 with 2 kills leads tier-1 with 1.
      expect(entries[0]).toEqual(jasmine.objectContaining({
        shortLabel: 'B2', count: 2,
      }));
      expect(entries[1]).toEqual(jasmine.objectContaining({
        shortLabel: 'B', count: 1,
      }));
    });

    it('labels the dot bucket as "DoT" with no tier suffix', () => {
      const row = makeRecord({
        turnNumber: 1,
        kills: 1,
        killsByTower: [{ type: 'dot', level: 0, count: 1 }],
      });
      const entry = component.killAttribution(row)[0];
      expect(entry.shortLabel).toBe('DoT');
      expect(entry.fullLabel).toBe('DoT');
    });

    it('returns empty array when no kills attributed', () => {
      expect(component.killAttribution(makeRecord({ turnNumber: 2 }))).toEqual([]);
    });
  });

  describe('expand / collapse', () => {
    function primeExpandable(): TurnEventRecord {
      const r = makeRecord({
        turnNumber: 9,
        kills: 2,
        damageDealt: 50,
        killsByTower: [{ type: TowerType.BASIC, level: 1, count: 2 }],
      });
      component.records = [r];
      fixture.detectChanges();
      return r;
    }

    it('hasExpandableDetail is true when there are kills or damage', () => {
      expect(component.hasExpandableDetail(makeRecord({ kills: 1 }))).toBeTrue();
      expect(component.hasExpandableDetail(makeRecord({ damageDealt: 5 }))).toBeTrue();
      expect(component.hasExpandableDetail(makeRecord())).toBeFalse();
    });

    it('isExpanded toggles on click', () => {
      const row = primeExpandable();
      expect(component.isExpanded(row)).toBeFalse();
      component.toggleExpanded(row);
      expect(component.isExpanded(row)).toBeTrue();
      component.toggleExpanded(row);
      expect(component.isExpanded(row)).toBeFalse();
    });

    it('expanded row renders the attribution block', () => {
      const row = primeExpandable();
      component.toggleExpanded(row);
      fixture.detectChanges();

      const detail = (fixture.nativeElement as HTMLElement).querySelector('.last-turn-summary__detail');
      expect(detail).not.toBeNull();
      // Attribution row now uses the compact token "B" (chess-style); the
      // full "Basic" name lives in the data-tooltip attribute, rendered via
      // a CSS pseudo-element tooltip on hover (more reliable than native
      // `title` inside the glass-panel backdrop-filter stacking context).
      const tokenEl = detail!.querySelector('.last-turn-summary__attrib-token');
      expect(tokenEl?.textContent?.trim()).toBe('B');
      const attribChip = detail!.querySelector<HTMLElement>('.last-turn-summary__attrib');
      expect(attribChip?.getAttribute('data-tooltip')).toBe('Basic ×2');
      // aria-label for SR users — the token alone ("B") is opaque without it
      expect(attribChip?.getAttribute('aria-label')).toBe('Basic, 2 kills');
    });

    it('single-kill chip omits the ×N count from both label and tooltip', () => {
      component.records = [makeRecord({
        turnNumber: 10,
        kills: 1,
        killsByTower: [{ type: TowerType.SNIPER, level: 2, count: 1 }],
      })];
      component.toggleExpanded(component.records[0]);
      fixture.detectChanges();

      const chip = (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLElement>('.last-turn-summary__attrib');
      // No ×1 trailing the token for single kills — keeps the line tight.
      expect(chip?.querySelector('.last-turn-summary__attrib-count')).toBeNull();
      expect(chip?.getAttribute('data-tooltip')).toBe('Sniper Tier 2');
      expect(chip?.getAttribute('aria-label')).toBe('Sniper Tier 2, 1 kill');
    });

    it('expandable rows get the --expandable class + aria-expanded attr', () => {
      primeExpandable();
      const rowEl = (fixture.nativeElement as HTMLElement).querySelector('.last-turn-summary__row')!;
      expect(rowEl.classList.contains('last-turn-summary__row--expandable')).toBeTrue();
      expect(rowEl.getAttribute('aria-expanded')).toBe('false');
    });

    it('rows without kills OR damage are not expandable', () => {
      component.records = [makeRecord({ turnNumber: 3, cardsPlayed: 2 })];
      fixture.detectChanges();
      const rowEl = (fixture.nativeElement as HTMLElement).querySelector('.last-turn-summary__row')!;
      expect(rowEl.classList.contains('last-turn-summary__row--expandable')).toBeFalse();
      expect(rowEl.hasAttribute('aria-expanded')).toBeFalse();
    });
  });
});
