import { fakeAsync, tick } from '@angular/core/testing';
import { GameNotificationService, GameNotification, NotificationType } from './game-notification.service';

describe('GameNotificationService', () => {
  let service: GameNotificationService;

  beforeEach(() => {
    service = new GameNotificationService();
  });

  describe('show()', () => {
    it('should add a notification to the list', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'Title', 'Message');

      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toBe('Title');
      expect(notifs[0].message).toBe('Message');
      expect(notifs[0].type).toBe(NotificationType.INFO);
    });

    it('should assign incrementing ids', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'A', 'a');
      service.show(NotificationType.INFO, 'B', 'b');

      expect(notifs[0].id).toBe(0);
      expect(notifs[1].id).toBe(1);
    });

    it('should use ACHIEVEMENT_DURATION_MS for achievement type by default', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.ACHIEVEMENT, 'Ach', 'msg');

      expect(notifs[0].duration).toBe(5000);
    });

    it('should use DEFAULT_DURATION_MS for non-achievement types', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'Info', 'msg');

      expect(notifs[0].duration).toBe(3500);
    });

    it('should use custom duration when provided', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.STREAK, 'Streak', 'msg', 9000);

      expect(notifs[0].duration).toBe(9000);
    });

    it('should cap visible notifications at 3, dropping the oldest', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'A', 'a');
      service.show(NotificationType.INFO, 'B', 'b');
      service.show(NotificationType.INFO, 'C', 'c');
      service.show(NotificationType.INFO, 'D', 'd');

      expect(notifs.length).toBe(3);
      expect(notifs[0].title).toBe('B');
      expect(notifs[1].title).toBe('C');
      expect(notifs[2].title).toBe('D');
    });
  });

  describe('dismiss()', () => {
    it('should remove the notification with the given id', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'A', 'a');
      service.show(NotificationType.INFO, 'B', 'b');
      const idToRemove = notifs[0].id;

      service.dismiss(idToRemove);

      expect(notifs.length).toBe(1);
      expect(notifs[0].title).toBe('B');
    });

    it('should be a no-op for an unknown id', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'A', 'a');
      service.dismiss(999);

      expect(notifs.length).toBe(1);
    });
  });

  describe('clear()', () => {
    it('should empty all notifications', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'A', 'a');
      service.show(NotificationType.STREAK, 'B', 'b');
      service.clear();

      expect(notifs.length).toBe(0);
    });

    it('should reset id counter to 0', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'A', 'a');
      service.clear();
      service.show(NotificationType.INFO, 'B', 'b');

      expect(notifs[0].id).toBe(0);
    });
  });

  describe('auto-dismiss', () => {
    it('should auto-dismiss after duration', fakeAsync(() => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.INFO, 'Auto', 'dismiss me', 1000);
      expect(notifs.length).toBe(1);

      tick(1000);
      expect(notifs.length).toBe(0);
    }));

    it('should auto-dismiss achievement after 5000ms', fakeAsync(() => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      service.show(NotificationType.ACHIEVEMENT, 'Ach', 'unlocked');
      expect(notifs.length).toBe(1);

      tick(4999);
      expect(notifs.length).toBe(1);

      tick(1);
      expect(notifs.length).toBe(0);
    }));
  });

  describe('getNotifications()', () => {
    it('should return an observable of the current notification list', () => {
      let notifs: GameNotification[] = [];
      service.getNotifications().subscribe(n => { notifs = n; });

      expect(notifs.length).toBe(0);
    });
  });
});
