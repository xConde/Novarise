import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { SettingsService, GameSettings } from '../core/services/settings.service';
import { DifficultyLevel } from '../game/game-board/models/game-state.model';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let settingsService: jasmine.SpyObj<SettingsService>;

  const mockSettings: GameSettings = {
    audioMuted: false,
    difficulty: DifficultyLevel.NORMAL,
    showFps: false,
    reduceMotion: false,
  };

  beforeEach(async () => {
    settingsService = jasmine.createSpyObj('SettingsService', ['get', 'update']);
    settingsService.get.and.returnValue({ ...mockSettings });

    await TestBed.configureTestingModule({
      declarations: [SettingsComponent],
      providers: [
        { provide: SettingsService, useValue: settingsService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.classList.remove('reduce-motion');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the settings page title', () => {
    const title = fixture.nativeElement.querySelector('.settings-page-title');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('SETTINGS');
  });

  it('should load settings from SettingsService on init', () => {
    expect(settingsService.get).toHaveBeenCalled();
    expect(component.audioMuted).toBe(false);
    expect(component.currentDifficulty).toBe(DifficultyLevel.NORMAL);
    expect(component.showFps).toBe(false);
    expect(component.reduceMotion).toBe(false);
  });

  it('should load muted state when settings have audioMuted=true', () => {
    settingsService.get.and.returnValue({ ...mockSettings, audioMuted: true });
    const newFixture = TestBed.createComponent(SettingsComponent);
    newFixture.detectChanges();
    expect(newFixture.componentInstance.audioMuted).toBe(true);
  });

  it('should render 4 difficulty buttons', () => {
    const allOptionBtns = Array.from(
      fixture.nativeElement.querySelectorAll('.setting-option-btn')
    ) as HTMLButtonElement[];
    expect(allOptionBtns.length).toBe(4);
  });

  it('should toggle audio and call settingsService.update', () => {
    component.toggleAudio();
    expect(component.audioMuted).toBe(true);
    expect(settingsService.update).toHaveBeenCalledWith({ audioMuted: true });

    component.toggleAudio();
    expect(component.audioMuted).toBe(false);
    expect(settingsService.update).toHaveBeenCalledWith({ audioMuted: false });
  });

  it('should show "On" when audio is not muted', () => {
    component.audioMuted = false;
    fixture.detectChanges();
    const toggleBtns = fixture.nativeElement.querySelectorAll('.setting-toggle');
    const audioBtn = toggleBtns[0] as HTMLButtonElement;
    expect((audioBtn.textContent ?? '').trim()).toBe('On');
  });

  it('should show "Muted" when audio is muted', () => {
    component.audioMuted = true;
    fixture.detectChanges();
    const toggleBtns = fixture.nativeElement.querySelectorAll('.setting-toggle');
    const audioBtn = toggleBtns[0] as HTMLButtonElement;
    expect((audioBtn.textContent ?? '').trim()).toBe('Muted');
  });

  it('should set difficulty and persist', () => {
    component.setDifficulty(DifficultyLevel.HARD);
    expect(component.currentDifficulty).toBe(DifficultyLevel.HARD);
    expect(settingsService.update).toHaveBeenCalledWith({ difficulty: DifficultyLevel.HARD });
  });

  it('should toggle FPS and persist', () => {
    component.toggleFps();
    expect(component.showFps).toBe(true);
    expect(settingsService.update).toHaveBeenCalledWith({ showFps: true });

    component.toggleFps();
    expect(component.showFps).toBe(false);
    expect(settingsService.update).toHaveBeenCalledWith({ showFps: false });
  });

  it('should show "On" when FPS counter is enabled', () => {
    component.showFps = true;
    fixture.detectChanges();
    const toggleBtns = fixture.nativeElement.querySelectorAll('.setting-toggle');
    const fpsBtn = toggleBtns[1] as HTMLButtonElement;
    expect((fpsBtn.textContent ?? '').trim()).toBe('On');
  });

  it('should show "Off" when FPS counter is disabled', () => {
    component.showFps = false;
    fixture.detectChanges();
    const toggleBtns = fixture.nativeElement.querySelectorAll('.setting-toggle');
    const fpsBtn = toggleBtns[1] as HTMLButtonElement;
    expect((fpsBtn.textContent ?? '').trim()).toBe('Off');
  });

  it('should toggle reduceMotion, persist, and add class to body', () => {
    component.toggleReduceMotion();
    expect(component.reduceMotion).toBe(true);
    expect(settingsService.update).toHaveBeenCalledWith({ reduceMotion: true });
    expect(document.body.classList.contains('reduce-motion')).toBe(true);

    component.toggleReduceMotion();
    expect(component.reduceMotion).toBe(false);
    expect(settingsService.update).toHaveBeenCalledWith({ reduceMotion: false });
    expect(document.body.classList.contains('reduce-motion')).toBe(false);
  });

  it('should apply reduce-motion class on init when setting is persisted (red team gate)', () => {
    document.body.classList.remove('reduce-motion');
    settingsService.get.and.returnValue({
      audioMuted: false,
      difficulty: DifficultyLevel.NORMAL,
      showFps: false,
      reduceMotion: true,
    });
    component.ngOnInit();
    expect(document.body.classList.contains('reduce-motion')).toBe(true);
    document.body.classList.remove('reduce-motion');
  });

  it('should mark active difficulty button with active class', () => {
    component.currentDifficulty = DifficultyLevel.HARD;
    fixture.detectChanges();
    const allOptionBtns = Array.from(
      fixture.nativeElement.querySelectorAll('.setting-option-btn')
    ) as HTMLButtonElement[];
    const activeButtons = allOptionBtns.filter((btn) => btn.classList.contains('active'));
    const activeTexts = activeButtons.map((btn) => btn.textContent?.trim());
    expect(activeTexts).toContain('Hard');
  });

  it('should expose difficulties array with all 4 levels', () => {
    expect(component.difficulties).toEqual([
      DifficultyLevel.EASY,
      DifficultyLevel.NORMAL,
      DifficultyLevel.HARD,
      DifficultyLevel.NIGHTMARE,
    ]);
  });

});
