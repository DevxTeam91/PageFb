import { PrismaClient } from '@prisma/client';
import { handleIncomingMessage } from './conversations';
import { decryptToken } from '../utils/crypto';

const prisma = new PrismaClient();

let isStreamerRunning = false;
let streamerInterval: NodeJS.Timeout | null = null;
const processedMessageIds = new Set<string>();

const POLL_INTERVAL_MS = parseInt(process.env.REALTIME_POLL_INTERVAL_MS || '5000', 10);

interface GraphMessageItem {
  id: string;
  message?: string;
  from?: { id: string; name?: string; email?: string };
  created_time: string;
  attachments?: {
    data?: Array<any>;
  };
}

interface GraphConversationItem {
  id: string;
  updated_time: string;
  unread_count?: number;
  participants?: { data?: Array<{ id: string; name?: string }> };
  messages?: { data?: GraphMessageItem[] };
}

export function startRealtimeStreamer() {
  if (streamerInterval) clearInterval(streamerInterval);

  console.log(`[Realtime][Poller][START] ⚡ Autonomous Poller started (interval: ${POLL_INTERVAL_MS}ms)`);

  streamerInterval = setInterval(pollMetaUpdates, POLL_INTERVAL_MS);
}

async function pollMetaUpdates() {
  if (isStreamerRunning) return;
  isStreamerRunning = true;

  try {
    const activePages = await prisma.page.findMany({
      where: { isActive: true, accessToken: { not: '' } },
    });

    for (const page of activePages) {
      try {
        let token = page.accessToken;
        try {
           token = decryptToken(page.accessToken);
        } catch (err) {
           console.warn(`[Realtime][Poller][ERROR] Failed to decrypt token for page ${page.name}`);
           continue;
        }

        const url = `https://graph.facebook.com/v19.0/${page.pageId}/conversations?fields=id,updated_time,unread_count,participants,messages.limit(2){id,message,from,created_time,attachments}&limit=6&access_token=${encodeURIComponent(token)}`;

        const response = await fetch(url, { headers: { 'User-Agent': 'FBInbox-RealTimeStreamer/1.0' } });

        if (!response.ok) {
          console.warn(`[Realtime][Poller][BACKOFF] Failed to poll page ${page.name} (${response.status})`);
          continue;
        }

        const data = (await response.json()) as { data?: GraphConversationItem[] };
        const fbConversations = data.data || [];

        for (const fbConv of fbConversations) {
          const messages = fbConv.messages?.data || [];
          if (messages.length === 0) continue;

          for (const msg of messages) {
            if (processedMessageIds.has(msg.id)) continue;

            // Prepare payload
            const isFromCustomer = msg.from?.id ? msg.from.id !== page.pageId : true;
            
            // Format attachments
            let normalizedAttachments: any[] = [];
            if (msg.attachments?.data) {
                normalizedAttachments = msg.attachments.data.map(att => ({
                    type: att.type || 'file',
                    url: att.image_data?.url || att.video_data?.url || att.file_url || '',
                    name: att.name || 'attachment'
                }));
            }

            console.log(`[Realtime][Poller][DISCOVERED] conversationId=${fbConv.id} messageId=${msg.id}`);

            const result = await handleIncomingMessage({
              senderPsid: msg.from?.id || 'unknown',
              recipientPageId: page.pageId,
              messageText: msg.message,
              attachments: normalizedAttachments,
              timestamp: new Date(msg.created_time),
              fbMessageId: msg.id,
              isEcho: !isFromCustomer,
            });

            if (result.duplicate) {
               console.log(`[Realtime][Poller][DUPLICATE] messageId=${msg.id}`);
            } else {
               console.log(`[Realtime][Poller][INGESTED] messageId=${msg.id}`);
               console.log(`[Realtime][Pipeline] source=poller pageId=${page.pageId} conversationId=${fbConv.id} fbMessageId=${msg.id} messageTimestamp=${msg.created_time}`);
            }

            processedMessageIds.add(msg.id);
            if (processedMessageIds.size > 5000) {
              const iterator = processedMessageIds.values();
              const first = iterator.next().value;
              if (first !== undefined) {
                processedMessageIds.delete(first);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[Realtime][Poller][ERROR] Error polling page ${page.id}:`, err);
      }
    }
  } catch (err) {
    console.error(`[Realtime][Poller][ERROR] Critical loop error:`, err);
  } finally {
    isStreamerRunning = false;
  }
}
