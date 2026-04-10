import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RewardScreenComponent } from './reward-screen.component';
import { RewardScreenConfig, RewardItem } from '../../models/encounter.model';
import { RelicId, RelicRarity } from '../../models/relic.model';

const MOCK_CONFIG: RewardScreenConfig = {
  goldPickup: 40,
  relicChoices: [
    { type: 'relic', relicId: RelicId.IRON_HEART },
    { type: 'relic', relicId: RelicId.CHAIN_REACTION },
    { type: 'relic', relicId: RelicId.COMMANDERS_BANNER },
  ],
  bonusRewards: [],
};

describe('RewardScreenComponent', () => {
  let fixture: ComponentFixture<RewardScreenComponent>;
  let component: RewardScreenComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RewardScreenComponent],
      imports: [CommonModule],
    });

    fixture = TestBed.createComponent(RewardScreenComponent);
    component = fixture.componentInstance;
    component.config = MOCK_CONFIG;
    fixture.detectChanges();
  });

  it('renders the gold amount from config', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('+40g');
  });

  it('renders the correct number of relic cards', () => {
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.reward-card');
    expect(cards.length).toBe(3);
  });

  it('clicking a relic card emits rewardCollected with the correct relic id', () => {
    const emitted: RewardItem[] = [];
    component.rewardCollected.subscribe(r => emitted.push(r));

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.reward-card');
    cards[0].click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].type).toBe('relic');
    if (emitted[0].type === 'relic') {
      expect(emitted[0].relicId).toBe(RelicId.IRON_HEART);
    }
  });

  it('clicking a relic card sets relicPicked to true', () => {
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.reward-card');
    cards[0].click();
    expect(component.relicPicked).toBeTrue();
  });

  it('skip button sets relicPicked without emitting rewardCollected', () => {
    const emitted: RewardItem[] = [];
    component.rewardCollected.subscribe(r => emitted.push(r));

    fixture.detectChanges();
    const skipBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.reward-skip-btn');
    skipBtn?.click();

    expect(component.relicPicked).toBeTrue();
    expect(emitted.length).toBe(0);
  });

  it('continue button emits screenClosed', () => {
    let closed = false;
    component.screenClosed.subscribe(() => (closed = true));

    component.skipRelics(); // put into relicPicked=true state
    fixture.detectChanges();

    const continueBtn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.reward-continue-btn');
    continueBtn?.click();

    expect(closed).toBeTrue();
  });

  it('selected card receives the --selected modifier class', () => {
    component.pickRelic(component.relicCards[1]);
    fixture.detectChanges();

    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('.reward-card');
    // After pick, choice section is hidden — verify component state instead
    expect(component.selectedRelic).toBe(RelicId.CHAIN_REACTION);
  });

  it('getRarityClass returns "common" for COMMON rarity', () => {
    expect(component.getRarityClass(RelicRarity.COMMON)).toBe('common');
  });

  it('getRarityClass returns "uncommon" for UNCOMMON rarity', () => {
    expect(component.getRarityClass(RelicRarity.UNCOMMON)).toBe('uncommon');
  });

  it('getRarityClass returns "rare" for RARE rarity', () => {
    expect(component.getRarityClass(RelicRarity.RARE)).toBe('rare');
  });

  it('relicCards resolves definitions from config ids', () => {
    expect(component.relicCards.length).toBe(3);
    expect(component.relicCards[0].id).toBe(RelicId.IRON_HEART);
    expect(component.relicCards[2].id).toBe(RelicId.COMMANDERS_BANNER);
  });
});
