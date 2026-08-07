import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class Message extends Model {
  static table = 'messages';

  @field('conversation_id') conversationId!: string;
  @field('fb_message_id') fbMessageId?: string;
  @field('direction') direction!: string;
  @field('text') text!: string;
  @field('attachments_json') attachmentsJson?: string;
  
  @date('created_at') createdAt!: number;
}
