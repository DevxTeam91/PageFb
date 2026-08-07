import * as admin from 'firebase-admin';

let isFirebaseInitialized = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    });
    isFirebaseInitialized = true;
    console.log('[Firebase] Initialized with Service Account.');
  } else {
    console.log('[Firebase] No FIREBASE_SERVICE_ACCOUNT found. Push notifications will be mocked.');
  }
} catch (e) {
  console.warn('[Firebase] Failed to initialize firebase-admin:', e);
}

export const sendPushNotification = async (token: string, payload: admin.messaging.MessagingPayload) => {
  if (!isFirebaseInitialized) {
    console.log(`[Firebase Mock] Sending Push to ${token.substring(0, 10)}...`);
    console.log(`[Firebase Mock] Payload:`, JSON.stringify(payload));
    return true; // Mock success
  }

  try {
    const response = await admin.messaging().sendToDevice(token, payload);
    console.log(`[Firebase] Successfully sent message to token ${token.substring(0, 10)}...:`, response.successCount, 'successes');
    return response.successCount > 0;
  } catch (error) {
    console.error('[Firebase] Error sending message:', error);
    return false;
  }
};
