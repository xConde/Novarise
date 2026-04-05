import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // Log to console (future: external reporting)
    console.error('Uncaught error:', error);
  }
}
