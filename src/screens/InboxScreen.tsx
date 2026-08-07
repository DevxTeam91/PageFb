import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FastImage from 'react-native-fast-image';
import { Search, Bot, BellOff, MessageSquareOff, Plus, Globe } from 'lucide-react-native';
import { useGlobalState } from '../context/GlobalStateContext';
import { Conversation, PageData } from '../types';
import { useNavigation } from '@react-navigation/native';
import { AddPageModal } from '../components/AddPageModal';

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitials(name?: string | null): string {
  if (!name) return 'FB';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const InboxScreen = () => {
  const {
    conversations,
    setSelectedConversationId,
    pages,
    selectedPageId,
    setSelectedPageId,
    forceSync,
    handleMarkAllAsRead,
  } = useGlobalState();
  const navigation = useNavigation<any>();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'bot_active' | 'bot_muted'>('all');
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (c.userName || '').toLowerCase().includes(q);
        const matchesPsid = c.psid.toLowerCase().includes(q);
        const matchesSnippet = (c.lastMessage?.text || '').toLowerCase().includes(q);
        const matchesPageName = (c.page?.name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPsid && !matchesSnippet && !matchesPageName) {
          return false;
        }
      }

      // Tab filter
      if (filter === 'unread') return c.unread;
      if (filter === 'bot_active') return c.autoReplyEnabled;
      if (filter === 'bot_muted') return !c.autoReplyEnabled;
      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.lastMessageAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || 0).getTime();
      return timeB - timeA;
    });
  }, [conversations, searchQuery, filter]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    navigation.navigate('Chat');
  };

  const renderFilterPill = (type: typeof filter, label: string) => (
    <TouchableOpacity
      style={[styles.filterPill, filter === type && styles.filterPillActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterPillText, filter === type && styles.filterPillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderPageChip = (pageId: string, label: string, badgeCount?: number) => {
    const isSelected = selectedPageId === pageId;
    return (
      <TouchableOpacity
        key={pageId}
        style={[styles.pageChip, isSelected && styles.pageChipActive]}
        onPress={() => setSelectedPageId(pageId)}
      >
        <Globe size={12} color={isSelected ? '#1E1E1E' : '#9CA3AF'} style={{ marginRight: 4 }} />
        <Text style={[styles.pageChipText, isSelected && styles.pageChipTextActive]}>
          {label}
        </Text>
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={[styles.pageBadge, isSelected && styles.pageBadgeActive]}>
            <Text style={[styles.pageBadgeText, isSelected && styles.pageBadgeTextActive]}>
              {badgeCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderConversation = ({ item: conv }: { item: Conversation }) => {
    const snippetPrefix =
      conv.lastMessage?.direction === 'outbound_manual'
        ? 'You: '
        : conv.lastMessage?.direction === 'outbound_auto'
        ? '🤖: '
        : '';

    return (
      <TouchableOpacity
        style={[styles.conversationItem, conv.unread && styles.conversationItemUnread]}
        onPress={() => handleSelectConversation(conv.id)}
      >
        <View style={styles.avatarWrapper}>
          {conv.userAvatarUrl ? (
            <FastImage source={{ uri: conv.userAvatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>{getInitials(conv.userName)}</Text>
            </View>
          )}
          {conv.unread && <View style={styles.unreadBadgeDot} />}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationTitleRow}>
            <Text
              style={[styles.conversationName, conv.unread && styles.conversationNameUnread]}
              numberOfLines={1}
            >
              {conv.userName || `User ${conv.psid.slice(-6)}`}
            </Text>
            <Text style={styles.conversationTime}>{formatRelativeTime(conv.lastMessageAt)}</Text>
          </View>

          {conv.page?.name && (
            <View style={styles.pageTagRow}>
              <Text style={styles.pageTagName} numberOfLines={1}>
                {conv.page.name}
              </Text>
            </View>
          )}

          <View style={styles.conversationSnippetRow}>
            <Text
              style={[styles.conversationSnippet, conv.unread && styles.conversationSnippetUnread]}
              numberOfLines={1}
            >
              {conv.lastMessage ? `${snippetPrefix}${conv.lastMessage.text}` : 'No messages yet'}
            </Text>

            {conv.autoReplyEnabled ? (
              <View style={[styles.botTag, styles.botTagActive]}>
                <Bot size={10} color="#B5952F" />
                <Text style={styles.botTagTextActive}>AUTO</Text>
              </View>
            ) : (
              <View style={[styles.botTag, styles.botTagMuted]}>
                <BellOff size={10} color="#94a3b8" />
                <Text style={styles.botTagTextMuted}>MUTED</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Page Switcher Chips Bar */}
        <View style={styles.pageBarHeader}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pageBarScroll}>
            {renderPageChip('all', 'All Pages', conversations.filter((c) => c.unread).length)}
            {pages.map((p) =>
              renderPageChip(p.id, p.name, p.unreadConversations)
            )}
          </ScrollView>
          <TouchableOpacity
            style={styles.addPageBtn}
            onPress={() => setIsAddPageModalOpen(true)}
          >
            <Plus size={16} color="#D4AF37" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations, names, PSID..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Status Filter Pills */}
        <View style={styles.filterPillsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsScroll}>
            {renderFilterPill('all', `All (${conversations.length})`)}
            {renderFilterPill('unread', `Unread (${conversations.filter((c) => c.unread).length})`)}
            {renderFilterPill('bot_active', 'Bot Active')}
            {renderFilterPill('bot_muted', 'Muted')}
          </ScrollView>
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllReadBtn}>
            <Text style={styles.markAllReadText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      </View>

      {filteredConversations.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageSquareOff size={48} color="#94a3b8" />
          <Text style={styles.emptyStateTitle}>No conversations found</Text>
          <Text style={styles.emptyStateDesc}>
            {searchQuery
              ? 'Try matching a different keyword or name.'
              : 'Incoming messages from your Facebook Pages will appear here live.'}
          </Text>
        </View>
      ) : (
        <View style={styles.listWrapper}>
          <FlashList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversation}
            contentContainerStyle={styles.listContent}
            estimatedItemSize={70}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={async () => {
                  setIsRefreshing(true);
                  try {
                    if (forceSync) {
                      await forceSync();
                    }
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                tintColor="#D4AF37"
                colors={['#D4AF37']}
              />
            }
          />
        </View>
      )}

      <AddPageModal
        visible={isAddPageModalOpen}
        onClose={() => setIsAddPageModalOpen(false)}
        onPageAdded={() => {}}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    padding: 14,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  pageBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageBarScroll: {
    flex: 1,
  },
  pageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#555555',
  },
  pageChipActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  pageChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  pageChipTextActive: {
    color: '#1E1E1E',
  },
  pageBadge: {
    backgroundColor: '#333333',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  pageBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  pageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  pageBadgeTextActive: {
    color: '#1E1E1E',
  },
  addPageBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#2A2416',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#F3F4F6',
  },
  filterPillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterPillsScroll: {
    flex: 1,
  },
  markAllReadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#333333',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  markAllReadText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  filterPillActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#c7d2fe',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  filterPillTextActive: {
    color: '#4f46e5',
  },
  listWrapper: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  conversationItemUnread: {
    backgroundColor: '#1E1E1E',
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    marginRight: 12,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#4f46e5',
    fontWeight: 'bold',
    fontSize: 16,
  },
  unreadBadgeDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    backgroundColor: '#0084ff',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1E1E1E',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  conversationName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#F3F4F6',
    flex: 1,
  },
  conversationNameUnread: {
    fontWeight: '700',
  },
  conversationTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 8,
  },
  pageTagRow: {
    marginBottom: 4,
  },
  pageTagName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D4AF37',
    backgroundColor: '#2A2416',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  conversationSnippetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationSnippet: {
    fontSize: 13,
    color: '#9CA3AF',
    flex: 1,
    marginRight: 8,
  },
  conversationSnippetUnread: {
    fontWeight: '600',
    color: '#F3F4F6',
  },
  botTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  botTagActive: {
    backgroundColor: '#e0f2fe',
  },
  botTagMuted: {
    backgroundColor: '#2A2A2A',
  },
  botTagTextActive: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#B5952F',
    marginLeft: 4,
  },
  botTagTextMuted: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F3F4F6',
    marginTop: 16,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});
