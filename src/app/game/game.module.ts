import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameComponent } from './game.component';
import { GameBoardComponent } from './game-board/game-board.component';
import { GameHUDComponent } from './game-board/components/game-hud/game-hud.component';
import { GameResultsComponent } from './game-board/components/game-results/game-results.component';
import { GameSetupComponent } from './game-board/components/game-setup/game-setup.component';
import { TowerInfoPanelComponent } from './game-board/components/tower-info-panel/tower-info-panel.component';
import { GameControlsComponent } from './game-board/components/game-controls/game-controls.component';
import { TowerSelectionBarComponent } from './game-board/components/tower-selection-bar/tower-selection-bar.component';
import { GameBoardService } from './game-board/game-board.service';
@NgModule({
  declarations: [
    GameComponent,
    GameBoardComponent,
    GameHUDComponent,
    GameResultsComponent,
    GameSetupComponent,
    TowerInfoPanelComponent,
    GameControlsComponent,
    TowerSelectionBarComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: GameComponent }])
  ],
  providers: [GameBoardService]
})
export class GameModule {}
