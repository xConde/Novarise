import { TestBed } from '@angular/core/testing';
import { AudioService } from './audio.service';
import { TowerType } from '../models/tower.model';
import { AUDIO_CONFIG } from '../constants/audio.constants';

describe('AudioService', () => {
  let service: AudioService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AudioService]
    });
    service = TestBed.inject(AudioService);
  });

  afterEach(() => {
    service.cleanup();
  });

  // --- Instantiation ---

  it('should create successfully', () => {
    expect(service).toBeTruthy();
  });

  it('should start with default volume from AUDIO_CONFIG', () => {
    expect(service.volume).toBe(AUDIO_CONFIG.masterVolume);
  });

  it('should start unmuted', () => {
    expect(service.isMuted).toBeFalse();
  });

  // --- setVolume ---

  it('setVolume() should clamp values above 1 to 1', () => {
    service.setVolume(2.5);
    expect(service.volume).toBe(1);
  });

  it('setVolume() should clamp values below 0 to 0', () => {
    service.setVolume(-0.5);
    expect(service.volume).toBe(0);
  });

  it('setVolume() should accept values within 0-1 range', () => {
    service.setVolume(0.7);
    expect(service.volume).toBeCloseTo(0.7);
  });

  it('setVolume() should accept boundary value 0', () => {
    service.setVolume(0);
    expect(service.volume).toBe(0);
  });

  it('setVolume() should accept boundary value 1', () => {
    service.setVolume(1);
    expect(service.volume).toBe(1);
  });

  // --- toggleMute ---

  it('toggleMute() should set isMuted to true on first call', () => {
    service.toggleMute();
    expect(service.isMuted).toBeTrue();
  });

  it('toggleMute() should toggle back to false on second call', () => {
    service.toggleMute();
    service.toggleMute();
    expect(service.isMuted).toBeFalse();
  });

  it('toggleMute() should alternate state on each call', () => {
    expect(service.isMuted).toBeFalse();
    service.toggleMute();
    expect(service.isMuted).toBeTrue();
    service.toggleMute();
    expect(service.isMuted).toBeFalse();
    service.toggleMute();
    expect(service.isMuted).toBeTrue();
  });

  // --- cleanup ---

  it('cleanup() should not throw when AudioContext was never initialized', () => {
    expect(() => service.cleanup()).not.toThrow();
  });

  it('cleanup() should be idempotent — calling twice should not throw', () => {
    expect(() => {
      service.cleanup();
      service.cleanup();
    }).not.toThrow();
  });

  // --- Sound methods: lazy init guard (no AudioContext yet) ---

  it('playTowerFire() should not throw for BASIC tower without AudioContext', () => {
    expect(() => service.playTowerFire(TowerType.BASIC)).not.toThrow();
  });

  it('playTowerFire() should not throw for SNIPER tower without AudioContext', () => {
    expect(() => service.playTowerFire(TowerType.SNIPER)).not.toThrow();
  });

  it('playTowerFire() should not throw for SPLASH tower without AudioContext', () => {
    expect(() => service.playTowerFire(TowerType.SPLASH)).not.toThrow();
  });

  it('playEnemyHit() should not throw without AudioContext', () => {
    expect(() => service.playEnemyHit()).not.toThrow();
  });

  it('playEnemyDeath() should not throw without AudioContext', () => {
    expect(() => service.playEnemyDeath()).not.toThrow();
  });

  it('playWaveStart() should not throw without AudioContext', () => {
    expect(() => service.playWaveStart()).not.toThrow();
  });

  it('playWaveClear() should not throw without AudioContext', () => {
    expect(() => service.playWaveClear()).not.toThrow();
  });

  it('playGoldEarned() should not throw without AudioContext', () => {
    expect(() => service.playGoldEarned()).not.toThrow();
  });

  it('playTowerPlace() should not throw without AudioContext', () => {
    expect(() => service.playTowerPlace()).not.toThrow();
  });

  it('playTowerUpgrade() should not throw without AudioContext', () => {
    expect(() => service.playTowerUpgrade()).not.toThrow();
  });

  it('playTowerSell() should not throw without AudioContext', () => {
    expect(() => service.playTowerSell()).not.toThrow();
  });

  it('playDefeat() should not throw without AudioContext', () => {
    expect(() => service.playDefeat()).not.toThrow();
  });

  it('playVictory() should not throw without AudioContext', () => {
    expect(() => service.playVictory()).not.toThrow();
  });

  // --- Sound methods: muted state ---

  it('playTowerFire() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playTowerFire(TowerType.BASIC)).not.toThrow();
  });

  it('playEnemyHit() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playEnemyHit()).not.toThrow();
  });

  it('playEnemyDeath() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playEnemyDeath()).not.toThrow();
  });

  it('playWaveStart() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playWaveStart()).not.toThrow();
  });

  it('playWaveClear() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playWaveClear()).not.toThrow();
  });

  it('playGoldEarned() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playGoldEarned()).not.toThrow();
  });

  it('playTowerPlace() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playTowerPlace()).not.toThrow();
  });

  it('playTowerUpgrade() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playTowerUpgrade()).not.toThrow();
  });

  it('playTowerSell() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playTowerSell()).not.toThrow();
  });

  it('playVictory() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playVictory()).not.toThrow();
  });

  it('playDefeat() should not throw when muted', () => {
    service.toggleMute();
    expect(() => service.playDefeat()).not.toThrow();
  });

  // --- EnemyHit throttle ---

  it('playEnemyHit() should throttle rapid calls without throwing', () => {
    // Fire 10 rapid hits — only the first should pass through the throttle
    expect(() => {
      for (let i = 0; i < 10; i++) {
        service.playEnemyHit();
      }
    }).not.toThrow();
  });
});
