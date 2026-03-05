import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CampaignComponent } from './campaign.component';
import { CampaignService } from './campaign.service';
import { MapBridgeService } from '../game-board/services/map-bridge.service';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { DifficultyLevel } from '../game-board/models/game-state.model';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';

function makeFakeMap(): TerrainGridState {
  const size = 25;
  const tiles: TerrainType[][] = [];
  const heightMap: number[][] = [];
  for (let x = 0; x < size; x++) {
    tiles[x] = Array(size).fill(TerrainType.BEDROCK);
    heightMap[x] = Array(size).fill(0);
  }
  return { gridSize: size, tiles, heightMap, spawnPoint: { x: 0, z: 12 }, exitPoint: { x: 24, z: 12 }, version: '1.0.0' };
}

describe('CampaignComponent', () => {
  let component: CampaignComponent;
  let fixture: ComponentFixture<CampaignComponent>;
  let campaignServiceSpy: jasmine.SpyObj<CampaignService>;
  let mapBridgeSpy: jasmine.SpyObj<MapBridgeService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let locationSpy: jasmine.SpyObj<Location>;

  const fakeLevels = [
    { id: 1, name: 'The Gauntlet', description: 'Easy straight path', difficulty: DifficultyLevel.EASY, mapBuilder: makeFakeMap },
    { id: 2, name: "Serpent's Pass", description: 'S-curve', difficulty: DifficultyLevel.EASY, mapBuilder: makeFakeMap },
    { id: 3, name: 'Crossroads', description: 'Two paths', difficulty: DifficultyLevel.NORMAL, mapBuilder: makeFakeMap },
    { id: 4, name: 'The Labyrinth', description: 'Winding maze', difficulty: DifficultyLevel.HARD, mapBuilder: makeFakeMap },
    { id: 5, name: 'Fortress', description: 'Open field', difficulty: DifficultyLevel.NIGHTMARE, mapBuilder: makeFakeMap },
  ];

  beforeEach(async () => {
    campaignServiceSpy = jasmine.createSpyObj<CampaignService>('CampaignService', [
      'getLevels', 'getProgress', 'isLevelUnlocked', 'getMapForLevel', 'resetProgress'
    ]);
    mapBridgeSpy = jasmine.createSpyObj<MapBridgeService>('MapBridgeService', ['setEditorMapState', 'setDifficulty', 'setCampaignLevelId']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    locationSpy = jasmine.createSpyObj<Location>('Location', ['back']);

    campaignServiceSpy.getLevels.and.returnValue(fakeLevels);
    campaignServiceSpy.getProgress.and.returnValue({ unlockedLevel: 1, stars: {}, bestScores: {} });
    campaignServiceSpy.isLevelUnlocked.and.callFake((id: number) => id === 1);
    campaignServiceSpy.getMapForLevel.and.returnValue(makeFakeMap());
    routerSpy.navigate.and.returnValue(Promise.resolve(true));

    await TestBed.configureTestingModule({
      declarations: [CampaignComponent],
      imports: [CommonModule],
      providers: [
        { provide: CampaignService, useValue: campaignServiceSpy },
        { provide: MapBridgeService, useValue: mapBridgeSpy },
        { provide: Router, useValue: routerSpy },
        { provide: Location, useValue: locationSpy },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call getLevels on init', () => {
    expect(campaignServiceSpy.getLevels).toHaveBeenCalled();
  });

  it('should expose all 5 levels', () => {
    expect(component.levels.length).toBe(5);
  });

  it('should render 5 level cards in the DOM', () => {
    const cards = fixture.nativeElement.querySelectorAll('.level-card');
    expect(cards.length).toBe(5);
  });

  it('should add "locked" class to levels 2–5', () => {
    const cards: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.level-card');
    // Level 1 (index 0) should NOT have locked
    expect(cards[0].classList.contains('locked')).toBeFalse();
    // Levels 2–5 (indices 1–4) should have locked
    for (let i = 1; i < 5; i++) {
      expect(cards[i].classList.contains('locked')).toBeTrue();
    }
  });

  it('should not add "locked" class to unlocked level 1', () => {
    const firstCard: HTMLElement = fixture.nativeElement.querySelector('.level-card');
    expect(firstCard.classList.contains('locked')).toBeFalse();
  });

  it('should display level names in the DOM', () => {
    const names: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.level-name');
    expect(names[0].textContent?.trim()).toBe('The Gauntlet');
    expect(names[4].textContent?.trim()).toBe('Fortress');
  });

  it('playLevel should navigate to /play for unlocked level', () => {
    component.playLevel(fakeLevels[0]);

    expect(mapBridgeSpy.setEditorMapState).toHaveBeenCalled();
    expect(mapBridgeSpy.setDifficulty).toHaveBeenCalledWith(fakeLevels[0].difficulty);
    expect(mapBridgeSpy.setCampaignLevelId).toHaveBeenCalledWith(fakeLevels[0].id);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/play']);
  });

  it('playLevel should not navigate for locked level', () => {
    component.playLevel(fakeLevels[1]); // level 2 is locked

    expect(mapBridgeSpy.setEditorMapState).not.toHaveBeenCalled();
    expect(mapBridgeSpy.setDifficulty).not.toHaveBeenCalled();
    expect(mapBridgeSpy.setCampaignLevelId).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('goBack should call location.back()', () => {
    component.goBack();

    expect(locationSpy.back).toHaveBeenCalled();
  });

  it('goToMaps should navigate to /maps', () => {
    component.goToMaps();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/maps']);
  });

  it('resetProgress should call service.resetProgress when confirmed', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.resetProgress();

    expect(campaignServiceSpy.resetProgress).toHaveBeenCalled();
  });

  it('resetProgress should NOT call service.resetProgress when cancelled', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.resetProgress();

    expect(campaignServiceSpy.resetProgress).not.toHaveBeenCalled();
  });

  it('getStars should return 0 for levels with no progress', () => {
    expect(component.getStars(1)).toBe(0);
    expect(component.getStars(3)).toBe(0);
  });

  it('getBestScore should return 0 for levels with no progress', () => {
    expect(component.getBestScore(1)).toBe(0);
  });

  it('isUnlocked should delegate to campaign service', () => {
    campaignServiceSpy.isLevelUnlocked.and.callFake((id: number) => id <= 3);
    expect(component.isUnlocked(3)).toBeTrue();
    expect(component.isUnlocked(4)).toBeFalse();
  });

  it('should show lock icon for locked levels', () => {
    const lockIcons = fixture.nativeElement.querySelectorAll('.level-lock');
    // Levels 2–5 are locked (4 locks)
    expect(lockIcons.length).toBe(4);
  });

  it('should render campaign title', () => {
    const title: HTMLElement = fixture.nativeElement.querySelector('.campaign-title');
    expect(title.textContent?.trim()).toBe('Campaign');
  });

  it('should render back and reset buttons', () => {
    const backBtn = fixture.nativeElement.querySelector('.back-btn');
    const resetBtn = fixture.nativeElement.querySelector('.reset-btn');
    expect(backBtn).not.toBeNull();
    expect(resetBtn).not.toBeNull();
  });
});
