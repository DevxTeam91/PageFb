import { prisma } from '../db';
import { graphApiClient } from './graphApi';
import { emitNewMessage, emitNewReply, emitConversationUpdated, emitSyncStatus } from '../socket';
import { decryptToken } from '../utils/crypto';
import { downloadAndCacheAttachment } from './mediaCache';

/**
 * Helper to get or create a conversation record by PSID & pageId
 */
export async function getOrCreateConversation(
  psid: string,
  userName?: string,
  targetPageId?: string,
  unreadStatus?: boolean
) {
  let dbPageId: string | undefined;
  let pageToken: string | undefined;

  if (targetPageId) {
    const page = await prisma.page.findFirst({
      where: {
        OR: [{ id: targetPageId }, { pageId: targetPageId }],
      },
    });
    dbPageId = page?.id;
    if (page?.accessToken) {
      pageToken = decryptToken(page.accessToken);
    }
  }

  if (!dbPageId) {
    const defaultPage = await prisma.page.findFirst({ where: { isActive: true } });
    dbPageId = defaultPage?.id;
    if (defaultPage?.accessToken) {
      pageToken = decryptToken(defaultPage.accessToken);
    }
  }

  if (!dbPageId) {
    throw new Error('No active Facebook Page configured in database');
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      psid,
      pageId: dbPageId,
    },
  });

  let resolvedName = userName;
  let userAvatarUrl: string | undefined;

  if (!resolvedName || !userAvatarUrl) {
    try {
      const profile = await graphApiClient.getUserProfile(psid, pageToken);
      if (profile) {
        resolvedName = resolvedName || profile.name || profile.first_name || `User ${psid.slice(-4)}`;
        userAvatarUrl = profile.profile_pic;
      }
    } catch (e: any) {
      console.warn(`[Conversations] Profile lookup skipped for PSID ${psid}:`, e.message);
    }
  }

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        psid,
        userName: resolvedName || `Customer ${psid.slice(-4)}`,
        userAvatarUrl,
        pageId: dbPageId,
        autoReplyEnabled: true,
        unread: unreadStatus !== undefined ? unreadStatus : true,
      },
    });
  } else if ((resolvedName && conversation.userName !== resolvedName) || (userAvatarUrl && !conversation.userAvatarUrl) || (unreadStatus !== undefined && conversation.unread !== unreadStatus)) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        ...(resolvedName && { userName: resolvedName }),
        ...(userAvatarUrl && { userAvatarUrl }),
        ...(unreadStatus !== undefined && { unread: unreadStatus }),
      },
    });
  }

  return conversation;
}

export async function handleIncomingMessage(payload: {
  senderPsid: string;
  recipientPageId: string;
  messageText?: string;
  attachments?: any[];
  timestamp?: Date;
  fbMessageId?: string;
  isEcho?: boolean;
}) {
  const {
    senderPsid,
    recipientPageId,
    messageText,
    attachments,
    timestamp,
    fbMessageId,
    isEcho = false,
  } = payload;

  const traceId = fbMessageId || Date.now().toString();
  if (process.env.DEBUG === 'true') console.time(`[Trace] handleIncomingMessage DB Ops - ${traceId}`);

  const userPsid = senderPsid;
  const conversation = await getOrCreateConversation(userPsid, undefined, recipientPageId);

  if (fbMessageId) {
    const existingMessage = await prisma.message.findUnique({
      where: { fbMessageId },
    });
    if (existingMessage) {
      return { conversation, message: existingMessage, duplicate: true };
    }
  }

  let attachmentsJson: string | null = null;
  if (attachments && attachments.length > 0) {
    attachmentsJson = JSON.stringify(
      attachments.map((att: any) => ({
        type: att.type || 'file',
        url: att.payload?.url || att.url || '',
        name: att.name || `${att.type || 'file'}_attachment`,
      }))
    );
  }

  const direction = isEcho ? 'outbound_auto' : 'inbound';

  let message;
  try {
    message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction,
        text: messageText || '',
        attachments: attachmentsJson,
        createdAt: timestamp || new Date(),
        fbMessageId: fbMessageId || undefined,
      },
    });
    console.log(`[Realtime][DB] messageId=${fbMessageId} conversationId=${conversation.id} created=true`);
  } catch (err: any) {
    if (err.code === 'P2002') {
      console.warn('[Webhook] Duplicate event race condition caught for fbMessageId:', fbMessageId);
      const existing = await prisma.message.findUnique({ where: { fbMessageId } });
      return { conversation, message: existing, duplicate: true };
    }
    throw err;
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: timestamp || new Date(),
      unread: !isEcho,
    },
  });

  const currentTraceId = fbMessageId || `trace.${Date.now()}`;
  console.log(`[Realtime][DB] UPSERT_COMPLETED`);
  console.log(`[Realtime][Trace] traceId=${currentTraceId} stage=db_upsert_complete`);

  if (process.env.DEBUG === 'true') console.timeEnd(`[Trace] handleIncomingMessage DB Ops - ${traceId}`);
  if (process.env.DEBUG === 'true') console.time(`[Trace] handleIncomingMessage Socket Emit - ${traceId}`);

  console.log(`[Realtime][Trace] traceId=${currentTraceId} stage=socket_emitted`);
  emitNewMessage({
    message,
    conversation: updatedConversation,
  });
  emitConversationUpdated(updatedConversation);

  if (process.env.DEBUG === 'true') console.timeEnd(`[Trace] handleIncomingMessage Socket Emit - ${traceId}`);

  if (!isEcho && messageText) {
    setImmediate(async () => {
      try {
        await processAutoReply(conversation.id, userPsid, messageText);
      } catch (err) {
        console.error('[Conversations] Error processing auto-reply:', err);
      }
    });
  }

  return { conversation: updatedConversation, message, duplicate: false };
}

async function processAutoReply(conversationId: string, psid: string, text: string) {
  const autoReplySetting = await prisma.setting.findUnique({
    where: { key: 'global_auto_reply' },
  });
  const globalAutoReply = autoReplySetting ? autoReplySetting.value === 'true' : true;
  if (!globalAutoReply) return;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { page: true },
  });

  if (!conversation || !conversation.autoReplyEnabled) return;

  const rules = await prisma.rule.findMany({
    where: {
      enabled: true,
      OR: [
        { pageId: null },
        { pageId: conversation.pageId },
      ],
    },
    orderBy: { priority: 'asc' },
  });

  for (const rule of rules) {
    let matches = false;
    const cleanText = text.trim();
    const cleanKeyword = rule.keyword.trim();

    if (rule.matchType === 'exact') {
      matches = cleanText.toLowerCase() === cleanKeyword.toLowerCase();
    } else if (rule.matchType === 'contains') {
      matches = cleanText.toLowerCase().includes(cleanKeyword.toLowerCase());
    } else if (rule.matchType === 'regex') {
      try {
        const rx = new RegExp(cleanKeyword, 'i');
        matches = rx.test(cleanText);
      } catch (err) {
        console.warn(`[AutoReply] Invalid regex pattern "${cleanKeyword}":`, err);
      }
    }

    if (matches) {
      const pageToken = conversation.page?.accessToken ? decryptToken(conversation.page.accessToken) : undefined;
      const sendRes = await graphApiClient.sendMessage(psid, rule.replyText, pageToken);

      const replyMsg = await prisma.message.create({
        data: {
          conversationId,
          direction: 'outbound_auto',
          text: rule.replyText,
          fbMessageId: sendRes?.message_id,
          createdAt: new Date(),
        },
      });

      const updatedConv = await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      emitNewReply({ message: replyMsg, conversationId });
      emitConversationUpdated(updatedConv);
      break;
    }
  }
}

export async function sendManualReply(
  conversationId: string,
  text?: string,
  mediaFile?: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    localUrl: string;
  }
) {
  if ((!text || !text.trim()) && !mediaFile) {
    throw new Error('Message text or media file is required');
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { page: true },
  });

  if (!conversation) {
    console.log(`[DEBUG] Error: Conversation not found for id: ${conversationId}`);
    throw new Error(`Conversation not found for id: ${conversationId}`);
  }

  console.log(`[DEBUG] Conversation ID: ${conversation.id}, Page ID: ${conversation.pageId}`);

  const pageToken = conversation.page?.accessToken ? decryptToken(conversation.page.accessToken) : undefined;
  console.log(`[DEBUG] Page access token found: ${!!pageToken}`);
  
  let sendResult: { recipient_id: string; message_id: string } | null = null;
  let attachmentsJson: string | null = null;

  try {
    if (mediaFile) {
      const isVideo = mediaFile.mimetype.startsWith('video/');
      const attachmentType = isVideo ? 'video' : 'image';

      sendResult = await graphApiClient.sendMediaAttachment(
        conversation.psid,
        attachmentType,
        mediaFile.buffer,
        mediaFile.originalname,
        mediaFile.mimetype,
        pageToken
      );

      attachmentsJson = JSON.stringify([
        {
          type: attachmentType,
          url: mediaFile.localUrl,
          name: mediaFile.originalname,
        },
      ]);
    }

    if (text && text.trim()) {
      sendResult = await graphApiClient.sendMessage(conversation.psid, text.trim(), pageToken);
    }
  } catch (err: any) {
    console.log(`[DEBUG] Graph API Error in sendManualReply (server/src/services/conversations.ts):`, err);
    throw err;
  }

  const messageText = text ? text.trim() : (mediaFile?.mimetype.startsWith('video/') ? '[VIDEO]' : '[IMAGE]');

  let message;
  try {
    message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'outbound_manual',
        text: messageText,
        attachments: attachmentsJson,
        fbMessageId: sendResult?.message_id,
        createdAt: new Date(),
      },
    });
    console.log(`[DEBUG] Message successfully inserted into database. ID: ${message.id}`);
  } catch (err) {
    console.log(`[DEBUG] Database Insert Error in sendManualReply (server/src/services/conversations.ts):`, err);
    throw err;
  }

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      unread: false,
    },
  });

  try {
    emitNewReply({
      message,
      conversationId: conversation.id,
    });
    emitConversationUpdated(updatedConversation);
    console.log(`[DEBUG] Socket.IO events (new_reply, conversation_updated) successfully emitted.`);
  } catch (err) {
    console.log(`[DEBUG] Socket Emit Error in sendManualReply (server/src/services/conversations.ts):`, err);
    throw err;
  }

  return { message, conversation: updatedConversation };
}

export async function toggleConversationAutoReply(conversationId: string, enabled?: boolean) {
  const current = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!current) throw new Error(`Conversation not found for id: ${conversationId}`);
  const newValue = enabled !== undefined ? enabled : !current.autoReplyEnabled;

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { autoReplyEnabled: newValue },
  });

  emitConversationUpdated(updated);
  return updated;
}

export async function markConversationRead(conversationId: string) {
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread: false },
  });

  emitConversationUpdated(updated);
  return updated;
}

/**
 * HIGH-SPEED SINGLE-QUERY REAL BACKFILL ENGINE FROM META GRAPH API
 */
export async function backfillFromGraphApi(targetPageId?: string): Promise<{
  conversationsSynced: number;
  messagesSynced: number;
}> {
  emitSyncStatus({ inProgress: true, message: 'Syncing real Facebook conversations...' });

  try {
    const targetPages = targetPageId
      ? await prisma.page.findMany({ where: { id: targetPageId } })
      : await prisma.page.findMany({ where: { isActive: true } });

    let conversationsCount = 0;
    let messagesCount = 0;
    let hasRealData = false;

    for (let pageIdx = 0; pageIdx < targetPages.length; pageIdx++) {
      const page = targetPages[pageIdx];
      emitSyncStatus({
        inProgress: true,
        total: targetPages.length,
        synced: pageIdx + 1,
        message: `Syncing ${page.name}...`,
      });

      let decryptedToken: string;
      try {
        decryptedToken = decryptToken(page.accessToken);
      } catch (err: any) {
        console.error(`[Sync] Skipping page ${page.name} (${page.pageId}) due to decryption failure. The App Secret may have changed.`);
        continue;
      }
      
      const sinceDate = page.lastSyncedAt ? new Date(page.lastSyncedAt) : undefined;
      const fbConversations = await graphApiClient.fetchFullConversationsWithMessages(decryptedToken, page.pageId, 1000, sinceDate);

      if (fbConversations && fbConversations.length > 0) {
        hasRealData = true;

        for (const fbConv of fbConversations) {
          const participants = fbConv.participants?.data || [];
          const customer = participants.find((p: any) => p.id !== page.pageId) || participants[0];

          let psid = customer?.id || fbConv.id;
          let userName = customer?.name || `Customer ${psid.slice(-4)}`;
          let unreadStatus = fbConv.unread_count > 0;

          const conversation = await getOrCreateConversation(psid, userName, page.id, unreadStatus);
          conversationsCount++;

          const fbMessages = fbConv.messages?.data || [];
          for (const fbMsg of fbMessages) {
            if (!fbMsg.id) continue;
            // If the message is NOT from the customer (PSID), then it was sent by the business (outbound)
            const isFromPage = fbMsg.from?.id !== psid;
            const direction = isFromPage ? 'outbound_manual' : 'inbound';
            const createdAt = fbMsg.created_time ? new Date(fbMsg.created_time) : new Date();

            const existing = await prisma.message.findUnique({ where: { fbMessageId: fbMsg.id } });
            if (!existing) {
              let attachmentsJson: string | null = null;
              if (fbMsg.attachments?.data && fbMsg.attachments.data.length > 0) {
                const parsedAttachments = await Promise.all(
                  fbMsg.attachments.data.map(async (att: any) => {
                    const cdnUrl = att.image_data?.url || att.video_data?.url || att.file_url || '';
                    const localUrl = await downloadAndCacheAttachment(cdnUrl, att.mime_type);
                    return {
                      type: att.mime_type?.startsWith('video/') ? 'video' : 'image',
                      url: localUrl,
                      name: att.name || 'attachment',
                    };
                  })
                );
                attachmentsJson = JSON.stringify(parsedAttachments);
              }

              await prisma.message.create({
                data: {
                  conversationId: conversation.id,
                  direction,
                  text: fbMsg.message || '',
                  attachments: attachmentsJson,
                  createdAt,
                  fbMessageId: fbMsg.id,
                },
              });
              messagesCount++;
            }
          }

          if (fbConv.updated_time) {
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date(fbConv.updated_time) },
            });
          }
        }
        
        // Update lastSyncedAt for this page
        await prisma.page.update({
          where: { id: page.id },
          data: { lastSyncedAt: new Date() },
        });
      }
    }

    // Clean sample conversations if real Facebook data was fetched
    if (hasRealData) {
      await prisma.conversation.deleteMany({
        where: { id: { in: ['conv_1001', 'conv_1002', 'conv_1003', 'conv_1004'] } },
      }).catch(() => {});
    }

    emitSyncStatus({
      inProgress: false,
      total: targetPages.length,
      synced: targetPages.length,
      message: 'Real Facebook conversations synced successfully!',
    });

    return {
      conversationsSynced: conversationsCount,
      messagesSynced: messagesCount,
    };
  } catch (err: any) {
    console.error('[Sync] Backfill error:', err);
    emitSyncStatus({
      inProgress: false,
      message: `Sync completed.`,
    });
    return { conversationsSynced: 0, messagesSynced: 0 };
  }
}
