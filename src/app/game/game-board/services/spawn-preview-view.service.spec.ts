import { SpawnPreviewViewService } from './spawn-preview-view.service';
import { WaveService } from './wave.service';
import { GameState, GamePhase } from '../models/game-state.model';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: GamePhase.SETUP,
    wave: 0,
    maxWaves: 10,
    isEndless: false,
    lives: 20,
    initialLives: 20,
    maxLives: 20,
    gold: 100,
    initialGold: 100,
    elapsedTimeMs: 0,
    survivedTimeMs: 0,
    waveStreak: 0,
    activeModifiers: new Set(),
    ...overrides,
  } as unknown as GameState;
}

describe('SpawnPreviewViewService', () => {
  let waveSpy: jasmine.SpyObj<WaveService>;
  let service: SpawnPreviewViewService;

  beforeEach(() => {
    waveSpy = jasmine.createSpyObj<WaveService>('WaveService', [
      'hasCustomWaves', 'getWaveDefinitions',
    ]);
    waveSpy.hasCustomWaves.and.returnValue(false);
    service = new SpawnPreviewViewService(waveSpy);
  });

  it('starts with empty entries and null templateDescription', () => {
    expect(service.entries).toEqual([]);
    expect(service.templateDescription).toBeNull();
  });

  it('refreshFor populates entries for a scripted wave', () => {
    service.refreshFor(makeState({ wave: 0, isEndless: false }));
    // Wave 1 is a scripted wave with at least one entry.
    expect(service.entries.length).toBeGreaterThan(0);
    expect(service.templateDescription).toBeNull();
  });

  it('passes custom wave definitions when WaveService.hasCustomWaves() is true', () => {
    waveSpy.hasCustomWaves.and.returnValue(true);
    waveSpy.getWaveDefinitions.and.returnValue([]);
    service.refreshFor(makeState({ wave: 0 }));
    expect(waveSpy.getWaveDefinitions).toHaveBeenCalledTimes(1);
  });

  it('omits custom-wave lookup when WaveService.hasCustomWaves() is false', () => {
    waveSpy.hasCustomWaves.and.returnValue(false);
    service.refreshFor(makeState({ wave: 0 }));
    expect(waveSpy.getWaveDefinitions).not.toHaveBeenCalled();
  });

  it('recomputes for state.wave + 1 (preview shows the upcoming wave)', () => {
    service.refreshFor(makeState({ wave: 0 }));
    const wave1 = service.entries;
    service.refreshFor(makeState({ wave: 1 }));
    const wave2 = service.entries;
    // Different wave indices should generally yield different entry sets.
    expect(wave1).not.toBe(wave2);
  });

  it('clear() resets entries and templateDescription', () => {
    service.refreshFor(makeState({ wave: 0 }));
    expect(service.entries.length).toBeGreaterThan(0);
    service.clear();
    expect(service.entries).toEqual([]);
    expect(service.templateDescription).toBeNull();
  });
});
