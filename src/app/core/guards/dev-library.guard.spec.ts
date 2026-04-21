import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { devLibraryGuard } from './dev-library.guard';
import { environment } from '../../../environments/environment';

describe('devLibraryGuard', () => {
  let routerCreateUrlTreeSpy: jasmine.Spy;
  let stubUrlTree: UrlTree;
  let originalDevTools: boolean;

  beforeEach(() => {
    originalDevTools = environment.enableDevTools;
    stubUrlTree = {} as UrlTree;
    routerCreateUrlTreeSpy = jasmine.createSpy('createUrlTree').and.returnValue(stubUrlTree);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: routerCreateUrlTreeSpy } }],
    });
  });

  afterEach(() => {
    (environment as { enableDevTools: boolean }).enableDevTools = originalDevTools;
  });

  it('returns true when enableDevTools is on', () => {
    (environment as { enableDevTools: boolean }).enableDevTools = true;
    const result = TestBed.runInInjectionContext(() => devLibraryGuard({} as never, {} as never));
    expect(result).toBe(true);
    expect(routerCreateUrlTreeSpy).not.toHaveBeenCalled();
  });

  it('redirects to / when enableDevTools is off', () => {
    (environment as { enableDevTools: boolean }).enableDevTools = false;
    const result = TestBed.runInInjectionContext(() => devLibraryGuard({} as never, {} as never));
    expect(result).toBe(stubUrlTree);
    expect(routerCreateUrlTreeSpy).toHaveBeenCalledWith(['/']);
  });
});
