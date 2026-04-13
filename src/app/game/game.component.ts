import { Component, ViewChild } from '@angular/core';
import { GameBoardComponent } from './game-board/game-board.component';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent {
  @ViewChild(GameBoardComponent) gameBoard?: GameBoardComponent;

  canLeaveGame(): boolean {
    return this.gameBoard?.canLeaveGame() ?? true;
  }
}
