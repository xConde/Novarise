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
  ccCompleteStatus: 'fail' | 'success' | '';
  ccArrows: string[] = [];
  ccs: { code: string[], successMessage: string }[] = [
    { code: ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right'], successMessage: 'Success!' },
    { code: ['up', 'up', 'down', 'down', 'left', 'left', 'right', 'right'], successMessage: 'Success!' },
    { code: ['left', 'left', 'up', 'down', 'up', 'down', 'right', 'right'], successMessage: 'Success!' }
  ];

  constructor() { }

  ngOnInit(): void {
  }

  isClicked() {
    if (this.ccCompleteStatus) { return; }
    this.ccSession = !this.ccSession;
    this.resetCCSession();
  }

  resetCCSession() {
    if (this.ccArrows.length === 8) { this.checkCheatCodes(); }
    if (!this.ccSession) { this.ccArrows = []; }
  }

  checkCheatCodes() {
    const matchingCheatCodes = this.ccs
      .filter(code => code.code.length <= this.ccArrows.length)
      .filter(code => code.code.every((val, i) => val === this.ccArrows[i]));

    this.ccCompleteStatus = matchingCheatCodes.length > 0 ? 'success' : 'fail';
    setTimeout(() => {
      this.ccSession = false;
      this.ccArrows = [];
      this.ccCompleteStatus = '';
    }, 4000);
  }

  @HostListener('window:keydown', ['$event'])
  onArrowKeydown(event: KeyboardEvent) {
    if (!this.ccSession && this.ccArrows.length > 7) { return; }
      const arrowKeyCodes = [37, 38, 39, 40];
      if (arrowKeyCodes.includes(event.keyCode)) {
        const arrowKeyMap: { [key: string]: string } = {
          'ArrowUp': 'up',
          'ArrowDown': 'down',
          'ArrowLeft': 'left',
          'ArrowRight': 'right'
        };
        event.preventDefault();
        this.ccArrows.push(arrowKeyMap[event.key]);
    }
    this.resetCCSession();
  }

}
