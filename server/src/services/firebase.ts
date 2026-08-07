import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';

let isFirebaseInitialized = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
    isFirebaseInitialized = true;
    console.log('[Firebase] Initialized with Service Account.');
  } else {
    console.log('[Firebase] No FIREBASE_SERVICE_ACCOUNT found. Push notifications will be mocked.');
  }
} catch (e) {
  console.warn('[Firebase] Failed to initialize firebase-admin:', e);
}

export const sendPushNotification = async (token: string, payload: { notification?: { title?: string; body?: string }; data?: { [key: string]: string } }) => {
  if (!isFirebaseInitialized) {
    console.log(`[Firebase Mock] Sending Push to ${token.substring(0, 10)}...`);
    console.log(`[Firebase Mock] Payload:`, JSON.stringify(payload));
    return true; // Mock success
  }

  try {
    const message: Message = {
      token: token,
      notification: payload.notification,
      data: payload.data,
      android: {
        notification: {
          channelId: 'default' // Required for Android 8+
        }
      }
    };
    const response = await getMessaging().send(message);
    console.log(`[Firebase] Successfully sent message to token ${token.substring(0, 10)}...:`, response);
    return true;
  } catch (error) {
    console.error('[Firebase] Error sending message:', error);
    return false;
  }
};
