import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  AuthorizationStatus
} from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import * as api from './api'; // Ensure this points to the authenticated API class

export class NotificationsManager {
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const messagingInstance = getMessaging();
        if (messagingInstance) {
          const authStatus = await requestPermission(messagingInstance);
          return (
            authStatus === AuthorizationStatus.AUTHORIZED ||
            authStatus === AuthorizationStatus.PROVISIONAL
          );
        }
      } catch (e) {
        console.warn('[Notifications] Could not request permission', e);
      }
      return true; // Fallback for older versions or missing implementation
    }
    return true; // iOS permission handling if needed
  }

  static async init(navigateFn?: (conversationId: string) => void) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.log('[Notifications] Permission denied');
      return;
    }

    try {
      const messagingInstance = getMessaging();
      const token = await getToken(messagingInstance);
      console.log('[Notifications] FCM Token:', token);
      await this.registerToken(token);

      // Listen for token refresh
      onTokenRefresh(messagingInstance, async (newToken) => {
        console.log('[Notifications] FCM Token Refreshed:', newToken);
        await this.registerToken(newToken);
      });
    } catch (e) {
      console.error('[Notifications] Failed to get FCM token', e);
    }

    try {
      const messagingInstance = getMessaging();
      // Handle messages while app is in foreground
      onMessage(messagingInstance, async (remoteMessage) => {
        console.log('[Notifications] Foreground Message:', remoteMessage.notification);
        // Socket.IO handles foreground realtime rendering, but if the socket fails or isn't connected, we can show a notification.
      });

      // Handle background notification tap
      onNotificationOpenedApp(messagingInstance, (remoteMessage) => {
        console.log('[Notifications] Notification opened from background:', remoteMessage);
        const conversationId = remoteMessage.data?.conversationId;
        if (conversationId && navigateFn) {
          navigateFn(conversationId);
        }
      });

      // Handle quit-state notification tap
      getInitialNotification(messagingInstance).then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[Notifications] Notification opened from quit state:', remoteMessage);
          const conversationId = remoteMessage.data?.conversationId;
          if (conversationId && navigateFn) {
            // Delay to allow navigation stack to mount
            setTimeout(() => navigateFn(conversationId), 1000);
          }
        }
      });
    } catch (e) {
      console.warn('[Notifications] Failed to setup listeners (native module missing)', e);
    }
  }

  static async displayLocalNotification(title: string, body: string, conversationId: string) {
    try {
      if (Platform.OS === 'android') {
        await notifee.requestPermission();
        const channelId = await notifee.createChannel({
          id: 'messages',
          name: 'Messages',
          importance: AndroidImportance.HIGH,
        });

        await notifee.displayNotification({
          title,
          body,
          data: { conversationId },
          android: {
            channelId,
            importance: AndroidImportance.HIGH,
            pressAction: {
              id: 'default',
            },
          },
        });
      }
    } catch (e) {
      console.error('[Notifications] Failed to display local notification:', e);
    }
  }

  private static async registerToken(token: string) {
    try {
      await api.registerDeviceToken(token);
      console.log('[Notifications] Token registered with backend');
    } catch (e) {
      console.error('[Notifications] Failed to register token with backend', e);
    }
  }
}
