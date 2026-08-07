import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { sendPushNotification } from './services/firebase';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let io: Server | null = null;

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

    socket.on('disconnect', () => {
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

  const traceId = payload.message.fbMessageId || Date.now().toString();
  if (process.env.DEBUG === 'true') console.time(`[Trace] Socket Emit ACK resolution - ${traceId}`);

  const sockets = await io.in('inbox').fetchSockets();
  
  if (sockets.length === 0) {
    // No sockets connected, definitely send push
    await triggerPushForNewMessage(payload);
    return;
  }

  // Sockets connected. Try sending and wait for ACK (3 sec timeout)
  let ackReceived = false;
  
  try {
    const ackPromises = sockets.map(socket => 
      socket.timeout(3000).emitWithAck('new_message', payload)
    );
    
    // Wait for all to settle
    const results = await Promise.allSettled(ackPromises);
    
    // If at least one socket successfully acknowledged (Promise fulfilled), we skip push.
    ackReceived = results.some(result => result.status === 'fulfilled');
  } catch (error) {
    console.error('[Socket] Error waiting for ACKs:', error);
  }

  if (process.env.DEBUG === 'true') console.timeEnd(`[Trace] Socket Emit ACK resolution - ${traceId}`);

  if (!ackReceived && payload.message.direction === 'inbound') {
    console.log('[Socket] No ACK received for inbound new_message. Sending Push Notification...');
    await triggerPushForNewMessage(payload);
  } else {
    console.log('[Socket] new_message ACK received or message is outbound. Push skipped.');
  }
}

async function triggerPushForNewMessage(payload: { message: any; conversation: any }) {
  try {
    const devices = await prisma.device.findMany();
    if (devices.length === 0) return;

    const pushPayload = {
      notification: {
        title: `New message from ${payload.conversation.userName || 'User'}`,
        body: payload.message.text || 'Sent an attachment',
      },
      data: {
        conversationId: payload.conversation.id,
      }
    };

    for (const device of devices) {
      await sendPushNotification(device.token, pushPayload);
    }
  } catch (err) {
    console.error('[Socket] Failed to trigger push:', err);
  }
}

export function emitNewReply(payload: { message: any; conversationId: string }): void {
  if (io) {
    io.emit('new_reply', payload);
  }
}

export function emitConversationUpdated(conversation: any): void {
  if (io) {
    io.emit('conversation_updated', conversation);
  }
}

export function emitSyncStatus(status: { inProgress: boolean; total?: number; synced?: number; message?: string }): void {
  if (io) {
    io.emit('sync_status', status);
  }
}
