import { TestBed } from '@angular/core/testing';
import { CampaignService } from './campaign.service';
import { CAMPAIGN_LEVEL_COUNT } from '../models/campaign.model';

describe('CampaignService', () => {
  let service: CampaignService;

  const STORAGE_KEY = 'novarise-campaign';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CampaignService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── getAllLevels ──────────────────────────────────────────────────────────

  it('should return all 16 campaign levels', () => {
    expect(service.getAllLevels().length).toBe(CAMPAIGN_LEVEL_COUNT);
  });

  it('should return levels with sequential numbers 1-16', () => {
    const levels = service.getAllLevels();
    levels.forEach((l, i) => expect(l.number).toBe(i + 1));
  });

  // ── getLevel ─────────────────────────────────────────────────────────────

  it('should return a level by id', () => {
    const level = service.getLevel('campaign_01');
    expect(level).toBeDefined();
    expect(level?.name).toBe('First Light');
  });

  it('should return undefined for unknown level id', () => {
    expect(service.getLevel('campaign_99')).toBeUndefined();
  });

  // ── isUnlocked ───────────────────────────────────────────────────────────

  it('should always unlock level 1 (type: none)', () => {
    expect(service.isUnlocked('campaign_01')).toBeTrue();
  });

  it('should lock level 2 when level 1 is not completed', () => {
    expect(service.isUnlocked('campaign_02')).toBeFalse();
  });

  it('should unlock level 2 after level 1 is completed', () => {
    service.recordCompletion('campaign_01', 500, 2, 'normal');
    expect(service.isUnlocked('campaign_02')).toBeTrue();
  });

  it('should lock level 9 when total stars < 12', () => {
    // Complete levels 1-3 with 3 stars each (9 total) — not enough
    service.recordCompletion('campaign_01', 500, 3, 'normal');
    service.recordCompletion('campaign_02', 750, 3, 'normal');
    service.recordCompletion('campaign_03', 1000, 3, 'normal');
    expect(service.getTotalStars()).toBe(9);
    expect(service.isUnlocked('campaign_09')).toBeFalse();
  });

  it('should unlock level 9 when total stars >= 12', () => {
    // 4 levels × 3 stars = 12
    service.recordCompletion('campaign_01', 500, 3, 'normal');
    service.recordCompletion('campaign_02', 750, 3, 'normal');
    service.recordCompletion('campaign_03', 1000, 3, 'normal');
    service.recordCompletion('campaign_04', 1200, 3, 'normal');
    expect(service.getTotalStars()).toBe(12);
    expect(service.isUnlocked('campaign_09')).toBeTrue();
  });

  it('should return false for unknown level id in isUnlocked', () => {
    expect(service.isUnlocked('campaign_99')).toBeFalse();
  });

  // ── isCompleted ──────────────────────────────────────────────────────────

  it('should return false for a level that has not been completed', () => {
    expect(service.isCompleted('campaign_01')).toBeFalse();
  });

  it('should return true after a level is completed', () => {
    service.recordCompletion('campaign_01', 500, 2, 'normal');
    expect(service.isCompleted('campaign_01')).toBeTrue();
  });

  // ── getLevelProgress ─────────────────────────────────────────────────────

  it('should return null for a level with no progress', () => {
    expect(service.getLevelProgress('campaign_01')).toBeNull();
  });

  it('should return progress after recordCompletion', () => {
    service.recordCompletion('campaign_01', 600, 2, 'normal');
    const progress = service.getLevelProgress('campaign_01');
    expect(progress).not.toBeNull();
    expect(progress?.bestScore).toBe(600);
    expect(progress?.bestStars).toBe(2);
    expect(progress?.difficulty).toBe('normal');
  });

  // ── recordCompletion ─────────────────────────────────────────────────────

  it('should persist completion to localStorage', () => {
    service.recordCompletion('campaign_01', 500, 2, 'normal');
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.completedLevels['campaign_01']).toBeDefined();
  });

  it('should update best score when a higher score is recorded', () => {
    service.recordCompletion('campaign_01', 500, 2, 'normal');
    service.recordCompletion('campaign_01', 800, 1, 'normal');
    expect(service.getLevelProgress('campaign_01')?.bestScore).toBe(800);
  });

  it('should not overwrite a higher best score with a lower one', () => {
    service.recordCompletion('campaign_01', 800, 3, 'normal');
    service.recordCompletion('campaign_01', 300, 1, 'normal');
    expect(service.getLevelProgress('campaign_01')?.bestScore).toBe(800);
  });

  it('should update best stars even when score is not higher', () => {
    service.recordCompletion('campaign_01', 800, 1, 'normal');
    service.recordCompletion('campaign_01', 600, 3, 'normal');
    const progress = service.getLevelProgress('campaign_01');
    // Score stays at 800, stars updated to 3
    expect(progress?.bestScore).toBe(800);
    expect(progress?.bestStars).toBe(3);
  });

  it('should preserve highest stars across multiple completions', () => {
    service.recordCompletion('campaign_01', 500, 3, 'normal');
    service.recordCompletion('campaign_01', 900, 1, 'normal');
    // New score wins, but stars should be max(1, 3) = 3
    expect(service.getLevelProgress('campaign_01')?.bestStars).toBe(3);
  });

  // ── getTotalStars ─────────────────────────────────────────────────────────

  it('should return 0 total stars with no completions', () => {
    expect(service.getTotalStars()).toBe(0);
  });

  it('should sum stars across all completed levels', () => {
    service.recordCompletion('campaign_01', 500, 3, 'normal');
    service.recordCompletion('campaign_02', 750, 2, 'normal');
    service.recordCompletion('campaign_03', 1000, 1, 'normal');
    expect(service.getTotalStars()).toBe(6);
  });

  // ── getCompletedCount ────────────────────────────────────────────────────

  it('should return 0 completed count initially', () => {
    expect(service.getCompletedCount()).toBe(0);
  });

  it('should increment completed count per unique level', () => {
    service.recordCompletion('campaign_01', 500, 2, 'normal');
    service.recordCompletion('campaign_02', 750, 2, 'normal');
    // Re-completing same level should not double-count
    service.recordCompletion('campaign_01', 600, 3, 'normal');
    expect(service.getCompletedCount()).toBe(2);
  });

  // ── getNextLevel ─────────────────────────────────────────────────────────

  it('should return the next campaign level', () => {
    const next = service.getNextLevel('campaign_01');
    expect(next?.id).toBe('campaign_02');
    expect(next?.number).toBe(2);
  });

  it('should return null for the last level (campaign_16)', () => {
    expect(service.getNextLevel('campaign_16')).toBeNull();
  });

  it('should return null for an unknown level id in getNextLevel', () => {
    expect(service.getNextLevel('campaign_99')).toBeNull();
  });

  // ── resetProgress ─────────────────────────────────────────────────────────

  it('should clear all progress on reset', () => {
    service.recordCompletion('campaign_01', 500, 2, 'normal');
    service.resetProgress();
    expect(service.getCompletedCount()).toBe(0);
    expect(service.getTotalStars()).toBe(0);
    expect(service.isCompleted('campaign_01')).toBeFalse();
  });

  it('should remove the localStorage key on reset', () => {
    service.recordCompletion('campaign_01', 500, 2, 'normal');
    service.resetProgress();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // ── localStorage resilience ──────────────────────────────────────────────

  it('should handle corrupted localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, '{ invalid json {{');
    // Re-create service to trigger load()
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(CampaignService);
    expect(fresh.getCompletedCount()).toBe(0);
    expect(fresh.getAllLevels().length).toBe(CAMPAIGN_LEVEL_COUNT);
  });

  it('should handle empty completedLevels in stored data gracefully', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedLevels: null }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(CampaignService);
    expect(fresh.getCompletedCount()).toBe(0);
  });
});
