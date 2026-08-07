import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import Page from './models/Page';
import Conversation from './models/Conversation';
import Message from './models/Message';
import { PendingQueue } from './models/PendingQueue';

const adapter = new SQLiteAdapter({
  schema,
  jsi: true, // required for high performance React Native
  onSetUpError: error => {
    console.error('[WatermelonDB] Setup error:', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Page,
    Conversation,
    Message,
    PendingQueue,
  ],
});
