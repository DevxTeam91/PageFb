import { Model } from '@nozbe/watermelondb';
import { field, date, relation } from '@nozbe/watermelondb/decorators';

export default class Conversation extends Model {
  static table = 'conversations';

  @field('psid') psid!: string;
  @field('page_id') pageId!: string;
  @field('user_name') userName?: string;
  @field('user_avatar_url') userAvatarUrl?: string;
  @date('last_message_at') lastMessageAt!: number;
  @field('unread') unread!: boolean;
  
  @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
