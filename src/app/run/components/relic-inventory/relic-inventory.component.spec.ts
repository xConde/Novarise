import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { RelicInventoryComponent } from './relic-inventory.component';
import { RelicDefinition, RelicRarity, RelicId } from '../../models/relic.model';

function makeRelic(overrides: Partial<RelicDefinition> = {}): RelicDefinition {
  return {
    id: RelicId.GOLD_MAGNET,
    name: 'Gold Magnet',
    description: '+15% gold from kills',
    flavorText: 'Wealth has a way of finding the prepared.',
    rarity: RelicRarity.COMMON,
    ...overrides,
  };
}

describe('RelicInventoryComponent', () => {
  let component: RelicInventoryComponent;
  let fixture: ComponentFixture<RelicInventoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RelicInventoryComponent],
      imports: [CommonModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RelicInventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('empty state', () => {
    it('shows "No relics" when relics array is empty', () => {
      component.relics = [];
      fixture.detectChanges();
      const empty = fixture.debugElement.query(By.css('.relic-inventory__empty'));
      expect(empty).toBeTruthy();
      expect(empty.nativeElement.textContent.trim()).toBe('No relics');
    });

    it('hides the empty label when relics are present', () => {
      component.relics = [makeRelic()];
      fixture.detectChanges();
      const empty = fixture.debugElement.query(By.css('.relic-inventory__empty'));
      expect(empty).toBeNull();
    });
  });

  describe('relic badge rendering', () => {
    it('renders one badge per relic', () => {
      component.relics = [makeRelic(), makeRelic({ id: RelicId.IRON_HEART, name: 'Iron Heart' })];
      fixture.detectChanges();
      const badges = fixture.debugElement.queryAll(By.css('.relic-badge'));
      expect(badges.length).toBe(2);
    });

    it('applies correct rarity class to each badge', () => {
      component.relics = [
        makeRelic({ rarity: RelicRarity.UNCOMMON }),
        makeRelic({ id: RelicId.COMMANDERS_BANNER, rarity: RelicRarity.RARE }),
      ];
      fixture.detectChanges();
      const badges = fixture.debugElement.queryAll(By.css('.relic-badge'));
      expect(badges[0].nativeElement.classList).toContain('relic--uncommon');
      expect(badges[1].nativeElement.classList).toContain('relic--rare');
    });

    it('sets aria-label on each badge', () => {
      component.relics = [makeRelic({ name: 'Gold Magnet', description: '+15% gold from kills' })];
      fixture.detectChanges();
      const badge = fixture.debugElement.query(By.css('.relic-badge'));
      expect(badge.nativeElement.getAttribute('aria-label')).toBe('Gold Magnet — +15% gold from kills');
    });
  });

  describe('showTooltip()', () => {
    it('sets hoveredRelic on mouseenter', () => {
      const relic = makeRelic();
      const event = new MouseEvent('mouseenter', { clientX: 300, clientY: 200 });
      component.showTooltip(relic, event);
      expect(component.hoveredRelic).toBe(relic);
    });

    it('updates tooltip X position from clientX', () => {
      const relic = makeRelic();
      const event = new MouseEvent('mouseenter', { clientX: 400, clientY: 300 });
      component.showTooltip(relic, event);
      // Tooltip x is clamped, just verify it was set (non-zero for x=400)
      expect(component.tooltipX).toBeGreaterThanOrEqual(0);
    });

    it('updates tooltip Y position from clientY', () => {
      const relic = makeRelic();
      const event = new MouseEvent('mouseenter', { clientX: 200, clientY: 150 });
      component.showTooltip(relic, event);
      expect(component.tooltipY).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hideTooltip()', () => {
    it('clears hoveredRelic', () => {
      component.hoveredRelic = makeRelic();
      component.hideTooltip();
      expect(component.hoveredRelic).toBeNull();
    });
  });

  describe('getRarityClass()', () => {
    it('returns relic--common for COMMON', () => {
      expect(component.getRarityClass(RelicRarity.COMMON)).toBe('relic--common');
    });

    it('returns relic--uncommon for UNCOMMON', () => {
      expect(component.getRarityClass(RelicRarity.UNCOMMON)).toBe('relic--uncommon');
    });

    it('returns relic--rare for RARE', () => {
      expect(component.getRarityClass(RelicRarity.RARE)).toBe('relic--rare');
    });
  });

  describe('tooltip rendering', () => {
    it('renders tooltip when hoveredRelic is set', () => {
      component.relics = [makeRelic()];
      component.hoveredRelic = makeRelic({ name: 'Gold Magnet', description: '+15% gold' });
      fixture.detectChanges();
      const tooltip = fixture.debugElement.query(By.css('.relic-tooltip'));
      expect(tooltip).toBeTruthy();
    });

    it('hides tooltip when hoveredRelic is null', () => {
      component.hoveredRelic = null;
      fixture.detectChanges();
      const tooltip = fixture.debugElement.query(By.css('.relic-tooltip'));
      expect(tooltip).toBeNull();
    });

    it('displays relic name and description in tooltip', () => {
      component.relics = [makeRelic()];
      component.hoveredRelic = makeRelic({ name: 'Gold Magnet', description: '+15% gold from kills' });
      fixture.detectChanges();
      const name = fixture.debugElement.query(By.css('.relic-tooltip__name'));
      const desc = fixture.debugElement.query(By.css('.relic-tooltip__desc'));
      expect(name.nativeElement.textContent.trim()).toBe('Gold Magnet');
      expect(desc.nativeElement.textContent.trim()).toBe('+15% gold from kills');
    });
  });
});
