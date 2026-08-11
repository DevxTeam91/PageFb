// @ts-ignore
import { io, Socket } from 'socket.io-client';
import { Message, Conversation, SyncStatus } from '../types';
import { networkManager } from './NetworkManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket: Socket | null = null;
let activePageDbId: string | null = null; // The backend DB id for the active page
let activeFbPageId: string | null = null; // The Facebook page ID for event filtering

/**
 * Set the active page IDs — must be called before subscribeToRealtimeEvents.
 * Called from AppNavigator after setup is confirmed.
 */
export function setActivePageContext(pageDbId: string, fbPageId?: string) {
  activePageDbId = pageDbId;
  activeFbPageId = fbPageId || null;
  console.log(`[Socket][Isolation] Active page context set: pageDbId=${pageDbId} fbPageId=${fbPageId}`);

  // If socket is already connected, register now
  if (socket?.connected && activePageDbId) {
    registerPageRoom();
  }
}

function registerPageRoom() {
  if (!socket || !activePageDbId) return;

  AsyncStorage.getItem('@installation_id').then((installationId) => {
    socket!.emit('register_page', {
      pageId: activePageDbId,
      installationId: installationId || 'unknown',
    });
    console.log(`[Socket] Registered in room page:${activePageDbId} installationId=${installationId}`);
  });
}

export function getSocket(): Socket {
  if (!socket) {
    const targetUrl = networkManager.getSocketUrl() || 'http://localhost:3000';
    socket = io(targetUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      forceNew: true,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend server, id:', socket?.id);
      // Register page room on every (re)connect
      if (activePageDbId) {
        registerPageRoom();
      }
    });

    socket.on('page_registered', (data: { pageId: string }) => {
      console.log(`[Socket][Isolation] Page room confirmed: page:${data.pageId}`);
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

/**
 * Check if an incoming event belongs to the active page.
 * Returns true if the event should be processed.
 */
function isEventForActivePage(payload: any): boolean {
  if (!activePageDbId && !activeFbPageId) return true; // No filter set yet

  const eventPageId = payload?.conversation?.pageId || payload?.pageId;
  if (!eventPageId) return true; // No pageId in event → allow through

  // Check against both the DB id and the Facebook page ID
  const matches = eventPageId === activePageDbId || eventPageId === activeFbPageId;

  if (!matches) {
    console.log(`[Realtime][Isolation] Event rejected: wrong page. event.pageId=${eventPageId} active=${activePageDbId}`);
  }

  return matches;
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
      if (!isEventForActivePage(payload)) {
        if (typeof callback === 'function') callback({ status: 'ok' }); // Ack anyway
        return;
      }
      handlers.onNewMessage!(payload);
      if (typeof callback === 'function') {
        callback({ status: 'ok' });
      }
    });
  }

  if (handlers.onNewReply) {
    s.on('new_reply', (payload) => {
      if (!isEventForActivePage(payload)) return;
      handlers.onNewReply!(payload);
    });
  }

  if (handlers.onConversationUpdated) {
    s.on('conversation_updated', (conversation) => {
      if (!isEventForActivePage(conversation)) return;
      handlers.onConversationUpdated!(conversation);
    });
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
