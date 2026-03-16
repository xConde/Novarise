import { Injectable } from '@angular/core';
import {
  CampaignLevel,
  CampaignLevelProgress,
  CampaignProgress,
  CAMPAIGN_LEVELS,
} from '../models/campaign.model';

const CAMPAIGN_STORAGE_KEY = 'novarise-campaign';

const DEFAULT_PROGRESS: CampaignProgress = {
  completedLevels: {},
};

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private progress: CampaignProgress;

  constructor() {
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
      this.save();
    }
  }

  getNextLevel(currentLevelId: string): CampaignLevel | null {
    const current = this.getLevel(currentLevelId);
    if (!current) return null;
    const next = CAMPAIGN_LEVELS.find(l => l.number === current.number + 1);
    return next ?? null;
  }

  resetProgress(): void {
    this.progress = { completedLevels: {} };
    try {
      localStorage.removeItem(CAMPAIGN_STORAGE_KEY);
    } catch {
      // localStorage unavailable — silently fail
    }
  }

  private load(): CampaignProgress {
    try {
      const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PROGRESS, completedLevels: {} };
      const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
      return {
        completedLevels:
          parsed.completedLevels &&
          typeof parsed.completedLevels === 'object' &&
          !Array.isArray(parsed.completedLevels)
            ? { ...parsed.completedLevels as Record<string, CampaignLevelProgress> }
            : {},
      };
    } catch {
      return { ...DEFAULT_PROGRESS, completedLevels: {} };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(this.progress));
    } catch {
      // localStorage full or unavailable — silently fail
    }
  }
}
