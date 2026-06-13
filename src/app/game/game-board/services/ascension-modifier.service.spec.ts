import { TestBed } from '@angular/core/testing';
import { AscensionModifierService } from './ascension-modifier.service';
import { GameStateService } from './game-state.service';
import { ENCOUNTER_CONFIG } from '../../../run/constants/run.constants';

describe('AscensionModifierService', () => {
  let service: AscensionModifierService;
  let gameStateService: jasmine.SpyObj<GameStateService>;

  beforeEach(() => {
    gameStateService = jasmine.createSpyObj('GameStateService', ['setAscensionModifierEffects']);

    TestBed.configureTestingModule({
      providers: [
        AscensionModifierService,
        { provide: GameStateService, useValue: gameStateService },
      ],
    });
    service = TestBed.inject(AscensionModifierService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('apply()', () => {
    it('skips the GameState update at A0 for a normal (non-elite, non-boss) encounter', () => {
      service.apply(0, false, false);
      expect(gameStateService.setAscensionModifierEffects).not.toHaveBeenCalled();
    });

    it('skips the GameState update for a negative ascension level with no elite/boss', () => {
      service.apply(-1, false, false);
      expect(gameStateService.setAscensionModifierEffects).not.toHaveBeenCalled();
    });

    it('calls setAscensionModifierEffects when ascensionLevel > 0', () => {
      service.apply(1, false, false);
      expect(gameStateService.setAscensionModifierEffects).toHaveBeenCalled();
    });

    it('passes an object as ModifierEffects in every call', () => {
      service.apply(1, false, false);
      const arg = gameStateService.setAscensionModifierEffects.calls.mostRecent().args[0];
      expect(typeof arg).toBe('object');
    });

    it('applies eliteHealthMultiplier base at A0 for elite encounters', () => {
      service.apply(0, true, false);
      const arg = gameStateService.setAscensionModifierEffects.calls.mostRecent().args[0];
      // Base elite multiplier (1.5) must be applied even with zero ascension
      expect(arg.enemyHealthMultiplier).toBeCloseTo(ENCOUNTER_CONFIG.eliteHealthMultiplier, 5);
    });

    it('applies bossHealthMultiplier base at A0 for boss encounters', () => {
      service.apply(0, false, true);
      const arg = gameStateService.setAscensionModifierEffects.calls.mostRecent().args[0];
      expect(arg.enemyHealthMultiplier).toBeCloseTo(ENCOUNTER_CONFIG.bossHealthMultiplier, 5);
    });

    it('applies no health multiplier for a normal combat encounter at A0 (no GameState update)', () => {
      service.apply(0, false, false);
      expect(gameStateService.setAscensionModifierEffects).not.toHaveBeenCalled();
    });

    it('stacks ascension elite bonus multiplicatively on top of base elite multiplier', () => {
      // A5 accumulates:
      //   ascBaseHealth       = A1.ENEMY_HEALTH_MULTIPLIER = 1.1
      //   encounterBaseElite  = ENCOUNTER_CONFIG.eliteHealthMultiplier = 1.5
      //   ascEliteHealth      = A5.ELITE_HEALTH_MULTIPLIER = 1.25
      // final = 1.1 * 1.5 * 1.25 = 2.0625 (multiplicative — NOT 1.5+1.25)
      // An additive regression (1.1*(1.5+1.25)=3.025 or 1.5*1.25+1.1=2.975) would NOT produce 2.0625.
      const A1_ENEMY_HEALTH = 1.1;   // AscensionEffectType.ENEMY_HEALTH_MULTIPLIER at level 1
      const A5_ELITE_HEALTH = 1.25;  // AscensionEffectType.ELITE_HEALTH_MULTIPLIER at level 5
      const expected = A1_ENEMY_HEALTH * ENCOUNTER_CONFIG.eliteHealthMultiplier * A5_ELITE_HEALTH;
      service.apply(5, true, false);
      const arg = gameStateService.setAscensionModifierEffects.calls.mostRecent().args[0];
      expect(arg.enemyHealthMultiplier).toBeCloseTo(expected, 3); // 2.0625
    });

    it('combines health multipliers for elite encounters at higher ascension', () => {
      expect(() => service.apply(3, true, false)).not.toThrow();
      expect(gameStateService.setAscensionModifierEffects).toHaveBeenCalled();
    });

    it('combines health multipliers for boss encounters', () => {
      expect(() => service.apply(3, false, true)).not.toThrow();
      expect(gameStateService.setAscensionModifierEffects).toHaveBeenCalled();
    });

    it('combines health multipliers for elite boss encounters', () => {
      expect(() => service.apply(5, true, true)).not.toThrow();
      expect(gameStateService.setAscensionModifierEffects).toHaveBeenCalled();
    });
  });
});
