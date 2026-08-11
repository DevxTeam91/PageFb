import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { sendPushNotification } from './services/firebase';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let io: Server | null = null;

// Track which socket belongs to which page room
const socketPageMap = new Map<string, string>(); // socketId -> pageId

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Mobile client registers which page it manages
    socket.on('register_page', (data: { pageId: string; installationId?: string }) => {
      if (!data?.pageId) {
        console.warn(`[Socket][Isolation] register_page missing pageId from socket ${socket.id}`);
        return;
      }

      // Leave any previous room
      const prevPageId = socketPageMap.get(socket.id);
      if (prevPageId) {
        socket.leave(`page:${prevPageId}`);
        console.log(`[Socket][Isolation] socket=${socket.id} left room page:${prevPageId}`);
      }

      // Join page-specific room
      socket.join(`page:${data.pageId}`);
      socketPageMap.set(socket.id, data.pageId);
      console.log(`[Socket][Isolation] socket=${socket.id} joined room page:${data.pageId} installationId=${data.installationId || 'unknown'}`);

      // Acknowledge
      socket.emit('page_registered', { pageId: data.pageId });
    });

    socket.on('disconnect', () => {
      socketPageMap.delete(socket.id);
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export async function emitNewMessage(payload: { message: any; conversation: any }): Promise<void> {
  if (!io) return;

  const pageId = payload.conversation.pageId;
  const traceId = payload.message.fbMessageId || Date.now().toString();

  console.log(`[Realtime][Socket] Emitting new_message to page:${pageId} messageId=${traceId} conversationId=${payload.conversation.id}`);

  const roomName = pageId ? `page:${pageId}` : null;

  // Check if any sockets are in this page's room
  const socketsInRoom = roomName ? await io.in(roomName).fetchSockets() : [];

  if (socketsInRoom.length === 0) {
    // No active sockets for this page → send push notification
    console.log(`[Realtime][Notification] No active sockets for page:${pageId} — sending push`);
    await triggerPushForNewMessage(payload);
    return;
  }

  // Sockets connected. Try sending and wait for ACK (3 sec timeout)
  let ackReceived = false;

  try {
    const ackPromises = socketsInRoom.map(socket =>
      socket.timeout(3000).emitWithAck('new_message', payload)
    );

    const results = await Promise.allSettled(ackPromises);
    ackReceived = results.some(result => result.status === 'fulfilled');

    if (ackReceived) {
      console.log(`[Realtime][Socket] ACK_RECEIVED messageId=${traceId} page=${pageId}`);
    }
  } catch (error) {
    console.error('[Socket] Error waiting for ACKs:', error);
  }

  if (!ackReceived && payload.message.direction === 'inbound') {
    console.log(`[Realtime][Notification] messageId=${traceId} page=${pageId} type=background (No ACK)`);
    await triggerPushForNewMessage(payload);
  } else {
    console.log(`[Realtime][Notification] messageId=${traceId} page=${pageId} type=suppressed (ACK received or outbound)`);
  }
}

async function triggerPushForNewMessage(payload: { message: any; conversation: any }) {
  try {
    const pageId = payload.conversation.pageId;

    // ISOLATION: Only find devices registered for this specific page
    const whereClause: any = {};
    if (pageId) {
      // Find page record to get its id
      const page = await prisma.page.findFirst({ where: { pageId } });
      if (page) {
        whereClause.pageId = page.id;
      }
    }

    const devices = await prisma.device.findMany({ where: whereClause });

    if (devices.length === 0) {
      console.log(`[Notification] No devices found for page=${pageId}`);
      return;
    }

    console.log(`[Notification] Sending to ${devices.length} device(s) for page=${pageId}`);

    const pushPayload = {
      notification: {
        title: `New message from ${payload.conversation.userName || 'User'}`,
        body: payload.message.text || 'Sent an attachment',
      },
      data: {
        conversationId: payload.conversation.id,
        pageId: pageId || '',
      }
    };

    for (const device of devices) {
      console.log(`[Notification] Sending page=${pageId} to device=${device.id}`);
      await sendPushNotification(device.token, pushPayload);
    }
  } catch (err) {
    console.error('[Socket] Failed to trigger push:', err);
  }
}

export function emitNewReply(payload: { message: any; conversationId: string; pageId?: string }): void {
  if (!io) return;

  const pageId = payload.pageId;
  console.log(`[Realtime][Socket] Emitting new_reply to page:${pageId} messageId=${payload.message.id || payload.message.fbMessageId} conversationId=${payload.conversationId}`);

  if (pageId) {
    io.to(`page:${pageId}`).emit('new_reply', payload);
  } else {
    // Fallback: emit to all (should not happen with proper pageId)
    io.emit('new_reply', payload);
  }
}

export function emitConversationUpdated(conversation: any): void {
  if (!io) return;

  const pageId = conversation.pageId;
  if (pageId) {
    io.to(`page:${pageId}`).emit('conversation_updated', conversation);
  } else {
    io.emit('conversation_updated', conversation);
  }
}

export function emitSyncStatus(status: { inProgress: boolean; total?: number; synced?: number; message?: string }, pageId?: string): void {
  if (!io) return;

  if (pageId) {
    io.to(`page:${pageId}`).emit('sync_status', status);
  } else {
    io.emit('sync_status', status);
  }
}
