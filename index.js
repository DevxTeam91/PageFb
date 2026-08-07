/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { database } from './src/database';
import { fetchConversations } from './src/services/api';
import ConversationModel from './src/database/models/Conversation';

// PHASE 6: Headless Background Sync
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('[BackgroundSync] Received background push, syncing conversations...', remoteMessage);
  try {
    // Perform a headless Delta Sync
    const list = await fetchConversations();
    await database.write(async () => {
      const batch = [];
      for (const conv of list) {
        const existing = await database.collections.get('conversations').find(conv.id).catch(() => null);
        if (existing) {
          batch.push(existing.prepareUpdate(c => {
            c.userName = conv.userName;
            c.lastMessageAt = new Date(conv.lastMessageAt).getTime();
            c.unread = conv.unread;
          }));
        } else {
          batch.push(database.collections.get('conversations').prepareCreate(c => {
            c._raw.id = conv.id;
            c.psid = conv.psid;
            c.pageId = conv.pageId || '';
            c.userName = conv.userName;
            c.lastMessageAt = new Date(conv.lastMessageAt).getTime();
            c.unread = conv.unread;
          }));
        }
      }
      await database.batch(batch);
    });
    console.log('[BackgroundSync] Headless sync complete.');
  } catch (error) {
    console.error('[BackgroundSync] Headless sync failed:', error);
  }
});

AppRegistry.registerComponent(appName, () => App);
