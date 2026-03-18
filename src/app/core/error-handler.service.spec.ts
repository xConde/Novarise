import { TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './error-handler.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let consoleSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }],
    });
    handler = TestBed.inject(ErrorHandler) as GlobalErrorHandler;
    consoleSpy = spyOn(console, 'error');
  });

  it('should call console.error with the error', () => {
    const error = new Error('test error');
    handler.handleError(error);
    expect(consoleSpy).toHaveBeenCalledWith('Uncaught error:', error);
  });

  it('should not rethrow the error', () => {
    const error = new Error('test error');
    expect(() => handler.handleError(error)).not.toThrow();
  });
});
