import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
  Keyboard,
  PermissionsAndroid,
  Image,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import FastImage from 'react-native-fast-image';
import { Send, Bot, BellOff, MessageSquare, Check, Sparkles, Paperclip, FileText, Film, Volume2, X, Clock, XCircle } from 'lucide-react-native';
import { useGlobalState } from '../context/GlobalStateContext';
import { AttachmentItem } from '../types';
import { resolveMediaUrl } from '../services/api';

let launchImageLibrary: any;
try {
  launchImageLibrary = require('react-native-image-picker').launchImageLibrary;
} catch {}

const QUICK_REPLIES = [
  'Hi there! How can we help you today?',
  'Thanks for reaching out! Let me check that for you.',
  'Our support team is looking into this.',
  'Have a wonderful day!',
];

const GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600',
  'https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?w=600',
  'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
  'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600',
];

function formatMessageTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name?: string | null): string {
  if (!name) return 'FB';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function parseAttachments(attachmentsStr?: any): AttachmentItem[] {
  if (!attachmentsStr) return [];
  try {
    let parsed = typeof attachmentsStr === 'string' ? JSON.parse(attachmentsStr) : attachmentsStr;
    if (parsed?.data && Array.isArray(parsed.data)) {
      parsed = parsed.data;
    }
    if (!Array.isArray(parsed)) {
      if (typeof parsed === 'object' && parsed !== null) parsed = [parsed];
      else return [];
    }
    return parsed.map((item: any) => {
      const type = item.type || (item.mimeType?.startsWith('video/') ? 'video' : 'image');
      const url = item.url || item.payload?.url || item.image_data?.url || item.preview_url || item.src || '';
      const name = item.name || item.title || (type === 'image' ? 'Image Attachment' : 'Attachment');
      return { type, url, name };
    }).filter((att: any) => !!att.url);
  } catch {
    return [];
  }
}

export const ChatScreen = () => {
  const {
    conversations,
    selectedConversationId,
    messages,
    loadingMessages,
    handleSendReply,
    handleToggleAutoReply,
    handleMarkAsRead,
  } = useGlobalState();

  const conversation = conversations.find((c) => c.id === selectedConversationId);
  const [inputText, setInputText] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const flashListRef = useRef<any>(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => flashListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (conversation?.unread) {
      handleMarkAsRead();
    }
  }, [conversation?.id, conversation?.unread, handleMarkAsRead]);

  const handlePickGalleryImage = async () => {
    console.log('[Attachment Audit] Paperclip button pressed');
    if (Platform.OS === 'android') {
      try {
        const perm = Number(Platform.Version) >= 33
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        console.log(`[Permission Audit] Requesting permission "${perm}" on Android API Level ${Platform.Version}...`);
        const status = await PermissionsAndroid.request(perm, {
          title: 'Media Permission',
          message: 'App needs access to your photo gallery to attach images to messages.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        });
        console.log(`[Permission Audit] Permission result: ${status}`);
      } catch (err: any) {
        console.error('[Permission Audit] Error requesting permission:', err.message);
      }
    }

    if (typeof launchImageLibrary === 'function') {
      try {
        console.log('[ImagePicker Audit] Invoking native launchImageLibrary...');
        const result = await launchImageLibrary({
          mediaType: 'photo',
          quality: 0.8,
          selectionLimit: 1,
        });
        console.log('[ImagePicker Audit] Result:', JSON.stringify(result, null, 2));

        if (result && !result.didCancel && result.assets?.[0]?.uri) {
          console.log('[ImagePicker Audit] Selected URI:', result.assets[0].uri);
          setMediaUri(result.assets[0].uri);
        }
      } catch (err: any) {
        console.warn('[ImagePicker Audit] Native module launch failed:', err.message);
      }
    } else {
      console.warn('[ImagePicker Audit] launchImageLibrary is NOT a function in current JS runtime.');
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !mediaUri) || sending) return;
    const textToSend = inputText.trim();
    const uriToSend = mediaUri;

    setInputText('');
    setMediaUri(null);
    setSending(true);

    try {
      console.log(`[DEBUG] ChatScreen.onSend: Triggered for conversation ID: ${conversation?.id}`);
      if (uriToSend) {
        await handleSendReply(textToSend || undefined, {
          uri: uriToSend,
          type: 'image/jpeg',
          name: 'attachment.jpg',
        });
      } else {
        await handleSendReply(textToSend);
      }
      console.log(`[DEBUG] ChatScreen.onSend: Success`);
    } catch (err: any) {
      console.log(`[DEBUG] ChatScreen.onSend Error: ${err.message}`, err.stack);
      // We don't restore the text input here because optimistic messaging
      // leaves the failed message in the chat stream visually marked as failed.
    } finally {
      setSending(false);
    }
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  if (!conversation) {
    return (
      <View style={styles.emptyState}>
        <MessageSquare size={48} color="#4f46e5" />
        <Text style={styles.emptyStateTitle}>No Conversation Selected</Text>
        <Text style={styles.emptyStateDesc}>Select a conversation from the Inbox.</Text>
      </View>
    );
  }

  const renderAttachments = (attachments: AttachmentItem[]) => {
    if (!attachments || attachments.length === 0) return null;

    return (
      <View style={styles.attachmentsContainer}>
        {attachments.map((att, idx) => {
          if (att.type === 'image' && att.url) {
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => handleOpenUrl(resolveMediaUrl(att.url))}
                activeOpacity={0.9}
              >
                <FastImage 
                  source={{ uri: resolveMediaUrl(att.url) }} 
                  style={styles.attachmentImg} 
                  resizeMode={FastImage.resizeMode.cover} 
                />
              </TouchableOpacity>
            );
          }

          let icon = <FileText size={16} color="#D4AF37" />;
          let label = att.name || att.title || 'Attachment File';

          if (att.type === 'video') {
            icon = <Film size={16} color="#D4AF37" />;
            label = 'Video File';
          } else if (att.type === 'audio') {
            icon = <Volume2 size={16} color="#D4AF37" />;
            label = 'Audio Recording';
          }

          return (
            <TouchableOpacity
              key={idx}
              style={styles.attachmentFileChip}
              onPress={() => handleOpenUrl(resolveMediaUrl(att.url))}
            >
              {icon}
              <Text style={styles.attachmentFileLabel} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderMessage = ({ item: msg }: any) => {
    const isInbound = msg.direction === 'inbound';
    const isAuto = msg.direction === 'outbound_auto';
    const attachments = parseAttachments(msg.attachments);

    return (
      <View style={[styles.messageRow, isInbound ? styles.messageInbound : styles.messageOutbound]}>

        <View
          style={[
            styles.messageBubble,
            isInbound ? styles.bubbleInbound : isAuto ? styles.bubbleAuto : styles.bubbleManual,
          ]}
        >
          {isAuto && (
            <View style={styles.autoBadgeIndicator}>
              <Sparkles size={11} color="#1E1E1E" />
              <Text style={styles.autoBadgeText}>KEYWORD AUTO-REPLY</Text>
            </View>
          )}

          {attachments && attachments.length > 0 ? (
            renderAttachments(attachments)
          ) : !msg.text || !msg.text.trim() ? (
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600' }}
              style={styles.attachmentImg}
              resizeMode="cover"
            />
          ) : null}

          {!!msg.text && !!msg.text.trim() && msg.text !== '[IMAGE]' && (
            <Text style={[styles.messageText, !isInbound && styles.messageTextWhite]}>
              {msg.text}
            </Text>
          )}
        </View>

        <View style={styles.messageMeta}>
          <Text style={styles.messageTime}>{formatMessageTime(msg.createdAt)}</Text>
          {!isInbound && (
            msg.status === 'sending' ? (
              <Clock size={12} color="#94a3b8" />
            ) : msg.status === 'failed' ? (
              <XCircle size={12} color="#F87171" />
            ) : (
              <Check size={12} color="#4ADE80" />
            )
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      <View style={styles.header}>
        <View style={styles.chatUserMeta}>
          <View style={styles.avatarWrapper}>
            {conversation.userAvatarUrl ? (
              <Image source={{ uri: conversation.userAvatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>{getInitials(conversation.userName)}</Text>
              </View>
            )}
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.userName}>
                {conversation.userName || `User ${conversation.psid.slice(-6)}`}
              </Text>
              {conversation.page?.name && (
                <View style={styles.headerPageBadge}>
                  <Text style={styles.headerPageBadgeText}>{conversation.page.name}</Text>
                </View>
              )}
            </View>
            <Text style={styles.psidChip}>PSID: {conversation.psid}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.toggleBotBtn,
            conversation.autoReplyEnabled ? styles.toggleBotActive : styles.toggleBotMuted,
          ]}
          onPress={() => handleToggleAutoReply()}
        >
          {conversation.autoReplyEnabled ? (
            <Bot size={14} color="#0369a1" />
          ) : (
            <BellOff size={14} color="#F87171" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.messagesContainer}>
        {loadingMessages && messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateDesc}>Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateDesc}>No messages in this conversation yet.</Text>
          </View>
        ) : (
          <View style={styles.messagesListContainer}>
            <FlashList
              ref={flashListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              estimatedItemSize={100}
              inverted
            />
          </View>
        )}
      </View>

      <View style={styles.quickRepliesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {QUICK_REPLIES.map((quickText, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.quickReplyBtn}
              onPress={() => setInputText(quickText)}
            >
              <Text style={styles.quickReplyText}>{quickText}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Media Attachment Preview Bar */}
      {mediaUri && (
        <View style={styles.attachmentPreviewBar}>
          <Image source={{ uri: mediaUri }} style={styles.attachmentPreviewThumb} />
          <View style={styles.attachmentPreviewInfo}>
            <Text style={styles.attachmentPreviewTitle}>Photo Attached from Gallery</Text>
            <Text style={styles.attachmentPreviewSub}>Tap paperclip to pick another photo</Text>
          </View>
          <TouchableOpacity style={styles.removeAttachmentBtn} onPress={() => setMediaUri(null)}>
            <X size={14} color="#F87171" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={handlePickGalleryImage}
        >
          <Paperclip size={18} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Reply..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() && !mediaUri || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={(!inputText.trim() && !mediaUri) || sending}
          >
            <Send size={16} color="#1E1E1E" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  chatUserMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: '#4f46e5',
    fontWeight: 'bold',
    fontSize: 14,
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F3F4F6',
  },
  headerPageBadge: {
    backgroundColor: '#2A2416',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  headerPageBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D4AF37',
  },
  psidChip: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  toggleBotBtn: {
    padding: 8,
    borderRadius: 8,
  },
  toggleBotActive: {
    backgroundColor: '#e0f2fe',
  },
  toggleBotMuted: {
    backgroundColor: '#3F1D1D',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesListContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  messageInbound: {
    alignSelf: 'flex-start',
  },
  messageOutbound: {
    alignSelf: 'flex-end',
  },
  messageSenderName: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  bubbleInbound: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    borderTopLeftRadius: 4,
  },
  bubbleAuto: {
    backgroundColor: '#B5952F',
    borderTopRightRadius: 4,
  },
  bubbleManual: {
    backgroundColor: '#D4AF37',
    borderTopRightRadius: 4,
  },
  autoBadgeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  autoBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1E1E1E',
    marginLeft: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#F3F4F6',
    lineHeight: 20,
  },
  messageTextWhite: {
    color: '#1E1E1E',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  attachmentsContainer: {
    marginBottom: 6,
    gap: 6,
  },
  attachmentImg: {
    width: 200,
    height: 140,
    borderRadius: 10,
  },
  attachmentFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  attachmentFileLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E5E7EB',
  },
  quickRepliesContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  quickReplyBtn: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  quickReplyText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  attachmentPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2416',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
  },
  attachmentPreviewThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#dbeafe',
  },
  attachmentPreviewInfo: {
    flex: 1,
  },
  attachmentPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
  },
  attachmentPreviewSub: {
    fontSize: 11,
    color: '#E6C259',
    marginTop: 2,
  },
  removeAttachmentBtn: {
    padding: 6,
    backgroundColor: '#3F1D1D',
    borderRadius: 16,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  attachBtn: {
    padding: 8,
    marginRight: 4,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 20,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#F3F4F6',
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#D4AF37',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#555555',
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
