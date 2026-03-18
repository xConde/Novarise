import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { GameResultsOverlayComponent } from './game-results-overlay.component';
import { ScoreBreakdown } from '../../models/score.model';
import { DifficultyLevel } from '../../models/game-state.model';
import { CampaignLevel, CampaignTier } from '../../../../campaign/models/campaign.model';
import { ChallengeDefinition, ChallengeType } from '../../../../campaign/models/challenge.model';
import { Achievement } from '../../services/player-profile.service';

function makeScoreBreakdown(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    baseScore: 1000,
    livesRemaining: 5,
    livesTotal: 7,
    livesPercent: 0.71,
    difficultyMultiplier: 1.0,
    modifierMultiplier: 1.0,
    difficulty: DifficultyLevel.NORMAL,
    finalScore: 1000,
    stars: 2,
    wavesCompleted: 10,
    isVictory: true,
    ...overrides,
  };
}

function makeCampaignLevel(overrides: Partial<CampaignLevel> = {}): CampaignLevel {
  return {
    id: 'campaign_01',
    number: 1,
    name: 'The Beginning',
    description: 'First level',
    tier: CampaignTier.INTRO,
    gridSize: 10,
    spawnerCount: 1,
    exitCount: 1,
    waveCount: 10,
    parScore: 1000,
    unlockRequirement: { type: 'none' },
    ...overrides,
  };
}

function makeChallenge(overrides: Partial<ChallengeDefinition> = {}): ChallengeDefinition {
  return {
    id: 'c01_untouchable',
    type: ChallengeType.UNTOUCHABLE,
    name: 'Untouchable',
    description: 'Win without losing lives',
    scoreBonus: 500,
    ...overrides,
  };
}

function makeAchievement(overrides: Partial<Achievement> = {}): Achievement {
  return {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Kill your first enemy',
    category: 'combat' as Achievement['category'],
    condition: () => true,
    ...overrides,
  };
}

describe('GameResultsOverlayComponent', () => {
  let component: GameResultsOverlayComponent;
  let fixture: ComponentFixture<GameResultsOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameResultsOverlayComponent],
      imports: [CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameResultsOverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('title display', () => {
    it('should show Victory heading when isVictory is true', () => {
      component.isVictory = true;
      fixture.detectChanges();

      const h2s: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('h2');
      const texts = Array.from(h2s).map(el => el.textContent?.trim());
      expect(texts).toContain('Victory');
      expect(texts).not.toContain('Defeat');
    });

    it('should show Defeat heading when isVictory is false', () => {
      component.isVictory = false;
      fixture.detectChanges();

      const h2s: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('h2');
      const texts = Array.from(h2s).map(el => el.textContent?.trim());
      expect(texts).toContain('Defeat');
      expect(texts).not.toContain('Victory');
    });

    it('should apply victory CSS class when isVictory is true', () => {
      component.isVictory = true;
      fixture.detectChanges();

      const content = fixture.nativeElement.querySelector('.overlay-content');
      expect(content.classList.contains('victory')).toBeTrue();
      expect(content.classList.contains('defeat')).toBeFalse();
    });

    it('should apply defeat CSS class when isVictory is false', () => {
      component.isVictory = false;
      fixture.detectChanges();

      const content = fixture.nativeElement.querySelector('.overlay-content');
      expect(content.classList.contains('defeat')).toBeTrue();
      expect(content.classList.contains('victory')).toBeFalse();
    });
  });

  describe('star display', () => {
    it('should render star elements when isVictory is true', () => {
      component.isVictory = true;
      component.starArray = ['filled', 'filled', 'empty'];
      fixture.detectChanges();

      const stars = fixture.nativeElement.querySelectorAll('.overlay-star');
      expect(stars.length).toBe(3);
    });

    it('should mark filled and empty stars with correct CSS classes', () => {
      component.isVictory = true;
      component.starArray = ['filled', 'empty', 'empty'];
      fixture.detectChanges();

      const stars: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.overlay-star');
      expect(stars[0].classList.contains('filled')).toBeTrue();
      expect(stars[1].classList.contains('empty')).toBeTrue();
      expect(stars[2].classList.contains('empty')).toBeTrue();
    });

    it('should not render star display when isVictory is false', () => {
      component.isVictory = false;
      component.starArray = ['filled', 'filled', 'filled'];
      fixture.detectChanges();

      const starDisplay = fixture.nativeElement.querySelector('.star-display');
      expect(starDisplay).toBeNull();
    });
  });

  describe('score breakdown', () => {
    it('should render score breakdown when scoreBreakdown is provided', () => {
      component.scoreBreakdown = makeScoreBreakdown();
      component.maxWaves = 10;
      fixture.detectChanges();

      const breakdown = fixture.nativeElement.querySelector('.score-breakdown');
      expect(breakdown).toBeTruthy();
    });

    it('should display base score value', () => {
      component.scoreBreakdown = makeScoreBreakdown({ baseScore: 2500 });
      fixture.detectChanges();

      const breakdown = fixture.nativeElement.querySelector('.score-breakdown');
      expect(breakdown.textContent).toContain('2500');
    });

    it('should display final score value', () => {
      component.scoreBreakdown = makeScoreBreakdown({ finalScore: 3750 });
      fixture.detectChanges();

      const finalValue = fixture.nativeElement.querySelector('.final-value');
      expect(finalValue.textContent.trim()).toBe('3750');
    });

    it('should show modifier row when modifierMultiplier is not 1', () => {
      component.scoreBreakdown = makeScoreBreakdown({ modifierMultiplier: 1.5 });
      fixture.detectChanges();

      const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.score-row');
      const texts = Array.from(rows).map(el => el.textContent ?? '');
      expect(texts.some(t => t.includes('Modifiers'))).toBeTrue();
    });

    it('should hide modifier row when modifierMultiplier is 1', () => {
      component.scoreBreakdown = makeScoreBreakdown({ modifierMultiplier: 1 });
      fixture.detectChanges();

      const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.score-row');
      const texts = Array.from(rows).map(el => el.textContent ?? '');
      expect(texts.some(t => t.includes('Modifiers'))).toBeFalse();
    });

    it('should fall back to plain score display when scoreBreakdown is null', () => {
      component.scoreBreakdown = null;
      component.gameScore = 999;
      fixture.detectChanges();

      const finalScore = fixture.nativeElement.querySelector('.final-score');
      expect(finalScore).toBeTruthy();
      expect(finalScore.textContent).toContain('999');
    });

    it('should not render score breakdown when scoreBreakdown is null', () => {
      component.scoreBreakdown = null;
      fixture.detectChanges();

      const breakdown = fixture.nativeElement.querySelector('.score-breakdown');
      expect(breakdown).toBeNull();
    });
  });

  describe('campaign mode', () => {
    it('should show campaign level identity when isCampaignGame and currentCampaignLevel are set', () => {
      component.isCampaignGame = true;
      component.currentCampaignLevel = makeCampaignLevel({ number: 3, name: 'Test Map' });
      fixture.detectChanges();

      const levelBlock = fixture.nativeElement.querySelector('.victory-level');
      expect(levelBlock).toBeTruthy();
      expect(levelBlock.textContent).toContain('Level 3');
      expect(levelBlock.textContent).toContain('Test Map');
    });

    it('should not show campaign level identity when isCampaignGame is false', () => {
      component.isCampaignGame = false;
      component.currentCampaignLevel = makeCampaignLevel();
      fixture.detectChanges();

      const levelBlock = fixture.nativeElement.querySelector('.victory-level');
      expect(levelBlock).toBeNull();
    });

    it('should show Campaign button when isCampaignGame is true', () => {
      component.isCampaignGame = true;
      fixture.detectChanges();

      const buttons: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.results-btn');
      const texts = Array.from(buttons).map(el => el.textContent?.trim());
      expect(texts).toContain('Campaign');
    });

    it('should hide Campaign button when isCampaignGame is false', () => {
      component.isCampaignGame = false;
      fixture.detectChanges();

      const buttons: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.results-btn');
      const texts = Array.from(buttons).map(el => el.textContent?.trim());
      expect(texts).not.toContain('Campaign');
    });
  });

  describe('next level button', () => {
    it('should show Next Level button when victory, campaign, and isNextLevelUnlocked', () => {
      component.isVictory = true;
      component.isCampaignGame = true;
      component.isNextLevelUnlocked = true;
      component.nextLevelName = 'Level Two';
      fixture.detectChanges();

      const primaryBtn = fixture.nativeElement.querySelector('.results-btn--primary');
      expect(primaryBtn).toBeTruthy();
      expect(primaryBtn.textContent).toContain('Level Two');
    });

    it('should hide Next Level button when isNextLevelUnlocked is false', () => {
      component.isVictory = true;
      component.isCampaignGame = true;
      component.isNextLevelUnlocked = false;
      fixture.detectChanges();

      const primaryBtn = fixture.nativeElement.querySelector('.results-btn--primary');
      expect(primaryBtn).toBeNull();
    });

    it('should hide Next Level button when isVictory is false', () => {
      component.isVictory = false;
      component.isCampaignGame = true;
      component.isNextLevelUnlocked = true;
      fixture.detectChanges();

      const primaryBtn = fixture.nativeElement.querySelector('.results-btn--primary');
      expect(primaryBtn).toBeNull();
    });
  });

  describe('challenge results', () => {
    it('should render challenge list when isCampaignGame and campaignChallenges has items', () => {
      component.isCampaignGame = true;
      component.campaignChallenges = [makeChallenge()];
      component.isChallengeCompletedFn = () => true;
      fixture.detectChanges();

      const challengesList = fixture.nativeElement.querySelector('.challenges-result');
      expect(challengesList).toBeTruthy();
    });

    it('should not render challenge list when campaignChallenges is empty', () => {
      component.isCampaignGame = true;
      component.campaignChallenges = [];
      fixture.detectChanges();

      const challengesList = fixture.nativeElement.querySelector('.challenges-result');
      expect(challengesList).toBeNull();
    });

    it('should mark a completed challenge with passed class', () => {
      const challenge = makeChallenge({ name: 'Untouchable' });
      component.isCampaignGame = true;
      component.campaignChallenges = [challenge];
      component.isChallengeCompletedFn = () => true;
      fixture.detectChanges();

      const item = fixture.nativeElement.querySelector('.challenge-result-item');
      expect(item.classList.contains('challenge-result-item--passed')).toBeTrue();
    });

    it('should mark a failed challenge with failed class', () => {
      const challenge = makeChallenge({ name: 'Untouchable' });
      component.isCampaignGame = true;
      component.campaignChallenges = [challenge];
      component.isChallengeCompletedFn = () => false;
      fixture.detectChanges();

      const item = fixture.nativeElement.querySelector('.challenge-result-item');
      expect(item.classList.contains('challenge-result-item--failed')).toBeTrue();
    });

    it('should show score bonus only for completed challenges', () => {
      const challenge = makeChallenge({ scoreBonus: 750 });
      component.isCampaignGame = true;
      component.campaignChallenges = [challenge];
      component.isChallengeCompletedFn = () => true;
      fixture.detectChanges();

      const bonus = fixture.nativeElement.querySelector('.challenge-result-item__bonus');
      expect(bonus).toBeTruthy();
      expect(bonus.textContent).toContain('750');
    });

    it('should not show score bonus for failed challenges', () => {
      const challenge = makeChallenge({ scoreBonus: 750 });
      component.isCampaignGame = true;
      component.campaignChallenges = [challenge];
      component.isChallengeCompletedFn = () => false;
      fixture.detectChanges();

      const bonus = fixture.nativeElement.querySelector('.challenge-result-item__bonus');
      expect(bonus).toBeNull();
    });

    it('should delegate to isChallengeCompletedFn for each challenge', () => {
      const c1 = makeChallenge({ id: 'c1', name: 'One' });
      const c2 = makeChallenge({ id: 'c2', name: 'Two' });
      const completed = new Set(['c1']);
      component.isCampaignGame = true;
      component.campaignChallenges = [c1, c2];
      component.isChallengeCompletedFn = (c: ChallengeDefinition) => completed.has(c.id);
      fixture.detectChanges();

      const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.challenge-result-item');
      expect(items[0].classList.contains('challenge-result-item--passed')).toBeTrue();
      expect(items[1].classList.contains('challenge-result-item--failed')).toBeTrue();
    });
  });

  describe('achievements', () => {
    it('should show achievements section when newlyUnlockedCount > 0', () => {
      component.newlyUnlockedCount = 1;
      component.achievementDetails = [makeAchievement()];
      fixture.detectChanges();

      const section = fixture.nativeElement.querySelector('.achievements-unlocked');
      expect(section).toBeTruthy();
    });

    it('should not show achievements section when newlyUnlockedCount is 0', () => {
      component.newlyUnlockedCount = 0;
      component.achievementDetails = [];
      fixture.detectChanges();

      const section = fixture.nativeElement.querySelector('.achievements-unlocked');
      expect(section).toBeNull();
    });

    it('should render one badge per achievement in achievementDetails', () => {
      component.newlyUnlockedCount = 2;
      component.achievementDetails = [
        makeAchievement({ id: 'a1', name: 'Ach One' }),
        makeAchievement({ id: 'a2', name: 'Ach Two' }),
      ];
      fixture.detectChanges();

      const badges = fixture.nativeElement.querySelectorAll('.achievement-badge');
      expect(badges.length).toBe(2);
    });
  });

  describe('output events', () => {
    it('should emit restart when Play Again button is clicked', () => {
      let emitted = false;
      component.restart.subscribe(() => (emitted = true));
      fixture.detectChanges();

      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.results-btn');
      const playAgain = Array.from(buttons).find(b => b.textContent?.trim() === 'Play Again');
      expect(playAgain).toBeTruthy();
      playAgain!.click();

      expect(emitted).toBeTrue();
    });

    it('should emit backToCampaign when Campaign button is clicked', () => {
      let emitted = false;
      component.isCampaignGame = true;
      component.backToCampaign.subscribe(() => (emitted = true));
      fixture.detectChanges();

      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.results-btn');
      const campaignBtn = Array.from(buttons).find(b => b.textContent?.trim() === 'Campaign');
      expect(campaignBtn).toBeTruthy();
      campaignBtn!.click();

      expect(emitted).toBeTrue();
    });

    it('should emit editMap when Edit Map button is clicked', () => {
      let emitted = false;
      component.editMap.subscribe(() => (emitted = true));
      fixture.detectChanges();

      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.results-btn');
      const editBtn = Array.from(buttons).find(b => b.textContent?.trim() === 'Edit Map');
      expect(editBtn).toBeTruthy();
      editBtn!.click();

      expect(emitted).toBeTrue();
    });

    it('should emit playNextLevel when Next Level button is clicked', () => {
      let emitted = false;
      component.isVictory = true;
      component.isCampaignGame = true;
      component.isNextLevelUnlocked = true;
      component.nextLevelName = 'Next Map';
      component.playNextLevel.subscribe(() => (emitted = true));
      fixture.detectChanges();

      const primaryBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.results-btn--primary');
      expect(primaryBtn).toBeTruthy();
      primaryBtn.click();

      expect(emitted).toBeTrue();
    });
  });
});
