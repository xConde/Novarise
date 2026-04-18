import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Dev-only route gate for /library. In non-dev builds the route redirects
 * to `/`; in dev builds it allows through. Drives the env flag defined in
 * environment.ts (`enableDevTools`).
 */
export const devLibraryGuard: CanActivateFn = (): boolean | UrlTree => {
  if (environment.enableDevTools) return true;
  return inject(Router).createUrlTree(['/']);
};
