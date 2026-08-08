import crypto from 'crypto';

export interface GraphApiMessage {
  id: string;
  message?: string;
  from?: { id: string; name?: string };
  to?: { data?: Array<{ id: string; name?: string }> };
  created_time?: string;
}

export interface GraphApiConversation {
  id: string;
  snippet?: string;
  updated_time?: string;
  unread_count?: number;
  participants?: { data: Array<{ id: string; name?: string; email?: string }> };
  senders?: { data: Array<{ id: string; name?: string }> };
  messages?: { data: GraphApiMessage[] };
}

export interface PageDetailsResponse {
  id: string;
  name: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

export interface UserProfileResponse {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
}

export interface SendMessageResponse {
  recipient_id: string;
  message_id: string;
}

export class GraphApiClient {
  private baseUrl: string;
  private accessToken: string;
  private appSecret?: string;
  private fetchFn: typeof fetch;

  constructor(config?: {
    baseUrl?: string;
    accessToken?: string;
    appSecret?: string;
    fetchFn?: typeof fetch;
  }) {
    this.baseUrl = config?.baseUrl || process.env.GRAPH_API_BASE_URL || 'https://graph.facebook.com/v19.0';
    this.accessToken = config?.accessToken || process.env.PAGE_ACCESS_TOKEN || 'dev_page_access_token_12345';
    this.appSecret = config?.appSecret || process.env.APP_SECRET;
    this.fetchFn = config?.fetchFn || globalThis.fetch;
  }

  private get appSecretProof(): string | undefined {
    try {
      const secret = this.appSecret;
      const token = this.accessToken;
      if (secret && token && !token.startsWith('dev_') && !token.startsWith('test_')) {
        return crypto.createHmac('sha256', secret).update(token).digest('hex');
      }
    } catch {}
    return undefined;
  }

  async sendMessage(psid: string, text: string, customToken?: string): Promise<SendMessageResponse> {
    const token = customToken || this.accessToken;
    if (token.startsWith('dev_') || token.startsWith('test_')) {
      return {
        recipient_id: psid,
        message_id: `mid.mock.${Date.now()}`,
      };
    }

    const url = `${this.baseUrl}/me/messages?access_token=${encodeURIComponent(token)}`;
    const payload = {
      recipient: { id: psid },
      message: { text },
      messaging_type: 'RESPONSE',
    };

    console.log(`[DEBUG] Graph API Endpoint Called: ${this.baseUrl}/me/messages`);
    console.log(`[DEBUG] Graph API Request Payload:`, JSON.stringify(payload, null, 2));

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FBPageUnifiedInbox/1.0',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as any;
    
    console.log(`[DEBUG] Graph API Response Status: ${response.status}`);
    console.log(`[DEBUG] Graph API Response Body:`, JSON.stringify(data, null, 2));

    if (!response.ok || data?.error) {
      const errorMsg = data?.error?.message || response.statusText || 'Failed to send message';
      throw new Error(`Meta Graph API Error (${response.status}): ${errorMsg}`);
    }

    return data as SendMessageResponse;
  }

  async sendMediaAttachment(
    psid: string,
    attachmentType: 'image' | 'video' | 'audio' | 'file',
    mediaUrlOrBuffer: string | Buffer,
    filename: string = 'upload.jpg',
    mimeType: string = 'image/jpeg',
    customToken?: string
  ): Promise<SendMessageResponse> {
    const token = customToken || this.accessToken;
    if (token.startsWith('dev_') || token.startsWith('test_')) {
      return {
        recipient_id: psid,
        message_id: `mid.mock.${Date.now()}`,
      };
    }

    const url = `${this.baseUrl}/me/messages?access_token=${encodeURIComponent(token)}`;

    if (typeof mediaUrlOrBuffer === 'string') {
      const payload = {
        recipient: { id: psid },
        message: {
          attachment: {
            type: attachmentType,
            payload: {
              url: mediaUrlOrBuffer,
              is_reusable: true,
            },
          },
        },
        messaging_type: 'RESPONSE',
      };

      console.log(`[DEBUG] Graph API Endpoint Called: ${this.baseUrl}/me/messages`);
      console.log(`[DEBUG] Graph API Request Payload:`, JSON.stringify(payload, null, 2));

      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FBPageUnifiedInbox/1.0',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;
      console.log(`[DEBUG] Graph API Response Status: ${response.status}`);
      console.log(`[DEBUG] Graph API Response Body:`, JSON.stringify(data, null, 2));

      if (!response.ok || data?.error) {
        throw new Error(`Meta Graph API Error (${response.status}): ${data?.error?.message || 'Failed to send media'}`);
      }
      return data as SendMessageResponse;
    }

    const formData = new FormData();
    formData.append('recipient', JSON.stringify({ id: psid }));
    formData.append(
      'message',
      JSON.stringify({
        attachment: {
          type: attachmentType,
          payload: { is_reusable: true },
        },
      })
    );
    formData.append('messaging_type', 'RESPONSE');

    const blob = new Blob([mediaUrlOrBuffer], { type: mimeType });
    formData.append('filedata', blob, filename);

    console.log(`[DEBUG] Graph API Endpoint Called: ${this.baseUrl}/me/messages (FormData)`);
    console.log(`[DEBUG] Graph API Request Payload: FormData (attachment)`);

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'FBPageUnifiedInbox/1.0',
      },
      body: formData as any,
    });

    const data = (await response.json()) as any;
    console.log(`[DEBUG] Graph API Response Status: ${response.status}`);
    console.log(`[DEBUG] Graph API Response Body:`, JSON.stringify(data, null, 2));

    if (!response.ok || data?.error) {
      throw new Error(`Meta Graph API Error (${response.status}): ${data?.error?.message || 'Failed to upload and send media'}`);
    }

    return data as SendMessageResponse;
  }

  async getUserProfile(psid: string, customToken?: string): Promise<UserProfileResponse | null> {
    const token = customToken || this.accessToken;
    if (token.startsWith('dev_') || token.startsWith('test_')) {
      return null;
    }

    try {
      const fields = 'first_name,last_name,name,profile_pic';
      const url = `${this.baseUrl}/${encodeURIComponent(psid)}?fields=${fields}&access_token=${encodeURIComponent(token)}`;
      const response = await this.fetchFn(url, { method: 'GET' });
      const data = (await response.json()) as any;

      if (!response.ok || data?.error) {
        console.log(`[Identity][ProfileRequest]\npsid=${psid}\nmethod=GET\nendpointType=/{psid}\nstatus=failed`);
        console.log(`[Identity][Fallback]\npsid=${psid}\nreason=Standard profile API failed/denied, trying /me/conversations`);
        
        const fallbackUrl = `${this.baseUrl}/me/conversations?user_id=${encodeURIComponent(psid)}&fields=participants&access_token=${encodeURIComponent(token)}`;
        const fbRes = await this.fetchFn(fallbackUrl, { method: 'GET' });
        const fbData = (await fbRes.json()) as any;
        
        if (fbRes.ok && fbData.data && fbData.data.length > 0) {
           console.log(`[Identity][ProfileRequest]\npsid=${psid}\nmethod=GET\nendpointType=/me/conversations\nstatus=success`);
           const participants = fbData.data[0].participants?.data || [];
           const customer = participants.find((p: any) => p.id === psid);
           if (customer && customer.name) {
              console.log(`[Identity][Resolved]\npsid=${psid}\nnameAvailable=true\nprofilePictureAvailable=false`);
              return {
                 id: psid,
                 name: customer.name,
              };
           }
        } else {
           console.log(`[Identity][ProfileRequest]\npsid=${psid}\nmethod=GET\nendpointType=/me/conversations\nstatus=failed`);
        }
        console.log(`[Identity][Resolved]\npsid=${psid}\nnameAvailable=false\nprofilePictureAvailable=false`);
        return null;
      }

      console.log(`[Identity][ProfileRequest]\npsid=${psid}\nmethod=GET\nendpointType=/{psid}\nstatus=success`);
      const name = data.name || (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : undefined);
      console.log(`[Identity][Resolved]\npsid=${psid}\nnameAvailable=${!!name}\nprofilePictureAvailable=${!!data.profile_pic}`);

      return {
        id: data.id || psid,
        first_name: data.first_name,
        last_name: data.last_name,
        name,
        profile_pic: data.profile_pic,
      };
    } catch (e: any) {
      console.log(`[Identity][ProfileRequest]\npsid=${psid}\nmethod=GET\nendpointType=Unknown\nstatus=failed`);
      return null;
    }
  }

  async getPageDetails(customToken?: string): Promise<PageDetailsResponse> {
    const token = customToken || this.accessToken;
    if (token.startsWith('dev_') || token.startsWith('test_')) {
      return {
        id: '752790171249695',
        name: 'Flirt with Fortune',
      };
    }

    try {
      const fields = 'id,name,picture';
      const url = `${this.baseUrl}/me?fields=${fields}&access_token=${encodeURIComponent(token)}`;
      const response = await this.fetchFn(url, { method: 'GET' });
      const data = (await response.json()) as any;

      if (response.ok && !data?.error) {
        return data as PageDetailsResponse;
      }

      const fallbackUrl = `${this.baseUrl}/me?fields=id,name&access_token=${encodeURIComponent(token)}`;
      const fallbackRes = await this.fetchFn(fallbackUrl, { method: 'GET' });
      const fallbackData = (await fallbackRes.json()) as any;

      if (fallbackRes.ok && !fallbackData?.error) {
        return fallbackData as PageDetailsResponse;
      }

      throw new Error(`Graph API error: ${data?.error?.message || 'Unknown error'}`);
    } catch (err: any) {
      throw new Error(`Failed to fetch page details: ${err.message}`);
    }
  }

  /**
   * AUTOMATIC PAGING CURSOR TRAVERSAL TO FETCH ALL PAST CONVERSATIONS (UP TO 1,000+ CHATS)
   */
  async fetchFullConversationsWithMessages(customToken?: string, pageId?: string, maxItems: number = 1000, since?: Date): Promise<any[]> {
    const token = customToken || this.accessToken;
    if (!token || token.startsWith('dev_') || token.startsWith('test_')) {
      return [];
    }

    const target = pageId && pageId !== 'me' ? pageId : 'me';
    // Added attachments to the query to extract media history
    const fields = 'id,snippet,updated_time,unread_count,participants{id,name,email},messages.limit(30){id,message,from,created_time,attachments{id,mime_type,name,size,file_url,image_data,video_data}}';
    
    let baseUrlQuery = `${this.baseUrl}/${target}/conversations?fields=${encodeURIComponent(fields)}&limit=20&access_token=${encodeURIComponent(token)}`;
    if (since) {
      const unixTimestamp = Math.floor(since.getTime() / 1000);
      baseUrlQuery += `&since=${unixTimestamp}`;
    }
    let currentUrl: string | null = baseUrlQuery;

    const allConversations: any[] = [];

    try {
      while (currentUrl && allConversations.length < maxItems) {
        const response = await this.fetchFn(currentUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'FBPageUnifiedInbox/1.0' },
        });
        const data = (await response.json()) as any;

        if (response.ok && !data?.error && Array.isArray(data.data)) {
          allConversations.push(...data.data);
          currentUrl = data.paging?.next || null;
        } else {
          console.warn('[GraphApi] fetch failed or no data. OK:', response.ok, 'Error:', data?.error, 'Data:', data);
          break;
        }
      }
    } catch (e: any) {
      console.warn('[GraphApi] fetchFullConversationsWithMessages error:', e.message);
    }

    return allConversations;
  }

  async fetchConversationsList(limit: number = 1000, pageId?: string): Promise<any[]> {
    return this.fetchFullConversationsWithMessages(undefined, pageId, limit);
  }

  async fetchConversationDetails(conversationId: string): Promise<any> {
    return null;
  }

  async fetchConversationMessages(conversationId: string, limit: number = 50): Promise<any[]> {
    return [];
  }

  async fetchConversations(limit: number = 1000): Promise<GraphApiConversation[]> {
    return this.fetchConversationsList(limit);
  }

  async subscribePageToWebhook(customToken?: string): Promise<{ success: boolean; message: string }> {
    const token = customToken || this.accessToken;
    if (token.startsWith('dev_') || token.startsWith('test_')) {
      return { success: true, message: 'Mock page webhook subscription successful.' };
    }

    try {
      const url = `${this.baseUrl}/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes,message_reactions,message_reads&access_token=${encodeURIComponent(token)}`;
      const response = await this.fetchFn(url, { method: 'POST' });
      const data = (await response.json()) as any;

      if (!response.ok || data?.error) {
        return { success: false, message: data?.error?.message || 'Failed to subscribe' };
      }

      return { success: true, message: 'Page subscribed to webhooks successfully!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Subscription failed' };
    }
  }
}

export const graphApiClient = new GraphApiClient();
