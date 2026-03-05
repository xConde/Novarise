import { TestBed } from '@angular/core/testing';
import { TowerUnlockService } from './tower-unlock.service';
import { TowerType } from '../models/tower.model';
import { TOWER_UNLOCK_CONDITIONS } from '../models/tower-unlock.model';
import { CampaignService, CampaignProgress } from '../../campaign/campaign.service';
import { PlayerProfileService, PlayerProfile } from './player-profile.service';

// ---- Helpers ----------------------------------------------------------------

function makeCampaignProgress(stars: Record<number, number> = {}): CampaignProgress {
  return { unlockedLevel: 1, stars, bestScores: {} };
}

function makeProfile(achievements: string[] = []): PlayerProfile {
  return {
    totalGamesPlayed: 0,
    totalVictories: 0,
    totalDefeats: 0,
    totalEnemiesKilled: 0,
    totalGoldEarned: 0,
    highestWaveReached: 0,
    highestScore: 0,
    achievements,
  };
}

// ---- Tests ------------------------------------------------------------------

describe('TowerUnlockService', () => {
  let service: TowerUnlockService;
  let campaignSpy: jasmine.SpyObj<CampaignService>;
  let profileSpy: jasmine.SpyObj<PlayerProfileService>;

  beforeEach(() => {
    campaignSpy = jasmine.createSpyObj<CampaignService>('CampaignService', ['getProgress']);
    profileSpy = jasmine.createSpyObj<PlayerProfileService>('PlayerProfileService', ['getProfile']);

    // Default: no campaign progress, no achievements
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress());
    profileSpy.getProfile.and.returnValue(makeProfile());

    TestBed.configureTestingModule({
      providers: [
        TowerUnlockService,
        { provide: CampaignService, useValue: campaignSpy },
        { provide: PlayerProfileService, useValue: profileSpy },
      ],
    });

    service = TestBed.inject(TowerUnlockService);
  });

  // --- Basic is always unlocked ---

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should always unlock BASIC tower regardless of progress', () => {
    expect(service.isTowerUnlocked(TowerType.BASIC)).toBeTrue();
  });

  // --- Non-basic towers locked with no progress ---

  it('should lock SNIPER when campaign level 1 is not completed', () => {
    expect(service.isTowerUnlocked(TowerType.SNIPER)).toBeFalse();
  });

  it('should lock SPLASH when campaign level 2 is not completed', () => {
    expect(service.isTowerUnlocked(TowerType.SPLASH)).toBeFalse();
  });

  it('should lock SLOW when campaign level 3 is not completed', () => {
    expect(service.isTowerUnlocked(TowerType.SLOW)).toBeFalse();
  });

  it('should lock CHAIN when campaign level 4 is not completed', () => {
    expect(service.isTowerUnlocked(TowerType.CHAIN)).toBeFalse();
  });

  it('should lock MORTAR when campaign level 5 is not completed', () => {
    expect(service.isTowerUnlocked(TowerType.MORTAR)).toBeFalse();
  });

  // --- Completing campaign levels unlocks towers ---

  it('should unlock SNIPER after completing campaign level 1 with at least 1 star', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 1: 1 }));
    expect(service.isTowerUnlocked(TowerType.SNIPER)).toBeTrue();
  });

  it('should unlock SPLASH after completing campaign level 2', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 2: 2 }));
    expect(service.isTowerUnlocked(TowerType.SPLASH)).toBeTrue();
  });

  it('should unlock SLOW after completing campaign level 3', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 3: 1 }));
    expect(service.isTowerUnlocked(TowerType.SLOW)).toBeTrue();
  });

  it('should unlock CHAIN after completing campaign level 4', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 4: 3 }));
    expect(service.isTowerUnlocked(TowerType.CHAIN)).toBeTrue();
  });

  it('should unlock MORTAR after completing campaign level 5', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 5: 1 }));
    expect(service.isTowerUnlocked(TowerType.MORTAR)).toBeTrue();
  });

  it('should not unlock SNIPER when campaign level 1 has 0 stars', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 1: 0 }));
    expect(service.isTowerUnlocked(TowerType.SNIPER)).toBeFalse();
  });

  // --- getUnlockedTowers ---

  it('getUnlockedTowers() should return only BASIC when no campaign progress', () => {
    const unlocked = service.getUnlockedTowers();
    expect(unlocked).toEqual([TowerType.BASIC]);
  });

  it('getUnlockedTowers() should return BASIC and SNIPER when level 1 completed', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 1: 1 }));
    const unlocked = service.getUnlockedTowers();
    expect(unlocked).toContain(TowerType.BASIC);
    expect(unlocked).toContain(TowerType.SNIPER);
    expect(unlocked.length).toBe(2);
  });

  it('getUnlockedTowers() should return all towers when all levels completed', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 1: 3, 2: 2, 3: 1, 4: 1, 5: 1 }));
    const unlocked = service.getUnlockedTowers();
    expect(unlocked.length).toBe(Object.values(TowerType).length);
  });

  // --- getLockedTowers ---

  it('getLockedTowers() should return all non-BASIC towers with no progress', () => {
    const locked = service.getLockedTowers();
    const expected = Object.values(TowerType).filter(t => t !== TowerType.BASIC);
    expect(locked.map(l => l.type).sort()).toEqual(expected.sort());
  });

  it('getLockedTowers() should include the unlock condition for each locked tower', () => {
    const locked = service.getLockedTowers();
    for (const entry of locked) {
      expect(entry.condition).toEqual(TOWER_UNLOCK_CONDITIONS[entry.type]);
    }
  });

  it('getLockedTowers() should return empty array when all towers unlocked', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }));
    expect(service.getLockedTowers().length).toBe(0);
  });

  // --- getUnlockCondition ---

  it('getUnlockCondition() should return the condition from TOWER_UNLOCK_CONDITIONS', () => {
    for (const type of Object.values(TowerType)) {
      expect(service.getUnlockCondition(type)).toEqual(TOWER_UNLOCK_CONDITIONS[type]);
    }
  });

  // --- allUnlocked ---

  it('allUnlocked() should return false with no campaign progress', () => {
    expect(service.allUnlocked()).toBeFalse();
  });

  it('allUnlocked() should return false with only partial campaign progress', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 1: 1, 2: 1 }));
    expect(service.allUnlocked()).toBeFalse();
  });

  it('allUnlocked() should return true when all campaign levels completed', () => {
    campaignSpy.getProgress.and.returnValue(makeCampaignProgress({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }));
    expect(service.allUnlocked()).toBeTrue();
  });

  // --- Achievement-based unlock (future-proofing) ---

  it('should unlock a tower with achievement type when achievement is in profile', () => {
    // Manually patch a condition to achievement type for this test
    const original = TOWER_UNLOCK_CONDITIONS[TowerType.MORTAR];
    const patched = { type: 'achievement' as const, achievementId: 'test_achieve', description: 'Test' };
    (TOWER_UNLOCK_CONDITIONS as Record<TowerType, typeof patched>)[TowerType.MORTAR] = patched;

    profileSpy.getProfile.and.returnValue(makeProfile(['test_achieve']));
    expect(service.isTowerUnlocked(TowerType.MORTAR)).toBeTrue();

    // Restore original condition to avoid polluting other tests
    (TOWER_UNLOCK_CONDITIONS as Record<string, typeof original>)[TowerType.MORTAR] = original;
  });

  it('should not unlock a tower with achievement type when achievement is absent', () => {
    const original = TOWER_UNLOCK_CONDITIONS[TowerType.MORTAR];
    const patched = { type: 'achievement' as const, achievementId: 'test_achieve', description: 'Test' };
    (TOWER_UNLOCK_CONDITIONS as Record<TowerType, typeof patched>)[TowerType.MORTAR] = patched;

    profileSpy.getProfile.and.returnValue(makeProfile([]));
    expect(service.isTowerUnlocked(TowerType.MORTAR)).toBeFalse();

    (TOWER_UNLOCK_CONDITIONS as Record<string, typeof original>)[TowerType.MORTAR] = original;
  });
});
