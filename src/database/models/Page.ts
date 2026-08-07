import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class Page extends Model {
  static table = 'pages';

  @field('page_id') pageId!: string;
  @field('name') name!: string;
  @field('picture_url') pictureUrl?: string;
  @field('is_active') isActive!: boolean;
  @field('total_conversations') totalConversations!: number;
  @field('unread_conversations') unreadConversations!: number;
  @date('created_at') createdAt!: number;
}
