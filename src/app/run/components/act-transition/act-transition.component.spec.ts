import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ActTransitionComponent } from './act-transition.component';

describe('ActTransitionComponent', () => {
  let fixture: ComponentFixture<ActTransitionComponent>;
  let component: ActTransitionComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ActTransitionComponent],
      imports: [CommonModule],
    });

    fixture = TestBed.createComponent(ActTransitionComponent);
    component = fixture.componentInstance;
    component.completedAct = 0;
    component.bossName = 'Siege Commander';
    component.relicCount = 3;
    component.encounterCount = 7;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the completed act label (1-based)', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Act 1 Complete!');
  });

  it('should display the boss name when provided', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Siege Commander');
  });

  it('should hide the boss line when bossName is empty', () => {
    component.bossName = '';
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const bossEl = el.querySelector('.act-transition__boss');
    expect(bossEl).toBeNull();
  });

  it('should display relic count', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('3');
  });

  it('should display encounter count', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('7');
  });

  it('continue button emits "continued" event', () => {
    let emitted = false;
    component.continued.subscribe(() => (emitted = true));

    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.act-transition__btn');
    btn?.click();

    expect(emitted).toBeTrue();
  });

  it('continue button label should reference the next act', () => {
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.act-transition__btn');
    expect(btn?.textContent).toContain('Act 2');
  });

  it('completedActLabel returns 1-based index', () => {
    component.completedAct = 0;
    expect(component.completedActLabel).toBe(1);

    component.completedAct = 1;
    expect(component.completedActLabel).toBe(2);
  });

  it('nextActLabel returns 1 more than completedActLabel', () => {
    component.completedAct = 0;
    expect(component.nextActLabel).toBe(2);

    component.completedAct = 1;
    expect(component.nextActLabel).toBe(3);
  });
});
