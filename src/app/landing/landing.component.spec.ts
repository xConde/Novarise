import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LandingComponent } from './landing.component';
import { MapBridgeService } from '../game/game-board/services/map-bridge.service';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let router: jasmine.SpyObj<Router>;
  let mapBridge: jasmine.SpyObj<MapBridgeService>;

  beforeEach(async () => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    mapBridge = jasmine.createSpyObj('MapBridgeService', ['clearEditorMap']);

    await TestBed.configureTestingModule({
      declarations: [LandingComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: MapBridgeService, useValue: mapBridge }
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

  it('should render three navigation buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.landing-btn');
    expect(buttons.length).toBe(3);
  });

  it('should have a Create Map button', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.landing-btn');
    expect(buttons[0].textContent).toContain('Create Map');
  });

  it('should have a Play button', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.landing-btn');
    expect(buttons[1].textContent).toContain('Play');
  });

  it('should have a Quick Play button', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.landing-btn');
    expect(buttons[2].textContent).toContain('Quick Play');
  });

  it('should navigate to /edit when Create Map is clicked', () => {
    component.goToEditor();
    expect(router.navigate).toHaveBeenCalledWith(['/edit']);
  });

  it('should navigate to /maps when Play is clicked', () => {
    component.goToMapSelect();
    expect(router.navigate).toHaveBeenCalledWith(['/maps']);
  });

  it('should clear editor map and navigate to /play with quickplay param when Quick Play is clicked', () => {
    component.quickPlay();
    expect(mapBridge.clearEditorMap).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/play'], { queryParams: { quickplay: 'true' } });
  });
});
