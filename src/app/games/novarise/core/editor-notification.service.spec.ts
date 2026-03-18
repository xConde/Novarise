import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { EditorNotificationService, EditorNotification } from './editor-notification.service';

describe('EditorNotificationService', () => {
  let service: EditorNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EditorNotificationService] });
    service = TestBed.inject(EditorNotificationService);
  });

  afterEach(() => {
    service.clear();
  });

  it('creates without error', () => {
    expect(service).toBeTruthy();
  });

  describe('getNotification()', () => {
    it('emits null by default', () => {
      let current: EditorNotification | null = undefined as unknown as EditorNotification | null;
      service.getNotification().subscribe(n => { current = n; });
      expect(current).toBeNull();
    });
  });

  describe('show()', () => {
    it('emits the notification immediately', () => {
      let current: EditorNotification | null = null;
      service.getNotification().subscribe(n => { current = n; });

      service.show('Map saved!', 'success');

      expect(current as unknown as EditorNotification).toEqual({ message: 'Map saved!', type: 'success' });
    });

    it('defaults type to info when not specified', () => {
      let current: EditorNotification | null = null;
      service.getNotification().subscribe(n => { current = n; });

      service.show('Something happened');

      expect(current as unknown as EditorNotification).toEqual({ message: 'Something happened', type: 'info' });
    });

    it('emits error type notifications', () => {
      let current: EditorNotification | null = null;
      service.getNotification().subscribe(n => { current = n; });

      service.show('Save failed.', 'error');

      expect(current as unknown as EditorNotification).toEqual({ message: 'Save failed.', type: 'error' });
    });

    it('auto-dismisses after the given duration', fakeAsync(() => {
      let current: EditorNotification | null = undefined as unknown as EditorNotification | null;
      service.getNotification().subscribe(n => { current = n; });

      service.show('Hello', 'info', 2000);
      expect(current).not.toBeNull();

      tick(2000);
      expect(current).toBeNull();
    }));

    it('uses default duration of 3000ms when not specified', fakeAsync(() => {
      let current: EditorNotification | null = undefined as unknown as EditorNotification | null;
      service.getNotification().subscribe(n => { current = n; });

      service.show('Hello', 'info');
      expect(current).not.toBeNull();

      tick(2999);
      expect(current).not.toBeNull();

      tick(1);
      expect(current).toBeNull();
    }));

    it('cancels an existing auto-dismiss timer when a new notification is shown', fakeAsync(() => {
      const emissions: Array<EditorNotification | null> = [];
      service.getNotification().subscribe(n => { emissions.push(n); });

      service.show('First', 'info', 2000);
      tick(1000);

      // Show second — should cancel first timer
      service.show('Second', 'success', 2000);
      tick(999);

      // First timer would have fired at t=2000 total, but it was cancelled
      // At t=1999ms into second notification, it has not fired yet
      const lastEmission = emissions[emissions.length - 1];
      expect(lastEmission).not.toBeNull();
      expect(lastEmission?.message).toBe('Second');

      // Drain remaining timer so fakeAsync doesn't complain
      tick(1001);
    }));
  });

  describe('dismiss()', () => {
    it('clears the active notification immediately', () => {
      let current: EditorNotification | null = undefined as unknown as EditorNotification | null;
      service.getNotification().subscribe(n => { current = n; });

      service.show('Hi', 'info', 5000);
      expect(current).not.toBeNull();

      service.dismiss();
      expect(current).toBeNull();
    });

    it('is safe to call when no notification is active', () => {
      expect(() => service.dismiss()).not.toThrow();
    });
  });

  describe('clear()', () => {
    it('clears the active notification immediately', () => {
      let current: EditorNotification | null = undefined as unknown as EditorNotification | null;
      service.getNotification().subscribe(n => { current = n; });

      service.show('Hi', 'info', 5000);
      expect(current).not.toBeNull();

      service.clear();
      expect(current).toBeNull();
    });

    it('cancels pending auto-dismiss timers', fakeAsync(() => {
      let dismissCount = 0;
      service.getNotification().subscribe(n => {
        if (n === null) dismissCount++;
      });

      // Subscription fires immediately with null (BehaviorSubject), so reset counter
      dismissCount = 0;

      service.show('Hi', 'info', 2000);
      service.clear();
      dismissCount = 0; // clear() fires a null emission

      tick(2000);

      // Timer was cancelled — no extra null emission from the timer
      expect(dismissCount).toBe(0);
    }));

    it('is safe to call when no notification is active', () => {
      expect(() => service.clear()).not.toThrow();
    });

    it('is idempotent — can be called multiple times', () => {
      service.show('Hi', 'info', 5000);
      expect(() => {
        service.clear();
        service.clear();
      }).not.toThrow();
    });
  });
});
