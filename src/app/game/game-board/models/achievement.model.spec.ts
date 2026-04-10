import {
  ACHIEVEMENTS,
  Achievement,
  AchievementCategory,
  PlayerProfile,
  mapCompleted,
  allMapsCompleted,
  countThreeStarCampaignMaps,
  totalCampaignStars,
  ACT_1_MAP_IDS,
  ACT_2_MAP_IDS,
  ACT_3_MAP_IDS,
  CAMPAIGN_CHAMPION_MAP_IDS,
  ALL_CAMPAIGN_MAP_COUNT,
  VETERAN_GAMES_THRESHOLD,
  GOLD_HOARDER_THRESHOLD,
  EXTERMINATOR_KILLS_THRESHOLD,
  SURVIVOR_WAVE_THRESHOLD,
  HIGH_SCORER_THRESHOLD,
  DEDICATED_VICTORIES_THRESHOLD,
  SNIPER_ELITE_KILLS_THRESHOLD,
  CHAIN_MASTER_KILLS_THRESHOLD,
  SLOW_STEADY_APPLICATIONS_THRESHOLD,
  TOWER_COLLECTOR_TYPE_COUNT,
  ENDLESS_ENDURANCE_WAVE,
  ENDLESS_MARATHON_WAVE,
  ENDLESS_IMMORTAL_WAVE,
  CHALLENGER_COMPLETIONS_THRESHOLD,
  TOTAL_CAMPAIGN_CHALLENGES,
  MODIFIER_VICTORY_THRESHOLD,
  STAR_COLLECTOR_THRESHOLD,
  THREE_STAR_MAPS_THRESHOLD,
} from './achievement.model';
import { MapScoreRecord } from './score.model';
import { DifficultyLevel } from './game-state.model';

const VALID_CATEGORIES: AchievementCategory[] = ['campaign', 'combat', 'endless', 'challenge'];

function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    totalGamesPlayed: 0,
    totalVictories: 0,
    totalDefeats: 0,
    totalEnemiesKilled: 0,
    totalGoldEarned: 0,
    highestWaveReached: 0,
    highestScore: 0,
    achievements: [],
    mapScores: {},
    towerKills: {},
    slowEffectsApplied: 0,
    hasUsedSpecialization: false,
    hasPlacedAllTowerTypes: false,
    maxModifiersUsedInVictory: 0,
    completedChallengeCount: 0,
    ascentRunsAttempted: 0,
    ascentRunsCompleted: 0,
    highestAscensionBeaten: 0,
    ascentTotalKills: 0,
    ascentBestScore: 0,
    ...overrides,
  };
}

function makeMapScore(mapId: string, bestStars: number, bestScore = 1000): MapScoreRecord {
  return { mapId, bestStars, bestScore, difficulty: DifficultyLevel.NORMAL, completedAt: Date.now() };
}

function completedMapScores(mapIds: readonly string[], stars = 1): Record<string, MapScoreRecord> {
  const scores: Record<string, MapScoreRecord> = {};
  for (const id of mapIds) {
    scores[id] = makeMapScore(id, stars);
  }
  return scores;
}

describe('achievement.model', () => {

  // ── Structural invariants ──────────────────────────────────────────────────

  describe('ACHIEVEMENTS array', () => {
    it('should have exactly 26 entries', () => {
      expect(ACHIEVEMENTS.length).toBe(26);
    });

    it('all 26 achievements should have unique IDs', () => {
      const ids = ACHIEVEMENTS.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all achievements should have valid categories', () => {
      for (const achievement of ACHIEVEMENTS) {
        expect(VALID_CATEGORIES).toContain(achievement.category as AchievementCategory);
      }
    });

    it('all achievements should have non-empty name and description', () => {
      for (const achievement of ACHIEVEMENTS) {
        expect(achievement.name.length).toBeGreaterThan(0);
        expect(achievement.description.length).toBeGreaterThan(0);
      }
    });

    it('all achievements should have a condition function', () => {
      for (const achievement of ACHIEVEMENTS) {
        expect(typeof achievement.condition).toBe('function');
      }
    });
  });

  // ── Map ID arrays ─────────────────────────────────────────────────────────

  describe('map ID arrays', () => {
    it('ACT_1_MAP_IDS should contain 4 entries starting at campaign_01', () => {
      expect(ACT_1_MAP_IDS.length).toBe(4);
      expect(ACT_1_MAP_IDS[0]).toBe('campaign_01');
      expect(ACT_1_MAP_IDS[3]).toBe('campaign_04');
    });

    it('ACT_2_MAP_IDS should contain 4 entries from campaign_05 to campaign_08', () => {
      expect(ACT_2_MAP_IDS.length).toBe(4);
      expect(ACT_2_MAP_IDS[0]).toBe('campaign_05');
      expect(ACT_2_MAP_IDS[3]).toBe('campaign_08');
    });

    it('ACT_3_MAP_IDS should contain 4 entries from campaign_09 to campaign_12', () => {
      expect(ACT_3_MAP_IDS.length).toBe(4);
      expect(ACT_3_MAP_IDS[0]).toBe('campaign_09');
      expect(ACT_3_MAP_IDS[3]).toBe('campaign_12');
    });

    it('CAMPAIGN_CHAMPION_MAP_IDS should contain ALL_CAMPAIGN_MAP_COUNT entries', () => {
      expect(CAMPAIGN_CHAMPION_MAP_IDS.length).toBe(ALL_CAMPAIGN_MAP_COUNT);
      expect(CAMPAIGN_CHAMPION_MAP_IDS[0]).toBe('campaign_01');
      expect(CAMPAIGN_CHAMPION_MAP_IDS[ALL_CAMPAIGN_MAP_COUNT - 1]).toBe(`campaign_${ALL_CAMPAIGN_MAP_COUNT}`);
    });

    it('CAMPAIGN_CHAMPION_MAP_IDS IDs should be zero-padded correctly', () => {
      expect(CAMPAIGN_CHAMPION_MAP_IDS[0]).toBe('campaign_01');
      expect(CAMPAIGN_CHAMPION_MAP_IDS[8]).toBe('campaign_09');
      expect(CAMPAIGN_CHAMPION_MAP_IDS[9]).toBe('campaign_10');
    });

    it('ALL_CAMPAIGN_MAP_COUNT should be 16', () => {
      expect(ALL_CAMPAIGN_MAP_COUNT).toBe(16);
    });
  });

  // ── Threshold constants ───────────────────────────────────────────────────

  describe('threshold constants', () => {
    it('VETERAN_GAMES_THRESHOLD should be 10', () => {
      expect(VETERAN_GAMES_THRESHOLD).toBe(10);
    });

    it('GOLD_HOARDER_THRESHOLD should be 10000', () => {
      expect(GOLD_HOARDER_THRESHOLD).toBe(10_000);
    });

    it('EXTERMINATOR_KILLS_THRESHOLD should be 1000', () => {
      expect(EXTERMINATOR_KILLS_THRESHOLD).toBe(1_000);
    });

    it('SURVIVOR_WAVE_THRESHOLD should be 20', () => {
      expect(SURVIVOR_WAVE_THRESHOLD).toBe(20);
    });

    it('HIGH_SCORER_THRESHOLD should be 5000', () => {
      expect(HIGH_SCORER_THRESHOLD).toBe(5_000);
    });

    it('DEDICATED_VICTORIES_THRESHOLD should be 25', () => {
      expect(DEDICATED_VICTORIES_THRESHOLD).toBe(25);
    });

    it('SNIPER_ELITE_KILLS_THRESHOLD should be 500', () => {
      expect(SNIPER_ELITE_KILLS_THRESHOLD).toBe(500);
    });

    it('CHAIN_MASTER_KILLS_THRESHOLD should be 300', () => {
      expect(CHAIN_MASTER_KILLS_THRESHOLD).toBe(300);
    });

    it('SLOW_STEADY_APPLICATIONS_THRESHOLD should be 1000', () => {
      expect(SLOW_STEADY_APPLICATIONS_THRESHOLD).toBe(1_000);
    });

    it('TOWER_COLLECTOR_TYPE_COUNT should be 6', () => {
      expect(TOWER_COLLECTOR_TYPE_COUNT).toBe(6);
    });

    it('ENDLESS_ENDURANCE_WAVE should be 30', () => {
      expect(ENDLESS_ENDURANCE_WAVE).toBe(30);
    });

    it('ENDLESS_MARATHON_WAVE should be 50', () => {
      expect(ENDLESS_MARATHON_WAVE).toBe(50);
    });

    it('ENDLESS_IMMORTAL_WAVE should be 100', () => {
      expect(ENDLESS_IMMORTAL_WAVE).toBe(100);
    });

    it('CHALLENGER_COMPLETIONS_THRESHOLD should be 5', () => {
      expect(CHALLENGER_COMPLETIONS_THRESHOLD).toBe(5);
    });

    it('TOTAL_CAMPAIGN_CHALLENGES should be 41', () => {
      expect(TOTAL_CAMPAIGN_CHALLENGES).toBe(41);
    });

    it('MODIFIER_VICTORY_THRESHOLD should be 3', () => {
      expect(MODIFIER_VICTORY_THRESHOLD).toBe(3);
    });

    it('STAR_COLLECTOR_THRESHOLD should be 10', () => {
      expect(STAR_COLLECTOR_THRESHOLD).toBe(10);
    });

    it('THREE_STAR_MAPS_THRESHOLD should be 5', () => {
      expect(THREE_STAR_MAPS_THRESHOLD).toBe(5);
    });
  });

  // ── Helper functions ──────────────────────────────────────────────────────

  describe('mapCompleted', () => {
    it('should return false when map has no score record', () => {
      const profile = makeProfile();
      expect(mapCompleted(profile, 'campaign_01')).toBeFalse();
    });

    it('should return false when bestStars is 0', () => {
      const profile = makeProfile({
        mapScores: { campaign_01: makeMapScore('campaign_01', 0) },
      });
      expect(mapCompleted(profile, 'campaign_01')).toBeFalse();
    });

    it('should return true when bestStars is 1 or more', () => {
      const profile = makeProfile({
        mapScores: { campaign_01: makeMapScore('campaign_01', 1) },
      });
      expect(mapCompleted(profile, 'campaign_01')).toBeTrue();
    });

    it('should return true when bestStars is 3', () => {
      const profile = makeProfile({
        mapScores: { campaign_01: makeMapScore('campaign_01', 3) },
      });
      expect(mapCompleted(profile, 'campaign_01')).toBeTrue();
    });
  });

  describe('allMapsCompleted', () => {
    it('should return false when no maps are completed', () => {
      const profile = makeProfile();
      expect(allMapsCompleted(profile, ACT_1_MAP_IDS)).toBeFalse();
    });

    it('should return false when only some maps are completed', () => {
      const profile = makeProfile({
        mapScores: { campaign_01: makeMapScore('campaign_01', 1) },
      });
      expect(allMapsCompleted(profile, ACT_1_MAP_IDS)).toBeFalse();
    });

    it('should return true when all specified maps are completed', () => {
      const profile = makeProfile({
        mapScores: completedMapScores(ACT_1_MAP_IDS),
      });
      expect(allMapsCompleted(profile, ACT_1_MAP_IDS)).toBeTrue();
    });

    it('should return true for an empty array', () => {
      const profile = makeProfile();
      expect(allMapsCompleted(profile, [])).toBeTrue();
    });
  });

  describe('countThreeStarCampaignMaps', () => {
    it('should return 0 when no maps have 3 stars', () => {
      const profile = makeProfile({
        mapScores: completedMapScores(ACT_1_MAP_IDS, 2),
      });
      expect(countThreeStarCampaignMaps(profile)).toBe(0);
    });

    it('should count only campaign maps with 3 stars', () => {
      const profile = makeProfile({
        mapScores: {
          ...completedMapScores(['campaign_01', 'campaign_02'], 3),
          ...completedMapScores(['campaign_03'], 2),
          custom_map: makeMapScore('custom_map', 3), // non-campaign should not count
        },
      });
      expect(countThreeStarCampaignMaps(profile)).toBe(2);
    });

    it('should count all 16 campaign maps if all have 3 stars', () => {
      const profile = makeProfile({
        mapScores: completedMapScores(CAMPAIGN_CHAMPION_MAP_IDS, 3),
      });
      expect(countThreeStarCampaignMaps(profile)).toBe(ALL_CAMPAIGN_MAP_COUNT);
    });
  });

  describe('totalCampaignStars', () => {
    it('should return 0 when no campaign maps are completed', () => {
      const profile = makeProfile();
      expect(totalCampaignStars(profile)).toBe(0);
    });

    it('should sum stars only for campaign maps', () => {
      const profile = makeProfile({
        mapScores: {
          campaign_01: makeMapScore('campaign_01', 3),
          campaign_02: makeMapScore('campaign_02', 2),
          custom_map: makeMapScore('custom_map', 3), // should not count
        },
      });
      expect(totalCampaignStars(profile)).toBe(5);
    });

    it('should return the total for all 16 campaign maps at 3 stars each', () => {
      const profile = makeProfile({
        mapScores: completedMapScores(CAMPAIGN_CHAMPION_MAP_IDS, 3),
      });
      expect(totalCampaignStars(profile)).toBe(ALL_CAMPAIGN_MAP_COUNT * 3);
    });
  });

  // ── Achievement condition evaluations ─────────────────────────────────────

  describe('achievement conditions', () => {
    function getAchievement(id: string): Achievement {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a) throw new Error(`Achievement '${id}' not found`);
      return a;
    }

    describe('first_victory', () => {
      it('should be false with 0 victories', () => {
        expect(getAchievement('first_victory').condition(makeProfile())).toBeFalse();
      });

      it('should be true with 1 victory', () => {
        expect(getAchievement('first_victory').condition(makeProfile({ totalVictories: 1 }))).toBeTrue();
      });
    });

    describe('veteran', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('veteran').condition(makeProfile({ totalGamesPlayed: VETERAN_GAMES_THRESHOLD - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('veteran').condition(makeProfile({ totalGamesPlayed: VETERAN_GAMES_THRESHOLD }))).toBeTrue();
      });
    });

    describe('perfectionist', () => {
      it('should be false when achievement ID is not in profile.achievements', () => {
        expect(getAchievement('perfectionist').condition(makeProfile())).toBeFalse();
      });

      it('should be true when perfectionist is in profile.achievements', () => {
        expect(getAchievement('perfectionist').condition(makeProfile({ achievements: ['perfectionist'] }))).toBeTrue();
      });
    });

    describe('gold_hoarder', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('gold_hoarder').condition(makeProfile({ totalGoldEarned: GOLD_HOARDER_THRESHOLD - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('gold_hoarder').condition(makeProfile({ totalGoldEarned: GOLD_HOARDER_THRESHOLD }))).toBeTrue();
      });
    });

    describe('exterminator', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('exterminator').condition(makeProfile({ totalEnemiesKilled: EXTERMINATOR_KILLS_THRESHOLD - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('exterminator').condition(makeProfile({ totalEnemiesKilled: EXTERMINATOR_KILLS_THRESHOLD }))).toBeTrue();
      });
    });

    describe('survivor', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('survivor').condition(makeProfile({ highestWaveReached: SURVIVOR_WAVE_THRESHOLD - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('survivor').condition(makeProfile({ highestWaveReached: SURVIVOR_WAVE_THRESHOLD }))).toBeTrue();
      });

      it('should have category "endless"', () => {
        expect(getAchievement('survivor').category).toBe('endless');
      });
    });

    describe('high_scorer', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('high_scorer').condition(makeProfile({ highestScore: HIGH_SCORER_THRESHOLD - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('high_scorer').condition(makeProfile({ highestScore: HIGH_SCORER_THRESHOLD }))).toBeTrue();
      });
    });

    describe('dedicated', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('dedicated').condition(makeProfile({ totalVictories: DEDICATED_VICTORIES_THRESHOLD - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('dedicated').condition(makeProfile({ totalVictories: DEDICATED_VICTORIES_THRESHOLD }))).toBeTrue();
      });
    });

    describe('act_1_complete', () => {
      it('should be false with no maps completed', () => {
        expect(getAchievement('act_1_complete').condition(makeProfile())).toBeFalse();
      });

      it('should be true when all Act 1 maps are completed', () => {
        const profile = makeProfile({ mapScores: completedMapScores(ACT_1_MAP_IDS) });
        expect(getAchievement('act_1_complete').condition(profile)).toBeTrue();
      });

      it('should be false when only some Act 1 maps are completed', () => {
        const profile = makeProfile({
          mapScores: { campaign_01: makeMapScore('campaign_01', 1) },
        });
        expect(getAchievement('act_1_complete').condition(profile)).toBeFalse();
      });
    });

    describe('act_2_complete', () => {
      it('should be true when all Act 2 maps are completed', () => {
        const profile = makeProfile({ mapScores: completedMapScores(ACT_2_MAP_IDS) });
        expect(getAchievement('act_2_complete').condition(profile)).toBeTrue();
      });
    });

    describe('act_3_complete', () => {
      it('should be true when all Act 3 maps are completed', () => {
        const profile = makeProfile({ mapScores: completedMapScores(ACT_3_MAP_IDS) });
        expect(getAchievement('act_3_complete').condition(profile)).toBeTrue();
      });
    });

    describe('campaign_champion', () => {
      it('should be false without completing all 16 maps', () => {
        const profile = makeProfile({ mapScores: completedMapScores(ACT_1_MAP_IDS) });
        expect(getAchievement('campaign_champion').condition(profile)).toBeFalse();
      });

      it('should be true when all 16 campaign maps are completed', () => {
        const profile = makeProfile({ mapScores: completedMapScores(CAMPAIGN_CHAMPION_MAP_IDS) });
        expect(getAchievement('campaign_champion').condition(profile)).toBeTrue();
      });
    });

    describe('star_collector', () => {
      it('should be false below threshold', () => {
        const profile = makeProfile({ mapScores: completedMapScores(['campaign_01', 'campaign_02', 'campaign_03'], 3) });
        // 9 stars — below threshold of 10
        expect(getAchievement('star_collector').condition(profile)).toBeFalse();
      });

      it('should be true when total campaign stars reaches threshold', () => {
        const profile = makeProfile({ mapScores: completedMapScores(ACT_1_MAP_IDS, 3) });
        // 4 maps * 3 stars = 12 stars — above threshold of 10
        expect(getAchievement('star_collector').condition(profile)).toBeTrue();
      });
    });

    describe('three_star_5', () => {
      it('should be false with fewer than 5 three-star maps', () => {
        const profile = makeProfile({ mapScores: completedMapScores(['campaign_01', 'campaign_02', 'campaign_03', 'campaign_04'], 3) });
        expect(getAchievement('three_star_5').condition(profile)).toBeFalse();
      });

      it('should be true when 5 or more campaign maps have 3 stars', () => {
        const ids = CAMPAIGN_CHAMPION_MAP_IDS.slice(0, THREE_STAR_MAPS_THRESHOLD);
        const profile = makeProfile({ mapScores: completedMapScores(ids, 3) });
        expect(getAchievement('three_star_5').condition(profile)).toBeTrue();
      });
    });

    describe('three_star_all', () => {
      it('should be false when not all maps completed', () => {
        const profile = makeProfile({ mapScores: completedMapScores(ACT_1_MAP_IDS, 3) });
        expect(getAchievement('three_star_all').condition(profile)).toBeFalse();
      });

      it('should be true when all 16 campaign maps have 3 stars', () => {
        const profile = makeProfile({ mapScores: completedMapScores(CAMPAIGN_CHAMPION_MAP_IDS, 3) });
        expect(getAchievement('three_star_all').condition(profile)).toBeTrue();
      });

      it('should be false when all maps completed but some have fewer than 3 stars', () => {
        const scores = completedMapScores(CAMPAIGN_CHAMPION_MAP_IDS, 1);
        const profile = makeProfile({ mapScores: scores });
        expect(getAchievement('three_star_all').condition(profile)).toBeFalse();
      });
    });

    describe('sniper_elite', () => {
      it('should be false below threshold', () => {
        const profile = makeProfile({ towerKills: { sniper: SNIPER_ELITE_KILLS_THRESHOLD - 1 } });
        expect(getAchievement('sniper_elite').condition(profile)).toBeFalse();
      });

      it('should be true at threshold', () => {
        const profile = makeProfile({ towerKills: { sniper: SNIPER_ELITE_KILLS_THRESHOLD } });
        expect(getAchievement('sniper_elite').condition(profile)).toBeTrue();
      });

      it('should be false with no sniper kills recorded', () => {
        expect(getAchievement('sniper_elite').condition(makeProfile())).toBeFalse();
      });
    });

    describe('chain_master', () => {
      it('should be false below threshold', () => {
        const profile = makeProfile({ towerKills: { chain: CHAIN_MASTER_KILLS_THRESHOLD - 1 } });
        expect(getAchievement('chain_master').condition(profile)).toBeFalse();
      });

      it('should be true at threshold', () => {
        const profile = makeProfile({ towerKills: { chain: CHAIN_MASTER_KILLS_THRESHOLD } });
        expect(getAchievement('chain_master').condition(profile)).toBeTrue();
      });
    });

    describe('slow_and_steady', () => {
      it('should be false below threshold', () => {
        const profile = makeProfile({ slowEffectsApplied: SLOW_STEADY_APPLICATIONS_THRESHOLD - 1 });
        expect(getAchievement('slow_and_steady').condition(profile)).toBeFalse();
      });

      it('should be true at threshold', () => {
        const profile = makeProfile({ slowEffectsApplied: SLOW_STEADY_APPLICATIONS_THRESHOLD });
        expect(getAchievement('slow_and_steady').condition(profile)).toBeTrue();
      });
    });

    describe('specialist', () => {
      it('should be false when hasUsedSpecialization is false', () => {
        expect(getAchievement('specialist').condition(makeProfile())).toBeFalse();
      });

      it('should be true when hasUsedSpecialization is true', () => {
        expect(getAchievement('specialist').condition(makeProfile({ hasUsedSpecialization: true }))).toBeTrue();
      });
    });

    describe('tower_collector', () => {
      it('should be false when hasPlacedAllTowerTypes is false', () => {
        expect(getAchievement('tower_collector').condition(makeProfile())).toBeFalse();
      });

      it('should be true when hasPlacedAllTowerTypes is true', () => {
        expect(getAchievement('tower_collector').condition(makeProfile({ hasPlacedAllTowerTypes: true }))).toBeTrue();
      });
    });

    describe('endless_30', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('endless_30').condition(makeProfile({ highestWaveReached: ENDLESS_ENDURANCE_WAVE - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('endless_30').condition(makeProfile({ highestWaveReached: ENDLESS_ENDURANCE_WAVE }))).toBeTrue();
      });
    });

    describe('endless_50', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('endless_50').condition(makeProfile({ highestWaveReached: ENDLESS_MARATHON_WAVE - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('endless_50').condition(makeProfile({ highestWaveReached: ENDLESS_MARATHON_WAVE }))).toBeTrue();
      });
    });

    describe('endless_100', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('endless_100').condition(makeProfile({ highestWaveReached: ENDLESS_IMMORTAL_WAVE - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('endless_100').condition(makeProfile({ highestWaveReached: ENDLESS_IMMORTAL_WAVE }))).toBeTrue();
      });
    });

    describe('challenger_5', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('challenger_5').condition(makeProfile({ completedChallengeCount: CHALLENGER_COMPLETIONS_THRESHOLD - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('challenger_5').condition(makeProfile({ completedChallengeCount: CHALLENGER_COMPLETIONS_THRESHOLD }))).toBeTrue();
      });
    });

    describe('challenger_all', () => {
      it('should be false below total challenge count', () => {
        expect(getAchievement('challenger_all').condition(makeProfile({ completedChallengeCount: TOTAL_CAMPAIGN_CHALLENGES - 1 }))).toBeFalse();
      });

      it('should be true at total challenge count', () => {
        expect(getAchievement('challenger_all').condition(makeProfile({ completedChallengeCount: TOTAL_CAMPAIGN_CHALLENGES }))).toBeTrue();
      });
    });

    describe('modifier_victory', () => {
      it('should be false below threshold', () => {
        expect(getAchievement('modifier_victory').condition(makeProfile({ maxModifiersUsedInVictory: MODIFIER_VICTORY_THRESHOLD - 1 }))).toBeFalse();
      });

      it('should be true at threshold', () => {
        expect(getAchievement('modifier_victory').condition(makeProfile({ maxModifiersUsedInVictory: MODIFIER_VICTORY_THRESHOLD }))).toBeTrue();
      });
    });
  });

  // ── Category coverage ─────────────────────────────────────────────────────

  describe('category distribution', () => {
    it('should have achievements in all four categories', () => {
      for (const category of VALID_CATEGORIES) {
        const count = ACHIEVEMENTS.filter((a) => a.category === category).length;
        expect(count).toBeGreaterThan(0, `Expected at least one achievement in category '${category}'`);
      }
    });

    it('combat category should have the most achievements', () => {
      const combatCount = ACHIEVEMENTS.filter((a) => a.category === 'combat').length;
      expect(combatCount).toBe(12);
    });

    it('campaign category should have 7 achievements', () => {
      const count = ACHIEVEMENTS.filter((a) => a.category === 'campaign').length;
      expect(count).toBe(7);
    });

    it('endless category should have 4 achievements', () => {
      const count = ACHIEVEMENTS.filter((a) => a.category === 'endless').length;
      expect(count).toBe(4);
    });

    it('challenge category should have 3 achievements', () => {
      const count = ACHIEVEMENTS.filter((a) => a.category === 'challenge').length;
      expect(count).toBe(3);
    });
  });
});
