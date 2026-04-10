import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RestScreenComponent } from './rest-screen.component';

describe('RestScreenComponent', () => {
  let fixture: ComponentFixture<RestScreenComponent>;
  let component: RestScreenComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RestScreenComponent],
      imports: [CommonModule],
    });

    fixture = TestBed.createComponent(RestScreenComponent);
    component = fixture.componentInstance;
    component.currentLives = 4;
    component.maxLives = 7;
    component.healAmount = 2;
    fixture.detectChanges();
  });

  it('renders current lives', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('4 / 7');
  });

  it('rest button emits restChosen', () => {
    let emitted = false;
    component.restChosen.subscribe(() => (emitted = true));

    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.rest-btn:first-of-type');
    btn?.click();

    expect(emitted).toBeTrue();
  });

  it('skip button emits skipChosen', () => {
    let emitted = false;
    component.skipChosen.subscribe(() => (emitted = true));

    const btns = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.rest-btn');
    btns[btns.length - 1].click();

    expect(emitted).toBeTrue();
  });

  it('livesAfterHeal caps at maxLives', () => {
    component.currentLives = 6;
    component.maxLives = 7;
    component.healAmount = 3;

    expect(component.livesAfterHeal).toBe(7);
  });

  it('actualHeal reflects capped heal amount', () => {
    component.currentLives = 6;
    component.maxLives = 7;
    component.healAmount = 3;

    expect(component.actualHeal).toBe(1);
  });

  it('rest button is disabled when already at full health', () => {
    component.currentLives = 7;
    component.maxLives = 7;
    component.healAmount = 2;
    fixture.detectChanges();

    const restBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.rest-btn:first-of-type');
    expect(restBtn?.disabled).toBeTrue();
  });

  it('atFullHealth is true when currentLives equals maxLives', () => {
    component.currentLives = 7;
    component.maxLives = 7;

    expect(component.atFullHealth).toBeTrue();
  });

  it('atFullHealth is false when currentLives is below maxLives', () => {
    component.currentLives = 5;
    component.maxLives = 7;

    expect(component.atFullHealth).toBeFalse();
  });
});
