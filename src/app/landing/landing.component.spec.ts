import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LandingComponent } from './landing.component';
import { MapBridgeService } from '../game/game-board/services/map-bridge.service';
import { CampaignService } from '../campaign/services/campaign.service';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let router: jasmine.SpyObj<Router>;
  let mapBridge: jasmine.SpyObj<MapBridgeService>;
  let campaignService: jasmine.SpyObj<CampaignService>;

  beforeEach(async () => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    mapBridge = jasmine.createSpyObj('MapBridgeService', ['clearEditorMap']);
    campaignService = jasmine.createSpyObj('CampaignService', ['getAllLevels', 'getCompletedCount']);
    campaignService.getAllLevels.and.returnValue(new Array(16).fill({}));
    campaignService.getCompletedCount.and.returnValue(0);

    await TestBed.configureTestingModule({
      declarations: [LandingComponent],
      imports: [CommonModule],
      providers: [
        { provide: Router, useValue: router },
        { provide: MapBridgeService, useValue: mapBridge },
        { provide: CampaignService, useValue: campaignService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the game title', () => {
    const title = fixture.nativeElement.querySelector('.landing-title');
    expect(title.textContent).toContain('NOVARISE');
  });

  it('should render the subtitle', () => {
    const subtitle = fixture.nativeElement.querySelector('.landing-subtitle');
    expect(subtitle.textContent).toContain('Tower Defense');
  });

  it('should render five navigation buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.landing-btn');
    expect(buttons.length).toBe(5);
  });

  it('should have Campaign as the primary CTA', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.landing-btn');
    expect(buttons[0].textContent).toContain('Campaign');
    expect(buttons[0].classList).toContain('landing-btn--primary');
  });

  it('should have Quick Play, Select Map, and Create Map buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.landing-btn');
    expect(buttons[1].textContent).toContain('Quick Play');
    expect(buttons[2].textContent).toContain('Select Map');
    expect(buttons[3].textContent).toContain('Create Map');
  });

  it('should navigate to /edit when Create Map is clicked', () => {
    component.goToEditor();
    expect(router.navigate).toHaveBeenCalledWith(['/edit']);
  });

  it('should navigate to /maps when Select Map is clicked', () => {
    component.goToMapSelect();
    expect(router.navigate).toHaveBeenCalledWith(['/maps']);
  });

  it('should clear editor map and navigate to /play with quickplay param when Quick Play is clicked', () => {
    component.quickPlay();
    expect(mapBridge.clearEditorMap).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/play'], { queryParams: { quickplay: 'true' } });
  });

  it('should navigate to /profile when Profile is clicked', () => {
    component.goToProfile();
    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
  });

  it('should navigate to /campaign when Campaign is clicked', () => {
    component.goToCampaign();
    expect(router.navigate).toHaveBeenCalledWith(['/campaign']);
  });

  describe('campaign progress indicator', () => {
    it('should not show progress indicator when campaignProgress is 0', () => {
      campaignService.getCompletedCount.and.returnValue(0);
      component.ngOnInit();
      fixture.detectChanges();
      const progress = fixture.nativeElement.querySelector('.landing-btn__progress');
      expect(progress).toBeNull();
    });

    it('should show progress indicator when campaignProgress > 0', () => {
      campaignService.getCompletedCount.and.returnValue(3);
      component.ngOnInit();
      fixture.detectChanges();
      const progress = fixture.nativeElement.querySelector('.landing-btn__progress');
      expect(progress).not.toBeNull();
      expect(progress.textContent).toContain('3/16');
    });

    it('should show full progress when all levels completed', () => {
      campaignService.getCompletedCount.and.returnValue(16);
      component.ngOnInit();
      fixture.detectChanges();
      const progress = fixture.nativeElement.querySelector('.landing-btn__progress');
      expect(progress).not.toBeNull();
      expect(progress.textContent).toContain('16/16');
    });

    it('campaignProgress reflects getCompletedCount from service', () => {
      campaignService.getCompletedCount.and.returnValue(7);
      component.ngOnInit();
      expect(component.campaignProgress).toBe(7);
    });

    it('campaignTotal reflects getAllLevels length from service', () => {
      expect(component.campaignTotal).toBe(16);
    });
  });
});
