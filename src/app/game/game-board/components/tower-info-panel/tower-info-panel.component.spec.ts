import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { TowerInfoPanelComponent } from './tower-info-panel.component';
import { TowerType, TowerSpecialization, PlacedTower, MAX_TOWER_LEVEL } from '../../models/tower.model';

function makeTower(overrides: Partial<PlacedTower> = {}): PlacedTower {
  return {
    id: 'test-tower',
    type: TowerType.BASIC,
    level: 1,
    row: 0,
    col: 0,
    lastFireTime: 0,
    kills: 5,
    totalInvested: 50,
    targetingMode: 'nearest',
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
      imports: [CommonModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TowerInfoPanelComponent);
    component = fixture.componentInstance;
    component.selectedTowerInfo = makeTower();
    component.selectedTowerStats = { damage: 25, range: 3, fireRate: 1.0 };
    component.upgradeCost = 50;
    component.sellValue = 25;
    component.gold = 200;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows tower name, level stars, and stats', () => {
    fixture.detectChanges();
    const name = fixture.nativeElement.querySelector('.tower-info-name');
    expect(name.textContent.trim()).toBe('Basic');

    const filledStars = fixture.nativeElement.querySelectorAll('.level-star:not(.empty)');
    expect(filledStars.length).toBe(1);

    const emptyStars = fixture.nativeElement.querySelectorAll('.level-star.empty');
    expect(emptyStars.length).toBe(MAX_TOWER_LEVEL - 1);

    const statValues = fixture.nativeElement.querySelectorAll('.stat-value');
    expect(statValues[0].textContent.trim()).toBe('25'); // damage
    expect(statValues[1].textContent.trim()).toBe('3');  // range
  });

  it('emits deselect on close button click', () => {
    fixture.detectChanges();
    spyOn(component.deselect, 'emit');

    const closeBtn = fixture.nativeElement.querySelector('.tower-info-close');
    closeBtn.click();

    expect(component.deselect.emit).toHaveBeenCalled();
  });

  it('emits upgrade on upgrade button click', () => {
    fixture.detectChanges();
    spyOn(component.upgrade, 'emit');

    const upgradeBtn = fixture.nativeElement.querySelector('.upgrade-btn');
    upgradeBtn.click();

    expect(component.upgrade.emit).toHaveBeenCalled();
  });

  it('emits sell on sell button click', () => {
    fixture.detectChanges();
    spyOn(component.sell, 'emit');

    const sellBtn = fixture.nativeElement.querySelector('.sell-btn');
    sellBtn.click();

    expect(component.sell.emit).toHaveBeenCalled();
  });

  it('shows unaffordable class when gold < upgradeCost', () => {
    component.gold = 10;
    component.upgradeCost = 50;
    fixture.detectChanges();

    const upgradeBtn = fixture.nativeElement.querySelector('.upgrade-btn');
    expect(upgradeBtn.classList.contains('unaffordable')).toBeTrue();
  });

  it('emits cycleTargeting on targeting button click', () => {
    fixture.detectChanges();
    spyOn(component.cycleTargeting, 'emit');

    const targetBtn = fixture.nativeElement.querySelector('.targeting-btn');
    targetBtn.click();

    expect(component.cycleTargeting.emit).toHaveBeenCalled();
  });

  it('shows specialization choice panel when showSpecializationChoice is true', () => {
    component.showSpecializationChoice = true;
    component.specOptions = [
      { spec: TowerSpecialization.ALPHA, label: 'Marksman', description: 'High damage', damage: 3.0, range: 1.2, fireRate: 0.8 },
      { spec: TowerSpecialization.BETA, label: 'Rapid', description: 'Fast fire', damage: 1.8, range: 1.5, fireRate: 0.5 },
    ];
    fixture.detectChanges();

    const specPanel = fixture.nativeElement.querySelector('.spec-choice-panel');
    expect(specPanel).toBeTruthy();

    const specBtns = fixture.nativeElement.querySelectorAll('.spec-btn');
    expect(specBtns.length).toBe(2);
  });

  it('emits selectSpecialization with correct spec', () => {
    component.showSpecializationChoice = true;
    component.specOptions = [
      { spec: TowerSpecialization.ALPHA, label: 'Marksman', description: 'High damage', damage: 3.0, range: 1.2, fireRate: 0.8 },
      { spec: TowerSpecialization.BETA, label: 'Rapid', description: 'Fast fire', damage: 1.8, range: 1.5, fireRate: 0.5 },
    ];
    fixture.detectChanges();
    spyOn(component.selectSpecialization, 'emit');

    const specBtns = fixture.nativeElement.querySelectorAll('.spec-btn');
    specBtns[1].click();

    expect(component.selectSpecialization.emit).toHaveBeenCalledWith(TowerSpecialization.BETA);
  });

  it('emits cancelSpecialization on cancel', () => {
    component.showSpecializationChoice = true;
    component.specOptions = [
      { spec: TowerSpecialization.ALPHA, label: 'Marksman', description: 'High damage', damage: 3.0, range: 1.2, fireRate: 0.8 },
    ];
    fixture.detectChanges();
    spyOn(component.cancelSpecialization, 'emit');

    const cancelBtn = fixture.nativeElement.querySelector('.spec-cancel-btn');
    cancelBtn.click();

    expect(component.cancelSpecialization.emit).toHaveBeenCalled();
  });

  it('shows sell confirmation text when sellConfirmPending', () => {
    component.sellConfirmPending = true;
    fixture.detectChanges();

    const sellBtn = fixture.nativeElement.querySelector('.sell-btn');
    expect(sellBtn.textContent).toContain('Confirm Sell?');
    expect(sellBtn.classList.contains('confirm')).toBeTrue();
  });

  it('shows max level badge at MAX_TOWER_LEVEL', () => {
    component.selectedTowerInfo = makeTower({ level: MAX_TOWER_LEVEL });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.max-level-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('MAX');
  });
});
