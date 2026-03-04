import { Injectable } from '@angular/core';
import { TowerType } from '../models/tower.model';
import { TOWER_UNLOCK_CONDITIONS, TowerUnlockCondition } from '../models/tower-unlock.model';
import { CampaignService } from '../../campaign/campaign.service';
import { PlayerProfileService } from './player-profile.service';

@Injectable({ providedIn: 'root' })
export class TowerUnlockService {
  constructor(
    private campaignService: CampaignService,
    private profileService: PlayerProfileService
  ) {}

  /** Check if a tower type is unlocked based on current progress. */
  isTowerUnlocked(type: TowerType): boolean {
    const condition = TOWER_UNLOCK_CONDITIONS[type];
    if (condition.type === 'default') return true;

    if (condition.type === 'campaign' && condition.campaignLevel !== undefined) {
      const progress = this.campaignService.getProgress();
      // Tower unlocks when the required level has been completed (stars > 0)
      return (progress.stars[condition.campaignLevel] ?? 0) > 0;
    }

    if (condition.type === 'achievement' && condition.achievementId) {
      const profile = this.profileService.getProfile();
      return profile.achievements.includes(condition.achievementId);
    }

    return false;
  }

  /** Get all unlocked tower types. */
  getUnlockedTowers(): TowerType[] {
    return Object.values(TowerType).filter(type => this.isTowerUnlocked(type));
  }

  /** Get all locked tower types with their unlock conditions. */
  getLockedTowers(): { type: TowerType; condition: TowerUnlockCondition }[] {
    return Object.values(TowerType)
      .filter(type => !this.isTowerUnlocked(type))
      .map(type => ({ type, condition: TOWER_UNLOCK_CONDITIONS[type] }));
  }

  /** Get the unlock condition for a tower type. */
  getUnlockCondition(type: TowerType): TowerUnlockCondition {
    return TOWER_UNLOCK_CONDITIONS[type];
  }

  /** Check if all towers are unlocked. */
  allUnlocked(): boolean {
    return Object.values(TowerType).every(type => this.isTowerUnlocked(type));
  }
}
