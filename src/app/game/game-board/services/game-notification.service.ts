import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NotificationType, GameNotification } from '../models/game-notification.model';

export { NotificationType, GameNotification } from '../models/game-notification.model';

const MAX_VISIBLE_NOTIFICATIONS = 3;
const DEFAULT_DURATION_MS = 3500;
const ACHIEVEMENT_DURATION_MS = 5000;

@Injectable()
export class GameNotificationService {
  private notifications$ = new BehaviorSubject<GameNotification[]>([]);
  private nextId = 0;
  private pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();

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
    const timerId = setTimeout(() => this.dismiss(notification.id), notification.duration);
    this.pendingTimers.set(notification.id, timerId);
  }

  dismiss(id: number): void {
    const timer = this.pendingTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.pendingTimers.delete(id);
    }
    const current = this.notifications$.value;
    this.notifications$.next(current.filter(n => n.id !== id));
  }

  clear(): void {
    this.pendingTimers.forEach(timer => clearTimeout(timer));
    this.pendingTimers.clear();
    this.notifications$.next([]);
    this.nextId = 0;
  }
}
