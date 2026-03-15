import {
  PlayerProfileService,
  PlayerProfile,
  GameEndStats,
  ACHIEVEMENTS,
} from './player-profile.service';
import { MapScoreRecord } from '../models/score.model';
import { DifficultyLevel } from '../models/game-state.model';

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
        mapScores: {},
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

  // ── recordMapScore ─────────────────────────────────────────────────────────

  describe('recordMapScore', () => {
    it('saves a new score for a map that has no existing record', () => {
      service.recordMapScore('map_1', 1500, 3, DifficultyLevel.NORMAL);
      const record = service.getMapScore('map_1');
      expect(record).not.toBeNull();
      expect(record!.mapId).toBe('map_1');
      expect(record!.bestScore).toBe(1500);
      expect(record!.bestStars).toBe(3);
      expect(record!.difficulty).toBe(DifficultyLevel.NORMAL);
    });

    it('updates the record when new score is higher', () => {
      service.recordMapScore('map_1', 1000, 2, DifficultyLevel.NORMAL);
      service.recordMapScore('map_1', 2000, 3, DifficultyLevel.HARD);
      const record = service.getMapScore('map_1');
      expect(record!.bestScore).toBe(2000);
      expect(record!.bestStars).toBe(3);
      expect(record!.difficulty).toBe(DifficultyLevel.HARD);
    });

    it('does NOT update the record when new score is lower', () => {
      service.recordMapScore('map_1', 2000, 3, DifficultyLevel.HARD);
      service.recordMapScore('map_1', 500, 1, DifficultyLevel.EASY);
      const record = service.getMapScore('map_1');
      expect(record!.bestScore).toBe(2000);
    });

    it('keeps best stars even when new score is lower', () => {
      service.recordMapScore('map_1', 3000, 3, DifficultyLevel.HARD);
      service.recordMapScore('map_1', 1000, 1, DifficultyLevel.EASY);
      // New score is lower so no update — stars remain at 3
      expect(service.getMapScore('map_1')!.bestStars).toBe(3);
    });

    it('takes the max of stars when a higher score has fewer stars', () => {
      // This edge case: if score increases but stars decrease, bestStars should
      // keep the higher value. Set up by lowering stars artificially.
      service.recordMapScore('map_1', 1000, 3, DifficultyLevel.NORMAL);
      // Override internal state manually via a second call with higher score
      service.recordMapScore('map_1', 5000, 1, DifficultyLevel.NIGHTMARE);
      const record = service.getMapScore('map_1');
      // Higher score wins, but bestStars is max(1, 3) = 3
      expect(record!.bestScore).toBe(5000);
      expect(record!.bestStars).toBe(3);
    });

    it('persists to localStorage', () => {
      service.recordMapScore('map_1', 1500, 2, DifficultyLevel.NORMAL);
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.mapScores?.['map_1']?.bestScore).toBe(1500);
    });

    it('tracks multiple maps independently', () => {
      service.recordMapScore('map_1', 1000, 2, DifficultyLevel.NORMAL);
      service.recordMapScore('map_2', 2000, 3, DifficultyLevel.HARD);
      expect(service.getMapScore('map_1')!.bestScore).toBe(1000);
      expect(service.getMapScore('map_2')!.bestScore).toBe(2000);
    });
  });

  // ── getMapScore ────────────────────────────────────────────────────────────

  describe('getMapScore', () => {
    it('returns null for unknown map', () => {
      expect(service.getMapScore('nonexistent_map')).toBeNull();
    });

    it('returns the record after recording a score', () => {
      service.recordMapScore('map_abc', 999, 1, DifficultyLevel.EASY);
      const record = service.getMapScore('map_abc');
      expect(record).not.toBeNull();
      expect(record!.bestScore).toBe(999);
    });
  });

  // ── getAllMapScores ─────────────────────────────────────────────────────────

  describe('getAllMapScores', () => {
    it('returns empty object when no scores recorded', () => {
      expect(service.getAllMapScores()).toEqual({});
    });

    it('returns all recorded map scores', () => {
      service.recordMapScore('map_1', 1000, 2, DifficultyLevel.NORMAL);
      service.recordMapScore('map_2', 2000, 3, DifficultyLevel.HARD);
      const all = service.getAllMapScores();
      expect(Object.keys(all).length).toBe(2);
      expect(all['map_1'].bestScore).toBe(1000);
      expect(all['map_2'].bestScore).toBe(2000);
    });

    it('returns a copy — mutations do not affect internal state', () => {
      service.recordMapScore('map_1', 1000, 2, DifficultyLevel.NORMAL);
      const all = service.getAllMapScores();
      all['map_1'].bestScore = 9999;
      expect(service.getMapScore('map_1')!.bestScore).toBe(1000);
    });
  });

  // ── reset clears mapScores ─────────────────────────────────────────────────

  describe('reset clears mapScores', () => {
    it('reset removes all map scores', () => {
      service.recordMapScore('map_1', 1000, 2, DifficultyLevel.NORMAL);
      service.reset();
      expect(service.getMapScore('map_1')).toBeNull();
      expect(service.getAllMapScores()).toEqual({});
    });
  });

  // ── load handles mapScores ──────────────────────────────────────────────────

  describe('localStorage mapScores persistence', () => {
    it('loads persisted mapScores on construction', () => {
      const mapScore: MapScoreRecord = {
        mapId: 'map_1',
        bestScore: 1500,
        bestStars: 2,
        difficulty: DifficultyLevel.NORMAL,
        completedAt: 1700000000000,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        totalGamesPlayed: 1,
        achievements: [],
        mapScores: { map_1: mapScore },
      }));
      const fresh = new PlayerProfileService();
      const record = fresh.getMapScore('map_1');
      expect(record).not.toBeNull();
      expect(record!.bestScore).toBe(1500);
      expect(record!.bestStars).toBe(2);
    });

    it('handles missing mapScores field in saved data gracefully', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ totalGamesPlayed: 3, achievements: [] }));
      const fresh = new PlayerProfileService();
      expect(fresh.getAllMapScores()).toEqual({});
    });

    it('handles null mapScores in saved data gracefully', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ achievements: [], mapScores: null }));
      const fresh = new PlayerProfileService();
      expect(fresh.getAllMapScores()).toEqual({});
    });

    it('handles array mapScores (corrupt data) gracefully', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ achievements: [], mapScores: ['bad'] }));
      const fresh = new PlayerProfileService();
      expect(fresh.getAllMapScores()).toEqual({});
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
});
