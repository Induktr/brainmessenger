import type { Message } from '@/types/chat';

class NotificationService {
  private static instance: NotificationService;
  private hasPermission: boolean = false;

  private constructor() {
    this.initializeNotifications();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initializeNotifications() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
    }
  }

  async showMessageNotification(message: Message) {
    // In-app notification using toast
    this.showToast(`New message: ${message.content}`);

    // Push notification if permission granted and window not focused
    if (this.hasPermission && !document.hasFocus()) {
      this.showPushNotification(message);
    }
  }

  private showToast(message: string) {
    // You can integrate this with your preferred toast library
    // For example, using react-hot-toast:
    // toast(message);
    console.log('Toast:', message);
  }

  private showPushNotification(message: Message) {
    if (!('Notification' in window)) return;

    new Notification('New Message', {
      body: message.content,
      icon: '/app-icon.png', // Add your app icon path
    });
  }
}

export const notificationService = NotificationService.getInstance();
