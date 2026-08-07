import { Model } from '@nozbe/watermelondb';
import { field, date, text } from '@nozbe/watermelondb/decorators';

export class PendingQueue extends Model {
  static table = 'pending_queue';

  @text('conversation_id') conversationId!: string;
  @text('page_id') pageId!: string;
  @text('text') text!: string;
  @text('attachments_json') attachmentsJson?: string;
  @field('retry_count') retryCount!: number;
  @date('last_retry') lastRetry!: number;
  @text('last_error') lastError?: string;
  @date('created_at') createdAt!: number;
  @text('status') status!: string; // 'pending' | 'sending' | 'failed'
}
