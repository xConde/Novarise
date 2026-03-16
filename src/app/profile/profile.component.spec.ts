import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ProfileComponent } from './profile.component';
import {
  PlayerProfileService,
  PlayerProfile,
  ACHIEVEMENTS,
  AchievementCategory,
} from '../game/game-board/services/player-profile.service';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let router: jasmine.SpyObj<Router>;
  let profileService: jasmine.SpyObj<PlayerProfileService>;

  const mockProfile: PlayerProfile = {
    totalGamesPlayed: 15,
    totalVictories: 10,
    totalDefeats: 5,
    totalEnemiesKilled: 500,
    totalGoldEarned: 8000,
    highestWaveReached: 12,
    highestScore: 3500,
    achievements: ['first_victory', 'veteran'],
    mapScores: {},
    towerKills: {},
    slowEffectsApplied: 0,
    hasUsedSpecialization: false,
    hasPlacedAllTowerTypes: false,
    maxModifiersUsedInVictory: 0,
    completedChallengeCount: 0,
  };

  beforeEach(async () => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    profileService = jasmine.createSpyObj('PlayerProfileService', ['getProfile']);
    profileService.getProfile.and.returnValue({ ...mockProfile, achievements: [...mockProfile.achievements] });

    await TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: PlayerProfileService, useValue: profileService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display profile title', () => {
    const title = fixture.nativeElement.querySelector('.profile-title');
    expect(title.textContent).toContain('PROFILE');
  });

  it('should render stats grid with correct values', () => {
    const statValues = fixture.nativeElement.querySelectorAll('.stat-value');
    const texts = Array.from(statValues).map((el: any) => el.textContent.trim());
    expect(texts).toContain('15');  // totalGamesPlayed
    expect(texts).toContain('10');  // totalVictories
    expect(texts).toContain('5');   // totalDefeats
    expect(texts).toContain('500'); // totalEnemiesKilled
    expect(texts).toContain('8000'); // totalGoldEarned
    expect(texts).toContain('12');  // highestWaveReached
    expect(texts).toContain('3500'); // highestScore
  });

  it('should show win rate as percentage', () => {
    expect(component.winRate).toBe('67');
    const statValues = fixture.nativeElement.querySelectorAll('.stat-value');
    const texts = Array.from(statValues).map((el: any) => el.textContent.trim());
    expect(texts).toContain('67%');
  });

  it('should return 0 win rate when no games played', () => {
    profileService.getProfile.and.returnValue({
      ...mockProfile,
      totalGamesPlayed: 0,
      totalVictories: 0,
      achievements: [],
    });
    const newFixture = TestBed.createComponent(ProfileComponent);
    newFixture.detectChanges();
    const newComponent = newFixture.componentInstance;
    expect(newComponent.winRate).toBe('0');
  });

  it('should mark unlocked achievements', () => {
    expect(component.isUnlocked('first_victory')).toBeTrue();
    expect(component.isUnlocked('veteran')).toBeTrue();
  });

  it('should mark locked achievements', () => {
    expect(component.isUnlocked('gold_hoarder')).toBeFalse();
    expect(component.isUnlocked('exterminator')).toBeFalse();
  });

  it('should show correct unlocked count', () => {
    expect(component.unlockedCount).toBe(2);
    const countEl = fixture.nativeElement.querySelector('.achievements-count');
    expect(countEl.textContent).toContain(`2 / ${ACHIEVEMENTS.length} Unlocked`);
  });

  it('should render all achievement cards across all categories', () => {
    const cards = fixture.nativeElement.querySelectorAll('.achievement-card');
    expect(cards.length).toBe(ACHIEVEMENTS.length);
  });

  it('should apply unlocked class to unlocked achievements', () => {
    const unlockedCards = fixture.nativeElement.querySelectorAll('.achievement-card.unlocked');
    const lockedCards = fixture.nativeElement.querySelectorAll('.achievement-card.locked');
    expect(unlockedCards.length).toBe(2);
    expect(lockedCards.length).toBe(ACHIEVEMENTS.length - 2);
  });

  it('should navigate home on goHome()', () => {
    component.goHome();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should not show first-time hint when games have been played', () => {
    const hint = fixture.nativeElement.querySelector('.first-time-hint');
    expect(hint).toBeNull();
  });

  it('should show first-time hint when no games played', () => {
    profileService.getProfile.and.returnValue({
      ...mockProfile,
      totalGamesPlayed: 0,
      totalVictories: 0,
      totalDefeats: 0,
      achievements: [],
    });
    const newFixture = TestBed.createComponent(ProfileComponent);
    newFixture.detectChanges();
    const hint = newFixture.nativeElement.querySelector('.first-time-hint');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain('Play your first game');
  });

  it('should show "How to unlock:" hint on locked achievement cards', () => {
    const lockedCards = fixture.nativeElement.querySelectorAll('.achievement-card.locked');
    expect(lockedCards.length).toBeGreaterThan(0);
    const hints = lockedCards[0].querySelectorAll('.achievement-hint');
    expect(hints.length).toBe(1);
    expect(hints[0].textContent).toContain('How to unlock');
  });

  it('should not show "How to unlock:" hint on unlocked achievement cards', () => {
    const unlockedCards = fixture.nativeElement.querySelectorAll('.achievement-card.unlocked');
    expect(unlockedCards.length).toBeGreaterThan(0);
    const hints = unlockedCards[0].querySelectorAll('.achievement-hint');
    expect(hints.length).toBe(0);
  });

  // ── Category grouping ──────────────────────────────────────────────────────

  describe('category groups', () => {
    it('should build 4 category groups', () => {
      expect(component.categoryGroups.length).toBe(4);
    });

    it('should include all four categories', () => {
      const categories = component.categoryGroups.map((g) => g.category) as AchievementCategory[];
      expect(categories).toContain('campaign');
      expect(categories).toContain('combat');
      expect(categories).toContain('endless');
      expect(categories).toContain('challenge');
    });

    it('should have correct labels for each category', () => {
      const labelMap: Record<string, string> = {};
      for (const g of component.categoryGroups) {
        labelMap[g.category] = g.label;
      }
      expect(labelMap['campaign']).toBe('Campaign');
      expect(labelMap['combat']).toBe('Combat');
      expect(labelMap['endless']).toBe('Endless');
      expect(labelMap['challenge']).toBe('Challenge');
    });

    it('should sum achievements per group to equal total achievement count', () => {
      const total = component.categoryGroups.reduce(
        (sum, g) => sum + g.achievements.length,
        0
      );
      expect(total).toBe(ACHIEVEMENTS.length);
    });

    it('should show correct unlockedCount per category', () => {
      // first_victory = combat, veteran = combat
      const combatGroup = component.categoryGroups.find((g) => g.category === 'combat')!;
      expect(combatGroup.unlockedCount).toBe(2);

      const campaignGroup = component.categoryGroups.find((g) => g.category === 'campaign')!;
      expect(campaignGroup.unlockedCount).toBe(0);

      const endlessGroup = component.categoryGroups.find((g) => g.category === 'endless')!;
      expect(endlessGroup.unlockedCount).toBe(0);

      const challengeGroup = component.categoryGroups.find((g) => g.category === 'challenge')!;
      expect(challengeGroup.unlockedCount).toBe(0);
    });

    it('should render a category header for each group', () => {
      const headers = fixture.nativeElement.querySelectorAll('.category-header');
      expect(headers.length).toBe(4);
    });

    it('should render category name elements', () => {
      const names = fixture.nativeElement.querySelectorAll('.category-name');
      const texts = Array.from(names).map((el: any) => el.textContent.trim());
      expect(texts).toContain('Campaign');
      expect(texts).toContain('Combat');
      expect(texts).toContain('Endless');
      expect(texts).toContain('Challenge');
    });

    it('should render category count elements', () => {
      const counts = fixture.nativeElement.querySelectorAll('.category-count');
      expect(counts.length).toBe(4);
    });

    it('each group should only contain achievements of its category', () => {
      for (const group of component.categoryGroups) {
        expect(
          group.achievements.every((a) => a.category === group.category)
        ).toBe(true);
      }
    });

    it('no achievement should appear in more than one group', () => {
      const seen = new Set<string>();
      for (const group of component.categoryGroups) {
        for (const a of group.achievements) {
          expect(seen.has(a.id)).toBe(false);
          seen.add(a.id);
        }
      }
    });
  });
});
