import { Component, HostListener, OnInit } from '@angular/core';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit {
  title = 'Novarise';
  hoverIndex: number | null = null;
  ccSession = false;
  arrows: string[] = [];

  constructor() { }

  ngOnInit(): void {
  }

  isClicked() {
    this.ccSession = !this.ccSession;
    this.resetCCSession();
  }

  resetCCSession() {
    if (this.arrows.length === 8) { setTimeout(() => { this.ccSession = false; this.arrows = []; }, 1000); }
    if (!this.ccSession) { this.arrows = []; }
  }

  @HostListener('window:keydown', ['$event'])
  onArrowKeydown(event: KeyboardEvent) {
    if (!this.ccSession && this.arrows.length > 7) { return; }
      const arrowKeyCodes = [37, 38, 39, 40];
      if (arrowKeyCodes.includes(event.keyCode)) {
        event.preventDefault();
        this.arrows.push(event.key);
    }
    this.resetCCSession();
  }

}
