import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { TowerSelectionBarComponent } from './tower-selection-bar.component';
import { TowerType, TOWER_CONFIGS, TOWER_DESCRIPTIONS } from '../../models/tower.model';

describe('TowerSelectionBarComponent', () => {
  let component: TowerSelectionBarComponent;
  let fixture: ComponentFixture<TowerSelectionBarComponent>;

  const towerTypes: { type: TowerType; hotkey: string }[] = [
    { type: TowerType.BASIC, hotkey: '1' },
    { type: TowerType.SNIPER, hotkey: '2' },
    { type: TowerType.SPLASH, hotkey: '3' },
    { type: TowerType.SLOW, hotkey: '4' },
    { type: TowerType.CHAIN, hotkey: '5' },
    { type: TowerType.MORTAR, hotkey: '6' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TowerSelectionBarComponent],
      imports: [CommonModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TowerSelectionBarComponent);
    component = fixture.componentInstance;
    component.towerTypes = towerTypes;
    component.selectedTowerType = TowerType.BASIC;
    component.towerConfigs = TOWER_CONFIGS;
    component.towerDescriptions = TOWER_DESCRIPTIONS;
    component.gold = 100;

    const costs = new Map<TowerType, number>();
    for (const type of Object.values(TowerType)) {
      costs.set(type, TOWER_CONFIGS[type].cost);
    }
    component.effectiveCosts = costs;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a button for each tower type', () => {
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.tower-btn');
    expect(buttons.length).toBe(towerTypes.length);
  });

  it('emits selectTowerType when a tower button is clicked', () => {
    fixture.detectChanges();
    spyOn(component.selectTowerType, 'emit');

    const buttons = fixture.nativeElement.querySelectorAll('.tower-btn');
    buttons[1].click();

    expect(component.selectTowerType.emit).toHaveBeenCalledWith(TowerType.SNIPER);
  });

  it('marks the selected tower button with selected class', () => {
    component.selectedTowerType = TowerType.SPLASH;
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.tower-btn');
    // SPLASH is index 2
    expect(buttons[2].classList.contains('selected')).toBeTrue();
    expect(buttons[0].classList.contains('selected')).toBeFalse();
  });

  it('marks tower as unaffordable when gold is insufficient', () => {
    // Set gold lower than sniper cost
    const sniperCost = TOWER_CONFIGS[TowerType.SNIPER].cost;
    component.gold = sniperCost - 1;
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.tower-btn');
    // Sniper is index 1
    expect(buttons[1].classList.contains('unaffordable')).toBeTrue();
  });

  it('does not mark tower as unaffordable when gold is sufficient', () => {
    component.gold = 9999;
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.tower-btn');
    for (let i = 0; i < buttons.length; i++) {
      expect(buttons[i].classList.contains('unaffordable')).toBeFalse();
    }
  });

  it('displays effective cost from the costs map', () => {
    const costs = new Map<TowerType, number>();
    costs.set(TowerType.BASIC, 42);
    costs.set(TowerType.SNIPER, 99);
    for (const type of Object.values(TowerType)) {
      if (!costs.has(type)) {
        costs.set(type, TOWER_CONFIGS[type].cost);
      }
    }
    component.effectiveCosts = costs;
    fixture.detectChanges();

    const costEls = fixture.nativeElement.querySelectorAll('.tower-cost');
    expect(costEls[0].textContent).toContain('42g');
    expect(costEls[1].textContent).toContain('99g');
  });

  it('displays tower hotkeys', () => {
    fixture.detectChanges();
    const hotkeyEls = fixture.nativeElement.querySelectorAll('.tower-hotkey');
    expect(hotkeyEls[0].textContent).toContain('1');
    expect(hotkeyEls[5].textContent).toContain('6');
  });
});
