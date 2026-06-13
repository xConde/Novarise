import { AUDIO_CONFIG } from './audio.constants';

describe('AUDIO_CONFIG', () => {
  describe('towerPlace', () => {
    it('should use triangle oscillator type for a softer tone', () => {
      expect(AUDIO_CONFIG.towerPlace.oscillatorType).toBe('triangle');
    });

    it('should have gain of 0.2 (balanced with other single-shot sounds)', () => {
      expect(AUDIO_CONFIG.towerPlace.gain).toBeCloseTo(0.2);
    });

    it('should have gain below 0.3 (not louder than other single-shot sounds)', () => {
      expect(AUDIO_CONFIG.towerPlace.gain).toBeLessThan(0.3);
    });

    it('should have a positive frequency', () => {
      expect(AUDIO_CONFIG.towerPlace.frequency).toBeGreaterThan(0);
    });

    it('should have a positive duration', () => {
      expect(AUDIO_CONFIG.towerPlace.duration).toBeGreaterThan(0);
    });
  });
});
