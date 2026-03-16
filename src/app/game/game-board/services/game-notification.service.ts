import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export enum NotificationType {
  ACHIEVEMENT = 'achievement',
  CHALLENGE = 'challenge',
  STREAK = 'streak',
  INFO = 'info',
}

export interface GameNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  duration: number; // ms before auto-dismiss
}

const MAX_VISIBLE_NOTIFICATIONS = 3;
const DEFAULT_DURATION_MS = 3500;
const ACHIEVEMENT_DURATION_MS = 5000;

@Injectable()
export class GameNotificationService {
  private notifications$ = new BehaviorSubject<GameNotification[]>([]);
  private nextId = 0;

  getNotifications(): Observable<GameNotification[]> {
    return this.notifications$.asObservable();
  }

  show(
    type: NotificationType,
    title: string,
    message: string,
    duration?: number
  ): void {
    const notification: GameNotification = {
      id: this.nextId++,
      type,
      title,
      message,
      duration:
        duration ??
        (type === NotificationType.ACHIEVEMENT
          ? ACHIEVEMENT_DURATION_MS
          : DEFAULT_DURATION_MS),
    };
    const current = this.notifications$.value;
    // Keep max visible, drop oldest if over limit
    const updated = [...current, notification].slice(-MAX_VISIBLE_NOTIFICATIONS);
    this.notifications$.next(updated);

    // Auto-dismiss after duration
    setTimeout(() => this.dismiss(notification.id), notification.duration);
  }

  dismiss(id: number): void {
    const current = this.notifications$.value;
    this.notifications$.next(current.filter(n => n.id !== id));
  }

  clear(): void {
    this.notifications$.next([]);
    this.nextId = 0;
  }
}
