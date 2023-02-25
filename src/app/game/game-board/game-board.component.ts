import { Component, OnInit } from '@angular/core';
import { GameBoardService } from './game-board.service';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.css'],
  providers: [GameBoardService]
})
export class GameBoardComponent implements OnInit {
  constructor(private gameBoardService: GameBoardService) {}

  ngOnInit() {}

}
