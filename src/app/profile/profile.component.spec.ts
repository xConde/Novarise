import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { PlayerProfileService, PlayerProfile, ACHIEVEMENTS } from '../game/game-board/services/player-profile.service';

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

  it('should render all achievement cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('.achievement-card');
    expect(cards.length).toBe(ACHIEVEMENTS.length);
  });

  it('should apply unlocked class to unlocked achievements', () => {
    const cards = fixture.nativeElement.querySelectorAll('.achievement-card');
    const unlockedCards = fixture.nativeElement.querySelectorAll('.achievement-card.unlocked');
    const lockedCards = fixture.nativeElement.querySelectorAll('.achievement-card.locked');
    expect(unlockedCards.length).toBe(2);
    expect(lockedCards.length).toBe(cards.length - 2);
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
});
