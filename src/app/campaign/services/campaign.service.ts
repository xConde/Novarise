import { Injectable } from '@angular/core';
import {
  CampaignLevel,
  CampaignLevelProgress,
  CampaignProgress,
  CAMPAIGN_LEVELS,
} from '../models/campaign.model';
import { ChallengeDefinition, getChallengesForLevel } from '../models/challenge.model';
import { StorageService } from '../../game/game-board/services/storage.service';

const CAMPAIGN_STORAGE_KEY = 'novarise-campaign';

const MAX_STARS = 3;

const DEFAULT_PROGRESS: CampaignProgress = {
  completedLevels: {},
  completedChallenges: {},
};

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private progress: CampaignProgress;

  constructor(private storageService: StorageService) {
    this.progress = this.load();
  }

  getAllLevels(): CampaignLevel[] {
    return CAMPAIGN_LEVELS;
  }

  getLevel(id: string): CampaignLevel | undefined {
    return CAMPAIGN_LEVELS.find(l => l.id === id);
  }

  isUnlocked(levelId: string): boolean {
    const level = this.getLevel(levelId);
    if (!level) return false;
    const req = level.unlockRequirement;
    switch (req.type) {
      case 'none':
        return true;
      case 'level_complete':
        return !!this.progress.completedLevels[req.levelId!];
      case 'stars_total':
        return this.getTotalStars() >= (req.starsRequired ?? 0);
    }
  }

  isCompleted(levelId: string): boolean {
    return !!this.progress.completedLevels[levelId];
  }

  getLevelProgress(levelId: string): CampaignLevelProgress | null {
    return this.progress.completedLevels[levelId] ?? null;
  }

  getTotalStars(): number {
    return Object.values(this.progress.completedLevels)
      .reduce((sum, p) => sum + p.bestStars, 0);
  }

  getCompletedCount(): number {
    return Object.keys(this.progress.completedLevels).length;
  }

  recordCompletion(levelId: string, score: number, stars: number, difficulty: string): void {
    const existing = this.progress.completedLevels[levelId];
    if (!existing || score > existing.bestScore) {
      this.progress.completedLevels[levelId] = {
        bestScore: score,
        bestStars: Math.max(stars, existing?.bestStars ?? 0),
        difficulty,
        completedAt: Date.now(),
      };
      this.save();
    } else if (stars > existing.bestStars) {
      existing.bestStars = stars;
      existing.difficulty = difficulty;
      this.save();
    }
  }

  getNextLevel(currentLevelId: string): CampaignLevel | null {
    const current = this.getLevel(currentLevelId);
    if (!current) return null;
    const next = CAMPAIGN_LEVELS.find(l => l.number === current.number + 1);
    return next ?? null;
  }

  // ── Challenge tracking ──────────────────────────────────────────────────────

  getChallengesForLevel(levelId: string): ChallengeDefinition[] {
    return getChallengesForLevel(levelId);
  }

  isChallengeCompleted(challengeId: string): boolean {
    return !!this.progress.completedChallenges[challengeId];
  }

  completeChallenge(challengeId: string): void {
    if (!this.progress.completedChallenges[challengeId]) {
      this.progress.completedChallenges[challengeId] = true;
      this.save();
    }
  }

  getCompletedChallengeCount(): number {
    return Object.keys(this.progress.completedChallenges).length;
  }

  resetProgress(): void {
    this.progress = { completedLevels: {}, completedChallenges: {} };
    this.storageService.remove(CAMPAIGN_STORAGE_KEY);
  }

  private load(): CampaignProgress {
    const empty = { ...DEFAULT_PROGRESS, completedLevels: {}, completedChallenges: {} };
    const parsed = this.storageService.getJSON<Partial<CampaignProgress>>(
      CAMPAIGN_STORAGE_KEY,
      empty
    );
    if (parsed === empty) return empty;

    const completedLevels: Record<string, CampaignLevelProgress> =
      parsed.completedLevels &&
      typeof parsed.completedLevels === 'object' &&
      !Array.isArray(parsed.completedLevels)
        ? { ...parsed.completedLevels as Record<string, CampaignLevelProgress> }
        : {};

    // Clamp crafted/corrupt values loaded from localStorage
    for (const entry of Object.values(completedLevels)) {
      entry.bestStars = Math.min(Math.max(0, entry.bestStars), MAX_STARS);
      entry.bestScore = Math.max(0, entry.bestScore);
    }

    return {
      completedLevels,
      completedChallenges:
        parsed.completedChallenges &&
        typeof parsed.completedChallenges === 'object' &&
        !Array.isArray(parsed.completedChallenges)
          ? { ...parsed.completedChallenges as Record<string, boolean> }
          : {},
    };
  }

  private save(): void {
    this.storageService.setJSON(CAMPAIGN_STORAGE_KEY, this.progress);
  }
}
