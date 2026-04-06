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
