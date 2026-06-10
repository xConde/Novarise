import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { FontScale, SettingsService, GameSettings } from '../core/services/settings.service';
import { MusicService } from '../core/services/music.service';
import { DifficultyLevel } from '../game/game-board/models/game-state.model';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let settingsService: jasmine.SpyObj<SettingsService>;

  const mockSettings: GameSettings = {
    audioMuted: false,
    musicEnabled: true,
    musicVolume: 0.4,
    difficulty: DifficultyLevel.NORMAL,
    showFps: false,
    reduceMotion: false,
    colorblindAssist: false,
    fontScale: 1,
  };

  beforeEach(async () => {
    settingsService = jasmine.createSpyObj('SettingsService', ['get', 'update', 'applyFontScale']);
    settingsService.get.and.returnValue({ ...mockSettings });

    const musicServiceSpy = jasmine.createSpyObj('MusicService', [
      'playTheme', 'stopMusic', 'setMusicVolume', 'setMusicEnabled', 'cleanup',
    ]);

    await TestBed.configureTestingModule({
      declarations: [SettingsComponent],
      providers: [
        { provide: SettingsService, useValue: settingsService },
        { provide: MusicService, useValue: musicServiceSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.classList.remove('reduce-motion');
    document.documentElement.classList.remove('font-scale-large', 'font-scale-larger');
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
    const difficultyBtns = Array.from(
      fixture.nativeElement.querySelectorAll('.setting-option-btn[data-setting="difficulty"]')
    ) as HTMLButtonElement[];
    expect(difficultyBtns.length).toBe(4);
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
    const audioBtn = fixture.nativeElement.querySelector(
      '.setting-toggle[data-setting="audio"]'
    ) as HTMLButtonElement;
    expect((audioBtn.textContent ?? '').trim()).toBe('On');
  });

  it('should show "Muted" when audio is muted', () => {
    component.audioMuted = true;
    fixture.detectChanges();
    const audioBtn = fixture.nativeElement.querySelector(
      '.setting-toggle[data-setting="audio"]'
    ) as HTMLButtonElement;
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
    const fpsBtn = fixture.nativeElement.querySelector(
      '.setting-toggle[data-setting="fps"]'
    ) as HTMLButtonElement;
    expect((fpsBtn.textContent ?? '').trim()).toBe('On');
  });

  it('should show "Off" when FPS counter is disabled', () => {
    component.showFps = false;
    fixture.detectChanges();
    const fpsBtn = fixture.nativeElement.querySelector(
      '.setting-toggle[data-setting="fps"]'
    ) as HTMLButtonElement;
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
      musicEnabled: true,
      musicVolume: 0.4,
      difficulty: DifficultyLevel.NORMAL,
      showFps: false,
      reduceMotion: true,
      colorblindAssist: false,
      fontScale: 1 as const,
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

  // ── Colorblind assist ──────────────────────────────────────────────────────

  it('should load colorblindAssist from settings on init', () => {
    settingsService.get.and.returnValue({ ...mockSettings, colorblindAssist: true });
    component.ngOnInit();
    expect(component.colorblindAssist).toBe(true);
  });

  it('should toggle colorblindAssist and persist', () => {
    component.toggleColorblindAssist();
    expect(component.colorblindAssist).toBe(true);
    expect(settingsService.update).toHaveBeenCalledWith({ colorblindAssist: true });

    component.toggleColorblindAssist();
    expect(component.colorblindAssist).toBe(false);
    expect(settingsService.update).toHaveBeenCalledWith({ colorblindAssist: false });
  });

  it('should render colorblind toggle with data-setting="colorblind"', () => {
    const btn = fixture.nativeElement.querySelector(
      '.setting-toggle[data-setting="colorblind"]'
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
  });

  it('should show "Off" when colorblindAssist is false', () => {
    component.colorblindAssist = false;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector(
      '.setting-toggle[data-setting="colorblind"]'
    ) as HTMLButtonElement;
    expect((btn.textContent ?? '').trim()).toBe('Off');
  });

  it('should show "On" when colorblindAssist is true', () => {
    component.colorblindAssist = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector(
      '.setting-toggle[data-setting="colorblind"]'
    ) as HTMLButtonElement;
    expect((btn.textContent ?? '').trim()).toBe('On');
  });

  // ── Font scale ─────────────────────────────────────────────────────────────

  it('should load fontScale from settings on init', () => {
    settingsService.get.and.returnValue({ ...mockSettings, fontScale: 1.15 as FontScale });
    component.ngOnInit();
    expect(component.currentFontScale).toBe(1.15);
  });

  it('should expose 3 fontScaleOptions (Normal / Large / Larger)', () => {
    const labels = component.fontScaleOptions.map(o => o.label);
    expect(labels).toEqual(['Normal', 'Large', 'Larger']);
  });

  it('should call setFontScale, persist, and call applyFontScale', () => {
    component.setFontScale(1.3 as FontScale);
    expect(component.currentFontScale).toBe(1.3 as FontScale);
    expect(settingsService.update).toHaveBeenCalledWith({ fontScale: 1.3 as FontScale });
    expect(settingsService.applyFontScale).toHaveBeenCalledWith(1.3 as FontScale);
  });

  it('should render font-scale option buttons with data-setting="font-scale"', () => {
    const btns = fixture.nativeElement.querySelectorAll(
      '.setting-option-btn[data-setting="font-scale"]'
    ) as NodeListOf<HTMLButtonElement>;
    expect(btns.length).toBe(3);
  });

  it('should mark the active font-scale button with the active class', () => {
    component.currentFontScale = 1.15 as FontScale;
    fixture.detectChanges();
    const btns = Array.from(
      fixture.nativeElement.querySelectorAll('.setting-option-btn[data-setting="font-scale"]')
    ) as HTMLButtonElement[];
    const active = btns.filter(b => b.classList.contains('active'));
    expect(active.length).toBe(1);
    expect((active[0].textContent ?? '').trim()).toBe('Large');
  });

});
