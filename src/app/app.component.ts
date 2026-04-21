import { Component, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '../environments/environment';

const SETTINGS_PATH = '/settings';
const DEFAULT_PATH = '/';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnDestroy {
  title = 'Novarise';
  readonly enableDevTools = environment.enableDevTools;
  private previousUrl = DEFAULT_PATH;
  private currentUrl = DEFAULT_PATH;
  private routerSub: Subscription;

  constructor(private router: Router) {
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      if (this.currentUrl !== SETTINGS_PATH) {
        this.previousUrl = this.currentUrl;
      }
      this.currentUrl = e.urlAfterRedirects;
    });
  }

  toggleSettings(): void {
    if (this.currentUrl === SETTINGS_PATH) {
      this.router.navigateByUrl(this.previousUrl);
    } else {
      this.router.navigateByUrl(SETTINGS_PATH);
    }
  }

  ngOnDestroy(): void {
    this.routerSub.unsubscribe();
  }
}
