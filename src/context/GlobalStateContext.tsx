import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Conversation, Message, Rule, SettingsData, SyncStatus, PageData } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { networkManager } from '../services/NetworkManager';
import {
  fetchConversations,
  fetchConversationMessages,
  sendReply,
  toggleConversationAutoReply,
  markConversationAsRead,
  fetchRules,
  createRule,
  updateRule,
  deleteRule,
  reorderRules,
  fetchSettings,
  updateGlobalAutoReply,
  verifyFacebookConnection,
  triggerSync,
  fetchPages,
  addPage,
  deletePage,
  forceSync as apiForceSync,
} from '../services/api';
import { getSocket, reconnectSocket, subscribeToRealtimeEvents } from '../services/socket';
import { database } from '../database';
import PageModel from '../database/models/Page';
import ConversationModel from '../database/models/Conversation';
import MessageModel from '../database/models/Message';
import { NetworkObserver } from '../services/NetworkObserver';
import { OfflineQueue } from '../services/OfflineQueue';
import { NotificationsManager } from '../services/NotificationsManager';

interface GlobalStateContextType {
  conversations: Conversation[];
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  messages: Message[];
  loadingMessages: boolean;
  rules: Rule[];
  settings: SettingsData | null;
  syncStatus: SyncStatus | undefined;
  socketConnected: boolean;
  pages: PageData[];
  selectedPageId: string;
  setSelectedPageId: (pageId: string) => void;
  
  // Actions
  handleSendReply: (text?: string, mediaFile?: any) => Promise<void>;
  handleToggleAutoReply: (enabled?: boolean) => Promise<void>;
  handleMarkAsRead: () => Promise<void>;
  handleCreateRule: (rule: any) => Promise<void>;
  handleUpdateRule: (id: string, updates: Partial<Rule>) => Promise<void>;
  handleDeleteRule: (id: string) => Promise<void>;
  handleReorderRules: (ruleIds: string[]) => Promise<void>;
  handleUpdateGlobalAutoReply: (enabled: boolean) => Promise<void>;
  handleVerifyFacebook: () => Promise<void>;
  handleTriggerSync: () => Promise<void>;
  forceSync: () => Promise<void>;
  handleAddPage: (token: string, name?: string, pageId?: string) => Promise<PageData>;
  handleDeletePage: (id: string) => Promise<void>;
  loadPages: () => Promise<void>;
  loadConversations: () => Promise<void>;
}

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

function deduplicateMessages(list: Message[]): Message[] {
  const seenIds = new Set<string>();
  const seenFbIds = new Set<string>();
  const result: Message[] = [];

  for (const m of list) {
    if (!m) continue;
    if (m.id && seenIds.has(m.id)) continue;
    if (m.fbMessageId && seenFbIds.has(m.fbMessageId)) continue;

    const isDuplicateOutbound = result.some(
      (existing) =>
        existing.direction === m.direction &&
        (existing.direction === 'outbound_manual' || existing.direction === 'outbound_auto') &&
        existing.text?.trim() === m.text?.trim() &&
        Math.abs(new Date(existing.createdAt).getTime() - new Date(m.createdAt).getTime()) < 30000
    );

    if (isDuplicateOutbound) continue;

    if (m.id) seenIds.add(m.id);
    if (m.fbMessageId) seenFbIds.add(m.fbMessageId);
    result.push(m);
  }

  return result;
}

export const GlobalStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const selectedConvIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedConvIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [settings, setSettings] = useState<SettingsData>({
    globalAutoReply: true,
    facebookStatus: {
      connected: true,
      pageId: '752790171249695',
      pageName: 'Flirt with Fortune',
    },
    webhookConfig: {
      callbackPath: '/webhook/facebook',
      verifyTokenSet: true,
      appSecretSet: true,
      pageAccessTokenSet: true,
    },
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus | undefined>();
  const [socketConnected, setSocketConnected] = useState(false);
  
  const [pages, setPages] = useState<PageData[]>([
    {
      id: 'cmsfbnc5j0000dtde9a6dpamz',
      pageId: '752790171249695',
      name: 'Flirt with Fortune',
      pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      isActive: true,
      totalConversations: 3,
      unreadConversations: 1,
    },
    {
      id: 'cmsfbr2f40001mc764k0euaqn',
      pageId: '884920193821042',
      name: 'Luxe Audio & Electronics',
      isActive: true,
      totalConversations: 2,
      unreadConversations: 0,
    },
    {
      id: 'cmsfbr2f80002mc76vxhaebgx',
      pageId: '992817264810294',
      name: 'Nexus Digital Solutions',
      isActive: true,
      totalConversations: 1,
      unreadConversations: 0,
    },
  ]);
  const [selectedPageId, setSelectedPageId] = useState<string>('all');
  const [socketTrigger, setSocketTrigger] = useState<number>(0);

  // Initial Data Fetching
  const loadPages = useCallback(async () => {
    try {
      const pageList = await fetchPages();
      if (pageList && pageList.length > 0) {
        setPages(pageList);
        AsyncStorage.setItem('@cache_pages', JSON.stringify(pageList)).catch(() => {});
        
        await database.write(async () => {
            const batch = [];
            for (const pg of pageList) {
                const existing = await database.collections.get<PageModel>('pages').find(pg.id).catch(() => null);
                if (existing) {
                    batch.push(existing.prepareUpdate(p => {
                        p.name = pg.name;
                        p.isActive = pg.isActive;
                    }));
                } else {
                    batch.push(database.collections.get<PageModel>('pages').prepareCreate(p => {
                        p._raw.id = pg.id;
                        p.pageId = pg.pageId;
                        p.name = pg.name;
                        p.isActive = pg.isActive;
                    }));
                }
            }
            if (batch.length > 0) await database.batch(batch);
        });
      }
    } catch (err: any) {
      if (err.message === 'AbortError') return;
      console.warn('Failed to load pages, trying cache');
      const cached = await AsyncStorage.getItem('@cache_pages');
      if (cached) setPages(JSON.parse(cached));
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const list = await fetchConversations(undefined, selectedPageId);
      setConversations(list);
      AsyncStorage.setItem('@cache_conversations_' + selectedPageId, JSON.stringify(list)).catch(() => {});
      
      await database.write(async () => {
        const batch = [];
        for (const conv of list) {
          const existing = await database.collections.get<ConversationModel>('conversations').find(conv.id).catch(() => null);
          if (existing) {
            batch.push(existing.prepareUpdate(c => {
              c.userName = conv.userName;
              c.lastMessageAt = new Date(conv.lastMessageAt).getTime();
              c.unread = conv.unread;
            }));
          } else {
            batch.push(database.collections.get<ConversationModel>('conversations').prepareCreate(c => {
              c._raw.id = conv.id;
              c.psid = conv.psid;
              c.pageId = conv.pageId || '';
              c.userName = conv.userName;
              c.lastMessageAt = new Date(conv.lastMessageAt).getTime();
              c.unread = conv.unread;
            }));
          }
        }
        await database.batch(batch);
      });
    } catch (err: any) {
      if (err.message === 'AbortError') return;
      console.warn('Failed to load conversations, trying cache');
      const cached = await AsyncStorage.getItem('@cache_conversations_' + selectedPageId);
      if (cached) setConversations(JSON.parse(cached));
    }
  }, [selectedPageId]);

  const loadRules = useCallback(async () => {
    try {
      const list = await fetchRules();
      setRules(list);
      AsyncStorage.setItem('@cache_rules', JSON.stringify(list)).catch(() => {});
    } catch {
      console.warn('Failed to load rules, trying cache');
      const cached = await AsyncStorage.getItem('@cache_rules');
      if (cached) setRules(JSON.parse(cached));
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
      AsyncStorage.setItem('@cache_settings', JSON.stringify(data)).catch(() => {});
    } catch {
      console.warn('Failed to load settings, trying cache');
      const cached = await AsyncStorage.getItem('@cache_settings');
      if (cached) setSettings(JSON.parse(cached));
    }
  }, []);

  // App Boot Sequence
  useEffect(() => {
    let mounted = true;

    const bootSequence = async () => {
      try {
        console.log('[App Boot] Testing connection...');
        const isConnected = await networkManager.testConnection();
        if (!mounted) return;

        if (isConnected) {
          console.log('[App Boot] Backend reached. Loading live data.');
          
          // NetworkManager has finished probing, so force socket to bind to correct URL
          reconnectSocket();
          setSocketTrigger(prev => prev + 1);

          await loadPages();
          if (!mounted) return;

          await Promise.all([loadSettings(), loadRules()]);
          if (!mounted) return;

          await loadConversations();
        } else {
          console.warn('[App Boot] Offline mode. Loading cached data.');
          await loadPages();
          await loadSettings();
          await loadRules();
          await loadConversations();
        }
      } catch (err) {
        console.error('[App Boot] Critical boot error:', err);
      }
    };

    bootSequence();

    return () => {
      mounted = false;
    };
  }, [loadPages, loadRules, loadSettings, loadConversations]);

  // PHASE 6: Foreground Sync
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        console.log('[BackgroundSync] App foregrounded. Triggering sync...');
        // We only reload what's necessary (delta sync will be faster thanks to phase 5)
        loadConversations();
        loadPages();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadConversations, loadPages]);

  // Fetch Messages when selected conversation changes
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    let isCurrent = true;
    setLoadingMessages(true);

    fetchConversationMessages(selectedConversationId)
      .then(async (data) => {
          // FlashList inverted requires newest message at index 0
          setMessages(deduplicateMessages(data.messages).reverse());

        // PHASE 4: Mirror to WatermelonDB
        try {
          await database.write(async () => {
            const batch = [];
            for (const msg of data.messages) {
              const existing = await database.collections.get<MessageModel>('messages').find(msg.id).catch(() => null);
              if (!existing) {
                batch.push(database.collections.get<MessageModel>('messages').prepareCreate(m => {
                  m._raw.id = msg.id;
                  m.conversationId = msg.conversationId;
                  m.fbMessageId = msg.fbMessageId;
                  m.direction = msg.direction;
                  m.text = msg.text;
                  m.attachmentsJson = msg.attachments ? JSON.stringify(msg.attachments) : undefined;
                  m.createdAt = new Date(msg.createdAt).getTime();
                }));
              }
            }
            if (batch.length > 0) await database.batch(batch);
          });
        } catch (dbErr) {
          console.warn('[WatermelonDB] Failed to mirror messages:', dbErr);
        }
      })
      .catch((err) => console.error('Failed to fetch messages:', err))
      .finally(() => {
        if (isCurrent) setLoadingMessages(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedConversationId]);

  // Setup Socket.IO Realtime Listeners
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    setSocketConnected(socket.connected);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    const unsubscribe = subscribeToRealtimeEvents({
      onNewMessage: ({ message, conversation }) => {
        setConversations((prev) => {
          const index = prev.findIndex((c) => c.id === conversation.id);
          const updatedConv = {
            ...conversation,
            lastMessage: message,
          };
          let copy = [...prev];
          if (index >= 0) {
            copy.splice(index, 1);
            copy = [updatedConv, ...copy];
          } else {
            copy = [updatedConv, ...copy];
          }
          return copy.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        });

        if (selectedConvIdRef.current === conversation.id) {
          // Add to front since list is inverted
          setMessages((prev) => deduplicateMessages([message, ...prev]));
        } else {
          // Trigger local heads-up notification since user is not actively viewing this conversation
          NotificationsManager.displayLocalNotification(
            `New message from ${conversation.userName}`,
            message.text || 'Sent an attachment',
            conversation.id
          );
        }

        loadPages();
      },

      onNewReply: ({ message, conversationId }) => {
        setConversations((prev) => {
          const index = prev.findIndex((c) => c.id === conversationId);
          let copy = [...prev];
          if (index >= 0) {
            const target = { ...prev[index], lastMessage: message, lastMessageAt: message.createdAt };
            copy.splice(index, 1);
            copy = [target, ...copy];
          }
          return copy.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        });

        if (selectedConvIdRef.current === conversationId) {
          // Add to front since list is inverted
          setMessages((prev) => deduplicateMessages([message, ...prev]));
        }
      },

      onConversationUpdated: (updated) => {
        setConversations((prev) => {
          const mapped = prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c));
          return mapped.sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        });
      },

      onSyncStatus: (status) => {
        setSyncStatus(status);
        if (!status.inProgress) {
          loadConversations();
          loadPages();
        }
      },
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      unsubscribe();
    };
  }, [loadConversations, loadPages, socketTrigger]);

  // Handlers
  const handleSendReply = async (text?: string, mediaFile?: any) => {
    if (!selectedConversationId) return;
    
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversationId: selectedConversationId,
      direction: 'outbound_manual',
      text: text || '[Attachment]',
      createdAt: new Date().toISOString(),
      status: 'sending', // or 'pending' if offline
    };

    if (!NetworkObserver.isOnline()) {
      optimisticMessage.status = 'pending';
      setMessages((prev) => [optimisticMessage, ...prev]);
      // Enqueue for offline delivery
      const conv = conversations.find(c => c.id === selectedConversationId);
      await OfflineQueue.enqueue(
        selectedConversationId,
        conv?.pageId || '',
        text || '',
        mediaFile ? JSON.stringify(mediaFile) : undefined
      );
      return;
    }

    setMessages((prev) => [optimisticMessage, ...prev]);

    try {
      const result = await sendReply(selectedConversationId, text, mediaFile);
      setMessages((prev) =>
        deduplicateMessages(
          prev.map((msg) =>
            msg.id === optimisticId ? { ...result.message, status: 'sent' } : msg
          )
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticId ? { ...msg, status: 'failed' } : msg
        )
      );
      throw err;
    }
  };

  const handleToggleAutoReply = async (enabled?: boolean) => {
    if (!selectedConversationId) return;
    const result = await toggleConversationAutoReply(selectedConversationId, enabled);
    setConversations((prev) =>
      prev.map((c) => (c.id === result.conversation.id ? { ...c, ...result.conversation } : c))
    );
  };

  const handleMarkAsRead = async () => {
    if (!selectedConversationId) return;
    const result = await markConversationAsRead(selectedConversationId);
    setConversations((prev) =>
      prev.map((c) => (c.id === result.conversation.id ? { ...c, ...result.conversation } : c))
    );
    
    // Persist to WatermelonDB so rebooting offline preserves read state
    try {
      await database.write(async () => {
        const existing = await database.collections.get<ConversationModel>('conversations').find(result.conversation.id).catch(() => null);
        if (existing) {
          await existing.update(c => {
            c.unread = false;
          });
        }
      });
    } catch (e) {
      console.warn('[WatermelonDB] Failed to update read status locally:', e);
    }
    
    loadPages();
  };

  const handleCreateRule = async (newRule: any) => {
    const created = await createRule(newRule);
    setRules((prev) => [...prev, created].sort((a, b) => a.priority - b.priority));
  };

  const handleUpdateRule = async (id: string, updates: Partial<Rule>) => {
    const updated = await updateRule(id, updates);
    setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  const handleDeleteRule = async (id: string) => {
    await deleteRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleReorderRules = async (ruleIds: string[]) => {
    const reordered = await reorderRules(ruleIds);
    setRules(reordered);
  };

  const handleUpdateGlobalAutoReply = async (enabled: boolean) => {
    const newVal = await updateGlobalAutoReply(enabled);
    setSettings((prev) => (prev ? { ...prev, globalAutoReply: newVal } : null));
  };

  const handleVerifyFacebook = async () => {
    const status = await verifyFacebookConnection();
    setSettings((prev) =>
      prev ? { ...prev, facebookStatus: { ...prev.facebookStatus, ...status } } : null
    );
  };

  const handleTriggerSync = async () => {
    setSyncStatus({ inProgress: true, message: 'Starting Facebook sync...' });
    try {
      await triggerSync(selectedPageId !== 'all' ? selectedPageId : undefined);
      await loadConversations();
      await loadPages();
    } catch (err: any) {
      setSyncStatus({ inProgress: false, message: `Sync error: ${err.message || err}` });
    }
  };

  const forceSync = useCallback(async () => {
    try {
      await apiForceSync();
      await loadConversations();
      await loadPages();
    } catch (error) {
      console.error('[GlobalState] forceSync error:', error);
    }
  }, [loadConversations, loadPages]);

  const handleAddPage = async (token: string, name?: string, pageId?: string) => {
    const res = await addPage(token, name, pageId);
    await loadPages();
    setSelectedPageId(res.page.id);
    await loadConversations();
    return res.page;
  };

  const handleDeletePage = async (id: string) => {
    await deletePage(id);
    await loadPages();
    if (selectedPageId === id) {
      setSelectedPageId('all');
    }
    await loadConversations();
  };

  return (
    <GlobalStateContext.Provider
      value={{
        conversations,
        selectedConversationId,
        setSelectedConversationId,
        messages,
        loadingMessages,
        rules,
        settings,
        syncStatus,
        socketConnected,
        pages,
        selectedPageId,
        setSelectedPageId,
        handleSendReply,
        handleToggleAutoReply,
        handleMarkAsRead,
        handleCreateRule,
        handleUpdateRule,
        handleDeleteRule,
        handleReorderRules,
        handleUpdateGlobalAutoReply,
        handleVerifyFacebook,
        handleTriggerSync,
        forceSync,
        handleAddPage,
        handleDeletePage,
        loadPages,
        loadConversations,
      }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (context === undefined) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
};
