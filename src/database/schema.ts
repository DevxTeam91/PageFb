import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'pages',
      columns: [
        { name: 'page_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'picture_url', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'total_conversations', type: 'number' },
        { name: 'unread_conversations', type: 'number' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'conversations',
      columns: [
        { name: 'psid', type: 'string', isIndexed: true },
        { name: 'page_id', type: 'string', isIndexed: true },
        { name: 'user_name', type: 'string', isOptional: true },
        { name: 'user_avatar_url', type: 'string', isOptional: true },
        { name: 'last_message_at', type: 'number', isIndexed: true },
        { name: 'unread', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'conversation_id', type: 'string', isIndexed: true },
        { name: 'fb_message_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'direction', type: 'string' },
        { name: 'text', type: 'string' },
        { name: 'attachments_json', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'pending_queue',
      columns: [
        { name: 'conversation_id', type: 'string' },
        { name: 'page_id', type: 'string' },
        { name: 'text', type: 'string' },
        { name: 'attachments_json', type: 'string', isOptional: true },
        { name: 'retry_count', type: 'number' },
        { name: 'last_retry', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'status', type: 'string' }, // 'pending' | 'sending' | 'failed'
      ],
    }),
  ],
});
