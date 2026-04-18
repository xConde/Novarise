import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Route gate for /library. Allows through when `enableDevTools` is on
 * (phase 5+ will drop the flag); redirects to `/` otherwise.
 */
export const devLibraryGuard: CanActivateFn = (): boolean | UrlTree => {
  if (environment.enableDevTools) return true;
  return inject(Router).createUrlTree(['/']);
};
