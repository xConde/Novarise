import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;

  beforeEach(() => {
    handler = new GlobalErrorHandler();
  });

  it('should implement ErrorHandler', () => {
    const errorHandler: ErrorHandler = handler;
    expect(errorHandler.handleError).toBeDefined();
  });

  it('should log error message to console.error', () => {
    spyOn(console, 'error');
    const error = new Error('test error');

    handler.handleError(error);

    expect(console.error).toHaveBeenCalledWith('Unhandled error:', 'test error');
  });

  it('should log stack trace when available', () => {
    spyOn(console, 'error');
    const error = new Error('test error');

    handler.handleError(error);

    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(error.stack);
  });

  it('should handle string errors', () => {
    spyOn(console, 'error');

    handler.handleError('string error');

    expect(console.error).toHaveBeenCalledWith('Unhandled error:', 'string error');
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('should handle number errors', () => {
    spyOn(console, 'error');

    handler.handleError(42);

    expect(console.error).toHaveBeenCalledWith('Unhandled error:', '42');
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
