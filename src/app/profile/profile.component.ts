import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerProfileService, PlayerProfile, Achievement, ACHIEVEMENTS } from '../game/game-board/services/player-profile.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  profile: PlayerProfile;
  allAchievements: Achievement[] = ACHIEVEMENTS;

  constructor(
    private profileService: PlayerProfileService,
    private router: Router
  ) {
    this.profile = this.profileService.getProfile();
  }

  isUnlocked(achievementId: string): boolean {
    return this.profile.achievements.includes(achievementId);
  }

  get winRate(): string {
    if (this.profile.totalGamesPlayed === 0) return '0';
    return ((this.profile.totalVictories / this.profile.totalGamesPlayed) * 100).toFixed(0);
  }

  get unlockedCount(): number {
    return this.profile.achievements.length;
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
