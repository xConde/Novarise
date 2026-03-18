import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameComponent } from './game.component';
import { GameBoardComponent } from './game-board/game-board.component';
import { GameBoardService } from './game-board/game-board.service';
import { CombatVFXService } from './game-board/services/combat-vfx.service';
import { TutorialSpotlightComponent } from './game-board/components/tutorial-spotlight/tutorial-spotlight.component';
import { GameHudComponent } from './game-board/components/game-hud/game-hud.component';
import { GameSetupPanelComponent } from './game-board/components/game-setup-panel/game-setup-panel.component';
import { TowerInfoPanelComponent } from './game-board/components/tower-info-panel/tower-info-panel.component';
import { GameResultsOverlayComponent } from './game-board/components/game-results-overlay/game-results-overlay.component';
@NgModule({
  declarations: [
    GameComponent,
    GameBoardComponent,
    TutorialSpotlightComponent,
    GameHudComponent,
    GameSetupPanelComponent,
    TowerInfoPanelComponent,
    GameResultsOverlayComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: GameComponent }])
  ],
  providers: [GameBoardService, CombatVFXService]
})
export class GameModule {}
