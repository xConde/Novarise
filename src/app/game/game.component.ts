import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit {
  title = 'Novarise';
  hoverIndex: number | null = null;
  isClicked = false;

  constructor() { }

  ngOnInit(): void {
  }

}
