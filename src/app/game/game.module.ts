import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { GameComponent } from './game.component';
import { GameBoardComponent } from './game-board/game-board.component';
import { GameBoardService } from './game-board/game-board.service';
import { AudioService } from './game-board/services/audio.service';

@NgModule({
  declarations: [
    GameComponent,
    GameBoardComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: GameComponent }])
  ],
  providers: [GameBoardService, AudioService]
})
export class GameModule {}
