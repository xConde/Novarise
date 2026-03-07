import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { GameControlsComponent } from './game-controls.component';
import { GamePhase } from '../../models/game-state.model';

describe('GameControlsComponent', () => {
  let component: GameControlsComponent;
  let fixture: ComponentFixture<GameControlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameControlsComponent],
      imports: [CommonModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameControlsComponent);
    component = fixture.componentInstance;
    component.phase = GamePhase.INTERMISSION;
    component.isPaused = false;
    component.gameSpeed = 1;
    component.showAllRanges = false;
    component.showPathOverlay = false;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows Next Wave button when not in COMBAT phase', () => {
    component.phase = GamePhase.INTERMISSION;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.wave-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Next Wave');
  });

  it('hides Next Wave button during COMBAT phase', () => {
    component.phase = GamePhase.COMBAT;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.wave-btn');
    expect(btn).toBeNull();
  });

  it('emits startWave when Next Wave button is clicked', () => {
    component.phase = GamePhase.INTERMISSION;
    fixture.detectChanges();
    spyOn(component.startWave, 'emit');

    const btn = fixture.nativeElement.querySelector('.wave-btn');
    btn.click();

    expect(component.startWave.emit).toHaveBeenCalled();
  });

  it('emits togglePause when pause button is clicked', () => {
    fixture.detectChanges();
    spyOn(component.togglePause, 'emit');

    const btn = fixture.nativeElement.querySelector('.pause-btn');
    btn.click();

    expect(component.togglePause.emit).toHaveBeenCalled();
  });

  it('pause button has active class when isPaused is true', () => {
    component.isPaused = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.pause-btn');
    expect(btn.classList.contains('active')).toBeTrue();
  });

  it('emits setSpeed when a speed button is clicked', () => {
    fixture.detectChanges();
    spyOn(component.setSpeed, 'emit');

    const speedBtns = fixture.nativeElement.querySelectorAll('.speed-btn');
    speedBtns[1].click(); // 2x

    expect(component.setSpeed.emit).toHaveBeenCalledWith(2);
  });

  it('marks the active speed button with active class', () => {
    component.gameSpeed = 2;
    fixture.detectChanges();
    const speedBtns = fixture.nativeElement.querySelectorAll('.speed-btn');
    expect(speedBtns[0].classList.contains('active')).toBeFalse();
    expect(speedBtns[1].classList.contains('active')).toBeTrue();
    expect(speedBtns[2].classList.contains('active')).toBeFalse();
  });

  it('emits toggleAllRanges when range button is clicked', () => {
    fixture.detectChanges();
    spyOn(component.toggleAllRanges, 'emit');

    const btn = fixture.nativeElement.querySelector('.range-btn');
    btn.click();

    expect(component.toggleAllRanges.emit).toHaveBeenCalled();
  });

  it('range button has active class when showAllRanges is true', () => {
    component.showAllRanges = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.range-btn');
    expect(btn.classList.contains('active')).toBeTrue();
  });

  it('emits togglePathOverlay when path button is clicked', () => {
    fixture.detectChanges();
    spyOn(component.togglePathOverlay, 'emit');

    const btn = fixture.nativeElement.querySelector('.path-btn');
    btn.click();

    expect(component.togglePathOverlay.emit).toHaveBeenCalled();
  });

  it('path button has active class when showPathOverlay is true', () => {
    component.showPathOverlay = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.path-btn');
    expect(btn.classList.contains('active')).toBeTrue();
  });

  it('renders 3 speed buttons', () => {
    fixture.detectChanges();
    const speedBtns = fixture.nativeElement.querySelectorAll('.speed-btn');
    expect(speedBtns.length).toBe(3);
  });
});
