import {
  PlayerProfileService,
  PlayerProfile,
  GameEndStats,
  ACHIEVEMENTS,
} from './player-profile.service';

const STORAGE_KEY = 'novarise-profile';

function makeStats(overrides: Partial<GameEndStats> = {}): GameEndStats {
  return {
    isVictory: true,
    score: 100,
    enemiesKilled: 10,
    goldEarned: 200,
    wavesCompleted: 5,
    livesLost: 0,
    ...overrides,
  };
}

describe('PlayerProfileService', () => {
  let service: PlayerProfileService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    service = new PlayerProfileService();
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  // ── Default state ──────────────────────────────────────────────────────────

  describe('default profile', () => {
    it('should have all zeros and empty achievements', () => {
      const p = service.getProfile();
      expect(p.totalGamesPlayed).toBe(0);
      expect(p.totalVictories).toBe(0);
      expect(p.totalDefeats).toBe(0);
      expect(p.totalEnemiesKilled).toBe(0);
      expect(p.totalGoldEarned).toBe(0);
      expect(p.highestWaveReached).toBe(0);
      expect(p.highestScore).toBe(0);
      expect(p.achievements).toEqual([]);
    });
  });

  // ── recordGameEnd — stat updates ───────────────────────────────────────────

  describe('recordGameEnd — stat updates', () => {
    it('increments totalGamesPlayed on victory', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      expect(service.getProfile().totalGamesPlayed).toBe(1);
    });

    it('increments totalGamesPlayed on defeat', () => {
      service.recordGameEnd(makeStats({ isVictory: false }));
      expect(service.getProfile().totalGamesPlayed).toBe(1);
    });

    it('increments totalVictories on victory', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      expect(service.getProfile().totalVictories).toBe(1);
    });

    it('increments totalDefeats on defeat', () => {
      service.recordGameEnd(makeStats({ isVictory: false }));
      expect(service.getProfile().totalDefeats).toBe(1);
    });

    it('does not increment totalVictories on defeat', () => {
      service.recordGameEnd(makeStats({ isVictory: false }));
      expect(service.getProfile().totalVictories).toBe(0);
    });

    it('accumulates totalEnemiesKilled across games', () => {
      service.recordGameEnd(makeStats({ enemiesKilled: 30 }));
      service.recordGameEnd(makeStats({ enemiesKilled: 50 }));
      expect(service.getProfile().totalEnemiesKilled).toBe(80);
    });

    it('accumulates totalGoldEarned across games', () => {
      service.recordGameEnd(makeStats({ goldEarned: 300 }));
      service.recordGameEnd(makeStats({ goldEarned: 700 }));
      expect(service.getProfile().totalGoldEarned).toBe(1000);
    });

    it('tracks highestWaveReached as a max, not a sum', () => {
      service.recordGameEnd(makeStats({ wavesCompleted: 8 }));
      service.recordGameEnd(makeStats({ wavesCompleted: 5 }));
      expect(service.getProfile().highestWaveReached).toBe(8);
    });

    it('updates highestWaveReached when new value is greater', () => {
      service.recordGameEnd(makeStats({ wavesCompleted: 3 }));
      service.recordGameEnd(makeStats({ wavesCompleted: 12 }));
      expect(service.getProfile().highestWaveReached).toBe(12);
    });

    it('tracks highestScore as a max, not a sum', () => {
      service.recordGameEnd(makeStats({ score: 4000 }));
      service.recordGameEnd(makeStats({ score: 2000 }));
      expect(service.getProfile().highestScore).toBe(4000);
    });

    it('persists stats to localStorage', () => {
      service.recordGameEnd(makeStats({ score: 999, enemiesKilled: 7 }));
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as PlayerProfile;
      expect(parsed.highestScore).toBe(999);
      expect(parsed.totalEnemiesKilled).toBe(7);
    });
  });

  // ── recordGameEnd — achievements ───────────────────────────────────────────

  describe('recordGameEnd — achievement unlocks', () => {
    it('returns newly unlocked achievement IDs', () => {
      const unlocked = service.recordGameEnd(makeStats({ isVictory: true }));
      expect(unlocked).toContain('first_victory');
    });

    it('does not return already-unlocked achievements', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      const secondUnlock = service.recordGameEnd(makeStats({ isVictory: true }));
      expect(secondUnlock).not.toContain('first_victory');
    });

    it('multiple achievements can unlock in one game', () => {
      const unlocked = service.recordGameEnd(
        makeStats({
          isVictory: true,
          score: 6000,
          goldEarned: 10_000,
          enemiesKilled: 1000,
          livesLost: 0,
        })
      );
      expect(unlocked).toContain('first_victory');
      expect(unlocked).toContain('high_scorer');
      expect(unlocked).toContain('gold_hoarder');
      expect(unlocked).toContain('exterminator');
      expect(unlocked).toContain('perfectionist');
    });

    it('adds unlocked IDs to profile.achievements', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      expect(service.getProfile().achievements).toContain('first_victory');
    });

    it('unlocks veteran after 10 games', () => {
      for (let i = 0; i < 9; i++) {
        service.recordGameEnd(makeStats({ isVictory: false }));
      }
      expect(service.getProfile().achievements).not.toContain('veteran');
      service.recordGameEnd(makeStats({ isVictory: false }));
      expect(service.getProfile().achievements).toContain('veteran');
    });

    it('unlocks gold_hoarder when cumulative gold reaches 10,000', () => {
      service.recordGameEnd(makeStats({ goldEarned: 9_999 }));
      expect(service.getProfile().achievements).not.toContain('gold_hoarder');
      service.recordGameEnd(makeStats({ goldEarned: 1 }));
      expect(service.getProfile().achievements).toContain('gold_hoarder');
    });

    it('unlocks exterminator when cumulative kills reach 1,000', () => {
      service.recordGameEnd(makeStats({ enemiesKilled: 999 }));
      expect(service.getProfile().achievements).not.toContain('exterminator');
      service.recordGameEnd(makeStats({ enemiesKilled: 1 }));
      expect(service.getProfile().achievements).toContain('exterminator');
    });

    it('unlocks survivor when highestWaveReached reaches 20', () => {
      service.recordGameEnd(makeStats({ wavesCompleted: 19 }));
      expect(service.getProfile().achievements).not.toContain('survivor');
      service.recordGameEnd(makeStats({ wavesCompleted: 20 }));
      expect(service.getProfile().achievements).toContain('survivor');
    });

    it('unlocks high_scorer when highestScore reaches 5,000', () => {
      service.recordGameEnd(makeStats({ score: 4999 }));
      expect(service.getProfile().achievements).not.toContain('high_scorer');
      service.recordGameEnd(makeStats({ score: 5000 }));
      expect(service.getProfile().achievements).toContain('high_scorer');
    });

    it('unlocks dedicated after 25 victories', () => {
      for (let i = 0; i < 24; i++) {
        service.recordGameEnd(makeStats({ isVictory: true }));
      }
      expect(service.getProfile().achievements).not.toContain('dedicated');
      service.recordGameEnd(makeStats({ isVictory: true }));
      expect(service.getProfile().achievements).toContain('dedicated');
    });
  });

  // ── Perfectionist ──────────────────────────────────────────────────────────

  describe('perfectionist achievement', () => {
    it('unlocks on no-lives-lost victory', () => {
      const unlocked = service.recordGameEnd(
        makeStats({ isVictory: true, livesLost: 0 })
      );
      expect(unlocked).toContain('perfectionist');
      expect(service.getProfile().achievements).toContain('perfectionist');
    });

    it('does not unlock when lives were lost', () => {
      const unlocked = service.recordGameEnd(
        makeStats({ isVictory: true, livesLost: 1 })
      );
      expect(unlocked).not.toContain('perfectionist');
      expect(service.getProfile().achievements).not.toContain('perfectionist');
    });

    it('does not unlock on defeat even with livesLost 0', () => {
      const unlocked = service.recordGameEnd(
        makeStats({ isVictory: false, livesLost: 0 })
      );
      expect(unlocked).not.toContain('perfectionist');
    });

    it('does not return perfectionist again once already unlocked', () => {
      service.recordGameEnd(makeStats({ isVictory: true, livesLost: 0 }));
      const second = service.recordGameEnd(
        makeStats({ isVictory: true, livesLost: 0 })
      );
      expect(second).not.toContain('perfectionist');
    });
  });

  // ── getAchievements / getUnlocked / getLocked ──────────────────────────────

  describe('achievement query methods', () => {
    it('getAchievements returns all defined achievements', () => {
      const all = service.getAchievements();
      expect(all.length).toBe(ACHIEVEMENTS.length);
    });

    it('getUnlockedAchievements returns only unlocked ones', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      const unlocked = service.getUnlockedAchievements();
      expect(unlocked.every((a) => service.getProfile().achievements.includes(a.id))).toBe(true);
    });

    it('getLockedAchievements returns only locked ones', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      const locked = service.getLockedAchievements();
      expect(locked.every((a) => !service.getProfile().achievements.includes(a.id))).toBe(true);
    });

    it('unlocked + locked = all achievements', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      const total =
        service.getUnlockedAchievements().length +
        service.getLockedAchievements().length;
      expect(total).toBe(ACHIEVEMENTS.length);
    });

    it('initially all achievements are locked', () => {
      expect(service.getLockedAchievements().length).toBe(ACHIEVEMENTS.length);
      expect(service.getUnlockedAchievements().length).toBe(0);
    });
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears all profile data to defaults', () => {
      service.recordGameEnd(
        makeStats({ isVictory: true, score: 9999, enemiesKilled: 500, goldEarned: 5000 })
      );
      service.reset();
      const p = service.getProfile();
      expect(p.totalGamesPlayed).toBe(0);
      expect(p.totalVictories).toBe(0);
      expect(p.totalDefeats).toBe(0);
      expect(p.totalEnemiesKilled).toBe(0);
      expect(p.totalGoldEarned).toBe(0);
      expect(p.highestWaveReached).toBe(0);
      expect(p.highestScore).toBe(0);
      expect(p.achievements).toEqual([]);
    });

    it('removes data from localStorage', () => {
      service.recordGameEnd(makeStats());
      service.reset();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('re-records correctly after reset', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      service.reset();
      service.recordGameEnd(makeStats({ isVictory: true }));
      expect(service.getProfile().totalGamesPlayed).toBe(1);
    });
  });

  // ── localStorage persistence ───────────────────────────────────────────────

  describe('localStorage persistence', () => {
    it('loads persisted profile on construction', () => {
      const saved: PlayerProfile = {
        totalGamesPlayed: 7,
        totalVictories: 3,
        totalDefeats: 4,
        totalEnemiesKilled: 250,
        totalGoldEarned: 3000,
        highestWaveReached: 8,
        highestScore: 2500,
        achievements: ['first_victory'],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      const fresh = new PlayerProfileService();
      const p = fresh.getProfile();
      expect(p.totalGamesPlayed).toBe(7);
      expect(p.totalVictories).toBe(3);
      expect(p.achievements).toContain('first_victory');
    });

    it('handles corrupt localStorage JSON gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json{{');
      const fresh = new PlayerProfileService();
      const p = fresh.getProfile();
      expect(p.totalGamesPlayed).toBe(0);
      expect(p.achievements).toEqual([]);
    });

    it('handles missing localStorage entry gracefully', () => {
      localStorage.removeItem(STORAGE_KEY);
      const fresh = new PlayerProfileService();
      expect(fresh.getProfile().totalGamesPlayed).toBe(0);
    });

    it('handles stored object with non-array achievements gracefully', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ totalGamesPlayed: 5, achievements: null })
      );
      const fresh = new PlayerProfileService();
      expect(fresh.getProfile().achievements).toEqual([]);
    });

    it('caps achievements array to ACHIEVEMENTS.length on load', () => {
      const oversized = Array.from({ length: 100 }, (_, i) => `achievement_${i}`);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ achievements: oversized })
      );
      const fresh = new PlayerProfileService();
      expect(fresh.getProfile().achievements.length).toBe(ACHIEVEMENTS.length);
    });

    it('merges partial saved data with defaults', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ totalGamesPlayed: 3 })
      );
      const fresh = new PlayerProfileService();
      const p = fresh.getProfile();
      expect(p.totalGamesPlayed).toBe(3);
      expect(p.totalVictories).toBe(0); // default filled in
    });
  });

  // ── getProfile immutability ────────────────────────────────────────────────

  describe('getProfile immutability', () => {
    it('returns a copy — mutations do not affect internal state', () => {
      const p = service.getProfile();
      p.totalGamesPlayed = 999;
      expect(service.getProfile().totalGamesPlayed).toBe(0);
    });

    it('returns a copied achievements array — push does not affect internal state', () => {
      const p = service.getProfile();
      p.achievements.push('fake_achievement');
      expect(service.getProfile().achievements).not.toContain('fake_achievement');
    });
  });

  // ── isUnlocked (pre-computed Set) ─────────────────────────────────────────

  describe('isUnlocked — pre-computed Set', () => {
    it('returns false for all achievements on a fresh profile', () => {
      for (const a of ACHIEVEMENTS) {
        expect(service.isUnlocked(a.id)).toBe(false);
      }
    });

    it('returns true after achievement is unlocked via recordGameEnd', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      expect(service.isUnlocked('first_victory')).toBe(true);
    });

    it('returns false for achievements not yet unlocked', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      expect(service.isUnlocked('veteran')).toBe(false);
    });

    it('resets to false for all achievements after reset()', () => {
      service.recordGameEnd(makeStats({ isVictory: true }));
      expect(service.isUnlocked('first_victory')).toBe(true);
      service.reset();
      expect(service.isUnlocked('first_victory')).toBe(false);
    });

    it('reflects achievements loaded from localStorage', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          totalGamesPlayed: 1,
          totalVictories: 1,
          achievements: ['first_victory', 'high_scorer'],
        })
      );
      const fresh = new PlayerProfileService();
      expect(fresh.isUnlocked('first_victory')).toBe(true);
      expect(fresh.isUnlocked('high_scorer')).toBe(true);
      expect(fresh.isUnlocked('veteran')).toBe(false);
    });

    it('returns false for unknown achievement IDs', () => {
      expect(service.isUnlocked('nonexistent_achievement')).toBe(false);
    });
  });

  // ── save failure logging ──────────────────────────────────────────────────

  describe('save failure logging', () => {
    it('should log warning on QuotaExceededError', () => {
      spyOn(localStorage, 'setItem').and.callFake(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });
      spyOn(console, 'warn');

      service.recordGameEnd(makeStats());

      expect(console.warn).toHaveBeenCalledWith(
        jasmine.stringContaining('quota exceeded')
      );
    });
  });
});
