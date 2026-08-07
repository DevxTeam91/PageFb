import { networkManager } from './NetworkManager';
import { Conversation, Message, PageData, Rule, SyncStatus } from '../types';

export function resolveMediaUrl(url: string, baseUrl?: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  
  const rootUrl = baseUrl ? baseUrl.replace(/\/api\/?$/, '') : 'http://localhost:3000';
  return `${rootUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function fetchConversations(search?: string, pageId?: string, since?: number): Promise<Conversation[]> {
  const params: string[] = [];
  if (search) params.push(`search=${encodeURIComponent(search)}`);
  if (pageId && pageId !== 'all') params.push(`pageId=${encodeURIComponent(pageId)}`);
  if (since) params.push(`since=${since}`);

  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  const res = await networkManager.fetchWithRetry(`/conversations${qs}`);
  if (!res.ok) throw new Error('Failed to fetch conversations');
  const data = await res.json();
  return data.conversations || [];
}

export async function fetchConversationMessages(
  conversationId: string
): Promise<{ conversation: Conversation; messages: Message[] }> {
  const res = await networkManager.fetchWithRetry(`/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export async function sendReply(
  conversationId: string,
  text?: string,
  mediaFile?: { uri: string; type?: string; name?: string } | any
): Promise<{ message: Message; conversation: Conversation }> {
  console.log(`[DEBUG] api.sendReply: Triggered for conversation ID: ${conversationId}`);
  let res: Response;

  try {
    if (mediaFile) {
      if (typeof mediaFile.uri === 'string' && (mediaFile.uri.startsWith('http://') || mediaFile.uri.startsWith('https://'))) {
        res = await networkManager.fetchWithRetry(`/conversations/${conversationId}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, mediaUrl: mediaFile.uri }),
        });
      } else {
        const formData = new FormData();
        if (text) formData.append('text', text);
        formData.append('media', {
          uri: mediaFile.uri,
          type: mediaFile.type || 'image/jpeg',
          name: mediaFile.name || 'upload.jpg',
        } as any);

        res = await networkManager.fetchWithRetry(`/conversations/${conversationId}/reply`, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
        });
      }
    } else {
      res = await networkManager.fetchWithRetry(`/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    }

    console.log(`[DEBUG] api.sendReply: fetchWithRetry completed. Status: ${res.ok ? res.status : 'ERROR ' + res.status}`);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send reply' }));
      throw new Error(err.error || 'Failed to send reply');
    }
    
    console.log(`[DEBUG] api.sendReply: Success`);
    return res.json();
  } catch (err: any) {
    console.log(`[DEBUG] api.sendReply Error: ${err.message}`, err.stack);
    throw err;
  }
}

export async function toggleConversationAutoReply(
  conversationId: string,
  enabled?: boolean
): Promise<{ conversation: Conversation }> {
  const res = await networkManager.fetchWithRetry(`/conversations/${conversationId}/auto-reply`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle auto-reply');
  return res.json();
}

export async function markConversationAsRead(conversationId: string): Promise<{ conversation: Conversation }> {
  const res = await networkManager.fetchWithRetry(`/conversations/${conversationId}/read`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to mark conversation as read');
  return res.json();
}

export async function triggerSync(pageId?: string): Promise<{ success: boolean; conversationsSynced: number; messagesSynced: number }> {
  const res = await networkManager.fetchWithRetry(`/conversations/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to sync' }));
    throw new Error(err.error || 'Failed to sync conversations');
  }
  return res.json();
}

export async function registerDeviceToken(token: string, pageId?: string): Promise<void> {
  try {
    await networkManager.fetchWithRetry(`/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, pageId }),
    });
  } catch (e) {
    console.warn('[API] Failed to register device token:', e);
  }
}

export async function fetchPages(): Promise<PageData[]> {
  const res = await networkManager.fetchWithRetry(`/pages`);
  if (!res.ok) throw new Error('Failed to fetch pages');
  return res.json();
}

export async function addPage(token: string, name?: string, pageId?: string): Promise<{ success: boolean; page: PageData }> {
  const res = await networkManager.fetchWithRetry(`/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name, pageId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to add page' }));
    throw new Error(err.error || 'Failed to add page');
  }
  return res.json();
}

export async function updatePage(id: string, updates: Partial<{ name: string; isActive: boolean; accessToken: string }>): Promise<{ success: boolean; page: PageData }> {
  const res = await networkManager.fetchWithRetry(`/pages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update page');
  return res.json();
}

export async function deletePage(id: string): Promise<void> {
  const res = await networkManager.fetchWithRetry(`/pages/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete page' }));
    throw new Error(err.error || 'Failed to delete page');
  }
}

export async function fetchRules(): Promise<Rule[]> {
  const res = await networkManager.fetchWithRetry(`/rules`);
  if (!res.ok) throw new Error('Failed to fetch rules');
  const data = await res.json();
  return data.rules || [];
}

export async function createRule(rule: {
  keyword: string;
  matchType: MatchType;
  replyText: string;
  priority?: number;
  enabled?: boolean;
  pageId?: string | null;
}): Promise<Rule> {
  const res = await networkManager.fetchWithRetry(`/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create rule' }));
    throw new Error(err.error || 'Failed to create rule');
  }
  const data = await res.json();
  return data.rule;
}

export async function updateRule(
  id: string,
  updates: Partial<{
    keyword: string;
    matchType: MatchType;
    replyText: string;
    priority: number;
    enabled: boolean;
    pageId?: string | null;
  }>
): Promise<Rule> {
  const res = await networkManager.fetchWithRetry(`/rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update rule' }));
    throw new Error(err.error || 'Failed to update rule');
  }
  const data = await res.json();
  return data.rule;
}

export async function deleteRule(id: string): Promise<void> {
  const res = await networkManager.fetchWithRetry(`/rules/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete rule');
}

export async function reorderRules(ruleIds: string[]): Promise<Rule[]> {
  const res = await networkManager.fetchWithRetry(`/rules/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ruleIds }),
  });
  if (!res.ok) throw new Error('Failed to reorder rules');
  const data = await res.json();
  return data.rules;
}

export async function fetchSettings(): Promise<SettingsData> {
  const res = await networkManager.fetchWithRetry(`/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateGlobalAutoReply(enabled: boolean): Promise<boolean> {
  const res = await networkManager.fetchWithRetry(`/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ globalAutoReply: enabled }),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  const data = await res.json();
  return data.globalAutoReply;
}

export async function verifyFacebookConnection(): Promise<{ connected: boolean; pageName?: string; error?: string; webhookSubscribed?: boolean; webhookMessage?: string }> {
  const res = await networkManager.fetchWithRetry(`/settings/verify-connection`);
  const data = await res.json();
  return data;
}

export async function subscribeWebhook(): Promise<{ success: boolean; message: string }> {
  const res = await networkManager.fetchWithRetry(`/settings/subscribe-webhook`, { method: 'POST' });
  const data = await res.json();
  return data;
}
