import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { LastTurnSummaryComponent, TurnSummary } from './last-turn-summary.component';

const makeSummary = (overrides: Partial<TurnSummary> = {}): TurnSummary => ({
  turnNumber: 2,
  cardsPlayed: 3,
  kills: 4,
  goldEarned: 20,
  livesLost: 1,
  ...overrides,
});

describe('LastTurnSummaryComponent', () => {
  let component: LastTurnSummaryComponent;
  let fixture: ComponentFixture<LastTurnSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LastTurnSummaryComponent],
      imports: [CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LastTurnSummaryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders nothing when visible is false', () => {
    component.visible = false;
    component.summary = makeSummary();
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.last-turn-summary');
    expect(el).toBeNull();
  });

  it('renders nothing when summary is null', () => {
    component.visible = true;
    component.summary = null;
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.last-turn-summary');
    expect(el).toBeNull();
  });

  it('renders the summary strip when visible and summary are set', () => {
    component.visible = true;
    component.summary = makeSummary();
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.last-turn-summary');
    expect(el).toBeTruthy();
  });

  it('displays the turn number', () => {
    component.visible = true;
    component.summary = makeSummary({ turnNumber: 5 });
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.last-turn-summary__label');
    expect(label.textContent).toContain('5');
  });

  it('hides cardsPlayed stat when 0', () => {
    component.visible = true;
    component.summary = makeSummary({ cardsPlayed: 0 });
    fixture.detectChanges();
    const stats = fixture.nativeElement.querySelectorAll('.last-turn-summary__stat');
    const texts = Array.from<HTMLElement>(stats).map(s => s.textContent ?? '');
    expect(texts.some(t => t.includes('played'))).toBeFalse();
  });

  it('hides kills stat when 0', () => {
    component.visible = true;
    component.summary = makeSummary({ kills: 0 });
    fixture.detectChanges();
    const stats = fixture.nativeElement.querySelectorAll('.last-turn-summary__stat');
    const texts = Array.from<HTMLElement>(stats).map(s => s.textContent ?? '');
    expect(texts.some(t => t.includes('killed'))).toBeFalse();
  });

  it('hides goldEarned stat when 0', () => {
    component.visible = true;
    component.summary = makeSummary({ goldEarned: 0 });
    fixture.detectChanges();
    const gold = fixture.nativeElement.querySelector('.last-turn-summary__stat--gold');
    expect(gold).toBeNull();
  });

  it('hides livesLost stat when 0', () => {
    component.visible = true;
    component.summary = makeSummary({ livesLost: 0 });
    fixture.detectChanges();
    const danger = fixture.nativeElement.querySelector('.last-turn-summary__stat--danger');
    expect(danger).toBeNull();
  });

  it('shows goldEarned with + prefix', () => {
    component.visible = true;
    component.summary = makeSummary({ goldEarned: 30 });
    fixture.detectChanges();
    const gold = fixture.nativeElement.querySelector('.last-turn-summary__stat--gold');
    expect(gold.textContent).toContain('+30g');
  });
});
