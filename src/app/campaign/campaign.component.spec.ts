import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CampaignComponent } from './campaign.component';
import { CampaignService } from './services/campaign.service';
import { CampaignMapService } from './services/campaign-map.service';
import { MapBridgeService } from '../game/game-board/services/map-bridge.service';
import { CAMPAIGN_LEVELS, CAMPAIGN_LEVEL_COUNT } from './models/campaign.model';
import { TerrainType } from '../games/novarise/models/terrain-types.enum';

const MOCK_MAP_STATE = {
  gridSize: 10,
  tiles: Array.from({ length: 10 }, () =>
    new Array<TerrainType>(10).fill(TerrainType.BEDROCK),
  ),
  heightMap: Array.from({ length: 10 }, () => new Array<number>(10).fill(0)),
  spawnPoints: [{ x: 0, z: 4 }],
  exitPoints: [{ x: 9, z: 4 }],
  version: '2.0.0',
};

describe('CampaignComponent', () => {
  let component: CampaignComponent;
  let fixture: ComponentFixture<CampaignComponent>;
  let router: jasmine.SpyObj<Router>;
  let campaignService: jasmine.SpyObj<CampaignService>;
  let campaignMapService: jasmine.SpyObj<CampaignMapService>;
  let mapBridge: jasmine.SpyObj<MapBridgeService>;

  beforeEach(async () => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    campaignMapService = jasmine.createSpyObj('CampaignMapService', ['loadLevel']);
    mapBridge = jasmine.createSpyObj('MapBridgeService', ['setEditorMapState']);

    campaignService = jasmine.createSpyObj('CampaignService', [
      'getAllLevels',
      'isUnlocked',
      'isCompleted',
      'getLevelProgress',
      'getTotalStars',
      'getCompletedCount',
      'getChallengesForLevel',
      'isChallengeCompleted',
    ]);
    campaignService.getAllLevels.and.returnValue(CAMPAIGN_LEVELS);
    campaignService.getTotalStars.and.returnValue(0);
    campaignService.getCompletedCount.and.returnValue(0);
    // Level 1 unlocked, all others locked by default
    campaignService.isUnlocked.and.callFake((id: string) => id === 'campaign_01');
    campaignService.isCompleted.and.returnValue(false);
    campaignService.getLevelProgress.and.returnValue(null);
    campaignService.getChallengesForLevel.and.returnValue([]);
    campaignService.isChallengeCompleted.and.returnValue(false);

    campaignMapService.loadLevel.and.returnValue(MOCK_MAP_STATE);

    await TestBed.configureTestingModule({
      declarations: [CampaignComponent],
      imports: [CommonModule],
      providers: [
        { provide: Router, useValue: router },
        { provide: CampaignService, useValue: campaignService },
        { provide: CampaignMapService, useValue: campaignMapService },
        { provide: MapBridgeService, useValue: mapBridge },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the campaign title', () => {
    const title = fixture.nativeElement.querySelector('.campaign-title');
    expect(title.textContent).toContain('CAMPAIGN');
  });

  it('should show 16 level cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('.level-card');
    expect(cards.length).toBe(CAMPAIGN_LEVEL_COUNT);
  });

  it('should render level 1 as unlocked', () => {
    const firstCard = fixture.nativeElement.querySelector('.level-card');
    expect(firstCard.classList).toContain('level-card--unlocked');
    expect(firstCard.classList).not.toContain('level-card--locked');
  });

  it('should render level 2 as locked when not completed', () => {
    const cards = fixture.nativeElement.querySelectorAll('.level-card');
    const second = cards[1] as HTMLElement;
    expect(second.classList).toContain('level-card--locked');
  });

  it('should show a lock icon on locked cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('.level-card');
    const lockIcons = cards[1].querySelectorAll('.level-card__lock');
    expect(lockIcons.length).toBeGreaterThan(0);
  });

  it('should have the unlocked card enabled and locked cards disabled', () => {
    const cards = fixture.nativeElement.querySelectorAll('.level-card') as NodeListOf<HTMLButtonElement>;
    expect(cards[0].disabled).toBeFalse();
    expect(cards[1].disabled).toBeTrue();
  });

  it('should navigate to /play when an unlocked level is clicked', () => {
    component.playLevel(CAMPAIGN_LEVELS[0]);
    expect(campaignMapService.loadLevel).toHaveBeenCalledWith('campaign_01');
    expect(mapBridge.setEditorMapState).toHaveBeenCalledWith(MOCK_MAP_STATE, 'campaign_01');
    expect(router.navigate).toHaveBeenCalledWith(['/play']);
  });

  it('should not navigate when a locked level is clicked', () => {
    component.playLevel(CAMPAIGN_LEVELS[1]);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should not navigate when loadLevel returns null', () => {
    campaignMapService.loadLevel.and.returnValue(null);
    component.playLevel(CAMPAIGN_LEVELS[0]);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should navigate to / when Home button is clicked', () => {
    component.goHome();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should display total stars', () => {
    campaignService.getTotalStars.and.returnValue(6);
    component.ngOnInit();
    fixture.detectChanges();
    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('6');
  });

  it('getStarArray should return [true, true, false] for 2 stars', () => {
    campaignService.getLevelProgress.and.returnValue({
      bestScore: 500,
      bestStars: 2,
      difficulty: 'normal',
      completedAt: Date.now(),
    });
    const stars = component.getStarArray('campaign_01');
    expect(stars).toEqual([true, true, false]);
  });

  it('getStarArray should return [false, false, false] for no progress', () => {
    campaignService.getLevelProgress.and.returnValue(null);
    const stars = component.getStarArray('campaign_01');
    expect(stars).toEqual([false, false, false]);
  });

  // ── Challenge badge delegation ─────────────────────────────────────────────

  it('getChallenges should delegate to campaignService.getChallengesForLevel', () => {
    component.getChallenges('campaign_01');
    expect(campaignService.getChallengesForLevel).toHaveBeenCalledWith('campaign_01');
  });

  it('getChallenges should return empty array when service returns empty', () => {
    campaignService.getChallengesForLevel.and.returnValue([]);
    expect(component.getChallenges('campaign_01')).toEqual([]);
  });

  it('isChallengeCompleted should delegate to campaignService.isChallengeCompleted', () => {
    component.isChallengeCompleted('c01_untouchable');
    expect(campaignService.isChallengeCompleted).toHaveBeenCalledWith('c01_untouchable');
  });

  it('isChallengeCompleted should return true when service returns true', () => {
    campaignService.isChallengeCompleted.and.returnValue(true);
    expect(component.isChallengeCompleted('c01_untouchable')).toBeTrue();
  });

  it('isChallengeCompleted should return false when service returns false', () => {
    campaignService.isChallengeCompleted.and.returnValue(false);
    expect(component.isChallengeCompleted('c01_untouchable')).toBeFalse();
  });
});
