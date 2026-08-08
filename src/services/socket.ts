// @ts-ignore
import { io, Socket } from 'socket.io-client';
import { Message, Conversation, SyncStatus } from '../types';

import { networkManager } from './NetworkManager';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const targetUrl = networkManager.getSocketUrl() || 'http://localhost:3000';
    socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true, // Let Socket.IO handle ping timeouts
      forceNew: true,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend server, id:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });

    socket.on('connect_error', (_err) => {
      // Quiet connection notice
    });
  }

  return socket;
}

export function reconnectSocket(url?: string | null): Socket {
  if (socket) {
    console.log('[Socket.IO] Forcing socket disconnect before reconnecting...');
    socket.disconnect();
    socket = null;
  }
  
  if (url) {
    // Override the networkManager url temporarily if one is provided
    // though getSocket() will pull it again anyway from networkManager
  }
  
  console.log(`[Socket.IO] Reconnecting to new URL...`);
  return getSocket();
}

export function disconnectSocket(): void {
  if (socket) {
    console.log('[Socket.IO] Disconnecting socket...');
    socket.disconnect();
    socket = null;
  }
}

export function isSocketConnected(): boolean {
  return socket ? socket.connected : false;
}

export function subscribeToRealtimeEvents(handlers: {
  onNewMessage?: (payload: { message: Message; conversation: Conversation }) => void;
  onNewReply?: (payload: { message: Message; conversationId: string }) => void;
  onConversationUpdated?: (conversation: Conversation) => void;
  onSyncStatus?: (status: SyncStatus) => void;
}) {
  const s = getSocket();

  if (handlers.onNewMessage) {
    s.on('new_message', (payload, callback) => {
      handlers.onNewMessage!(payload);
      if (typeof callback === 'function') {
        callback({ status: 'ok' });
      }
    });
  }
  if (handlers.onNewReply) {
    s.on('new_reply', handlers.onNewReply);
  }
  if (handlers.onConversationUpdated) {
    s.on('conversation_updated', handlers.onConversationUpdated);
  }
  if (handlers.onSyncStatus) {
    s.on('sync_status', handlers.onSyncStatus);
  }

  return () => {
    if (handlers.onNewMessage) s.off('new_message', handlers.onNewMessage);
    if (handlers.onNewReply) s.off('new_reply', handlers.onNewReply);
    if (handlers.onConversationUpdated) s.off('conversation_updated', handlers.onConversationUpdated);
    if (handlers.onSyncStatus) s.off('sync_status', handlers.onSyncStatus);
  };
}
