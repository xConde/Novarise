import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { GameBoardComponent } from './game-board.component';
import { GameBoardService } from './game-board.service';
import { MapBridgeService } from './services/map-bridge.service';

describe('GameBoardComponent', () => {
  let component: GameBoardComponent;
  let fixture: ComponentFixture<GameBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GameBoardComponent ],
      imports: [ RouterTestingModule ],
      providers: [ GameBoardService, MapBridgeService ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GameBoardComponent);
    component = fixture.componentInstance;
    // Don't call detectChanges here - it triggers ngOnInit which needs a canvas
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('goToEditor', () => {
    it('should navigate to /edit', () => {
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.goToEditor();

      expect(router.navigate).toHaveBeenCalledWith(['/edit']);
    });
  });
});
