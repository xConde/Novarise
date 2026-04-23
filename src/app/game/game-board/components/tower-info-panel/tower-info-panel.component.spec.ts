import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { TowerInfoPanelComponent } from './tower-info-panel.component';
import { PlacedTower, TowerType, TowerSpecialization, MAX_TOWER_LEVEL } from '../../models/tower.model';
import { TargetingMode } from '../../models/tower.model';
import { StatusEffectType } from '../../constants/status-effect.constants';

function makeTower(overrides: Partial<PlacedTower> = {}): PlacedTower {
  return {
    id: 'tower-1',
    type: TowerType.BASIC,
    level: 1,
    row: 0,
    col: 0,
    kills: 5,
    totalInvested: 50,
    targetingMode: TargetingMode.NEAREST,
    mesh: null,
    ...overrides,
  };
}

describe('TowerInfoPanelComponent', () => {
  let component: TowerInfoPanelComponent;
  let fixture: ComponentFixture<TowerInfoPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TowerInfoPanelComponent],
      imports: [CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TowerInfoPanelComponent);
    component = fixture.componentInstance;

    component.towerInfo = makeTower();
    component.towerStats = { damage: 25, range: 3 };
    component.upgradeCost = 75;
    component.upgradePercent = 0;
    component.sellValue = 25;
    component.upgradePreview = null;
    component.showSpecializationChoice = false;
    component.specOptions = [];
    component.gold = 100;
    component.sellConfirmPending = false;
    component.targetingModeLabels = {
      [TargetingMode.NEAREST]: 'Nearest',
      [TargetingMode.FIRST]: 'First',
      [TargetingMode.STRONGEST]: 'Strongest',
    };

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('tower name', () => {
    it('should render the tower type as title case', () => {
      const nameEl = fixture.nativeElement.querySelector('.tower-info-name');
      expect(nameEl.textContent.trim()).toBe('Basic');
    });

    it('should render sniper tower type correctly', () => {
      component.towerInfo = makeTower({ type: TowerType.SNIPER });
      fixture.detectChanges();
      const nameEl = fixture.nativeElement.querySelector('.tower-info-name');
      expect(nameEl.textContent.trim()).toBe('Sniper');
    });
  });

  describe('stats table', () => {
    it('should show damage stat', () => {
      const rows = fixture.nativeElement.querySelectorAll('.stat-row');
      const damageRow = rows[0];
      expect(damageRow.querySelector('.stat-label').textContent.trim()).toBe('Damage');
      expect(damageRow.querySelector('.stat-value').textContent.trim()).toBe('25');
    });

    it('should show range stat', () => {
      const rows = fixture.nativeElement.querySelectorAll('.stat-row');
      const rangeRow = rows[1];
      expect(rangeRow.querySelector('.stat-label').textContent.trim()).toBe('Range');
      expect(rangeRow.querySelector('.stat-value').textContent.trim()).toBe('3');
    });

    it('should show kills stat', () => {
      const rows = fixture.nativeElement.querySelectorAll('.stat-row');
      const killsRow = rows[2];
      expect(killsRow.querySelector('.stat-label').textContent.trim()).toBe('Kills');
      expect(killsRow.querySelector('.stat-value').textContent.trim()).toBe('5');
    });

    it('should show status effect row when statusEffect is present', () => {
      component.towerStats = { damage: 25, range: 3, statusEffect: StatusEffectType.BURN };
      fixture.detectChanges();
      const effectRow = fixture.nativeElement.querySelectorAll('.stat-row')[3];
      expect(effectRow.querySelector('.stat-label').textContent.trim()).toBe('Effect');
      expect(effectRow.querySelector('.stat-value').textContent.trim()).toBe('BURN');
    });

    it('should not show status effect row when no statusEffect', () => {
      component.towerStats = { damage: 25, range: 3 };
      fixture.detectChanges();
      const rows = fixture.nativeElement.querySelectorAll('.stat-row');
      expect(rows.length).toBe(3);
    });
  });

  describe('upgrade button', () => {
    it('should show upgrade button when below max level', () => {
      component.towerInfo = makeTower({ level: 1 });
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.upgrade-btn');
      expect(btn).toBeTruthy();
    });

    it('should show upgrade cost in upgrade button', () => {
      component.towerInfo = makeTower({ level: 1 });
      component.upgradeCost = 75;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.upgrade-btn');
      expect(btn.textContent).toContain('75g');
    });

    it('should not show upgrade button at max level', () => {
      component.towerInfo = makeTower({ level: MAX_TOWER_LEVEL });
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.upgrade-btn');
      expect(btn).toBeNull();
    });

    it('should apply unaffordable class when gold is less than upgrade cost', () => {
      component.towerInfo = makeTower({ level: 1 });
      component.upgradeCost = 200;
      component.gold = 50;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.upgrade-btn');
      expect(btn.classList.contains('unaffordable')).toBeTrue();
    });

    it('should emit upgrade event when upgrade button clicked', () => {
      component.towerInfo = makeTower({ level: 1 });
      fixture.detectChanges();
      const emitSpy = jasmine.createSpy('upgrade');
      component.upgrade.subscribe(emitSpy);
      const btn = fixture.nativeElement.querySelector('.upgrade-btn');
      btn.click();
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('sell button', () => {
    it('should show sell button with sell value', () => {
      component.sellValue = 25;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.sell-btn');
      expect(btn).toBeTruthy();
      expect(btn.textContent.trim()).toContain('25g');
    });

    it('should show confirm sell text when sellConfirmPending is true', () => {
      component.sellConfirmPending = true;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.sell-btn');
      expect(btn.textContent.trim()).toBe('Confirm Sell?');
    });

    it('should apply confirm class when sellConfirmPending is true', () => {
      component.sellConfirmPending = true;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.sell-btn');
      expect(btn.classList.contains('confirm')).toBeTrue();
    });

    it('should not apply confirm class when sellConfirmPending is false', () => {
      component.sellConfirmPending = false;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.sell-btn');
      expect(btn.classList.contains('confirm')).toBeFalse();
    });

    it('should emit sell event when sell button clicked', () => {
      const emitSpy = jasmine.createSpy('sell');
      component.sell.subscribe(emitSpy);
      const btn = fixture.nativeElement.querySelector('.sell-btn');
      btn.click();
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('targeting button', () => {
    it('should show targeting button for non-SLOW towers', () => {
      component.towerInfo = makeTower({ type: TowerType.BASIC });
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.targeting-btn');
      expect(btn).toBeTruthy();
    });

    it('should hide targeting button for SLOW towers', () => {
      component.towerInfo = makeTower({ type: TowerType.SLOW });
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.targeting-btn');
      expect(btn).toBeNull();
    });

    it('should emit cycleTargeting event when targeting button clicked', () => {
      component.towerInfo = makeTower({ type: TowerType.BASIC });
      fixture.detectChanges();
      const emitSpy = jasmine.createSpy('cycleTargeting');
      component.cycleTargeting.subscribe(emitSpy);
      const btn = fixture.nativeElement.querySelector('.targeting-btn');
      btn.click();
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('close button', () => {
    it('should emit close event when close button clicked', () => {
      const emitSpy = jasmine.createSpy('close');
      component.close.subscribe(emitSpy);
      const btn = fixture.nativeElement.querySelector('.tower-info-close');
      btn.click();
      expect(emitSpy).toHaveBeenCalled();
    });
  });

  describe('max level badge', () => {
    it('should show MAX badge at max level without specialization', () => {
      component.towerInfo = makeTower({ level: MAX_TOWER_LEVEL });
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.max-level-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent.trim()).toBe('MAX');
    });

    it('should show specialization label at max level with specialization', () => {
      component.towerInfo = makeTower({ level: MAX_TOWER_LEVEL, specialization: TowerSpecialization.ALPHA });
      fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('.max-level-badge');
      expect(badge.textContent).toContain('Marksman');
    });
  });

  describe('level stars', () => {
    it('should return array of zeros for count', () => {
      expect(component.levelStars(3)).toEqual([0, 0, 0]);
    });

    it('should return empty array for zero count', () => {
      expect(component.levelStars(0)).toEqual([]);
    });

    it('should clamp negative to empty array', () => {
      expect(component.levelStars(-1)).toEqual([]);
    });
  });
});
