import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface EditorNotification {
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable()
export class EditorNotificationService {
  private notification$ = new BehaviorSubject<EditorNotification | null>(null);
  private pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 0;

  getNotification(): Observable<EditorNotification | null> {
    return this.notification$.asObservable();
  }

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000): void {
    this.pendingTimers.forEach(timer => clearTimeout(timer));
    this.pendingTimers.clear();
    this.notification$.next({ message, type });
    const id = this.nextId++;
    const timerId = setTimeout(() => {
      this.dismiss();
      this.pendingTimers.delete(id);
    }, duration);
    this.pendingTimers.set(id, timerId);
  }

  dismiss(): void {
    this.notification$.next(null);
  }

  clear(): void {
    this.pendingTimers.forEach(timer => clearTimeout(timer));
    this.pendingTimers.clear();
    this.notification$.next(null);
  }
}
