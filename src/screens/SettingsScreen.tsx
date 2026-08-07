import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {
  Bot,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Globe,
  Plus,
  Trash2,
  Volume2,
  ShieldCheck,
} from 'lucide-react-native';
import { useGlobalState } from '../context/GlobalStateContext';
import { AddPageModal } from '../components/AddPageModal';

export const SettingsScreen = () => {
  const {
    settings,
    syncStatus,
    pages,
    handleUpdateGlobalAutoReply,
    handleVerifyFacebook,
    handleTriggerSync,
    handleDeletePage,
  } = useGlobalState();

  const [verifying, setVerifying] = useState(false);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await handleVerifyFacebook();
      Alert.alert('Connection Verified', 'Facebook connection status updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', `Failed: ${e.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const confirmDeletePage = (id: string, pageName: string) => {
    if (pages.length <= 1) {
      Alert.alert('Cannot Remove Page', 'You must have at least one Facebook Page connected.');
      return;
    }

    Alert.alert(
      'Disconnect Page',
      `Are you sure you want to disconnect ${pageName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await handleDeletePage(id);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove page');
            }
          },
        },
      ]
    );
  };

  const webhookUrl = 'https://fb-page-inbox.onrender.com/webhook/facebook';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings & Multi-Page Management</Text>
        <Text style={styles.headerSubtitle}>
          Manage connected Facebook Pages, sound alerts, notifications, and automation rules.
        </Text>
      </View>

      {/* 1. Connected Facebook Pages Section */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <Globe size={18} color="#D4AF37" />
            <Text style={styles.cardTitle}>Connected Facebook Pages ({pages.length})</Text>
          </View>
          <TouchableOpacity
            style={styles.addPageBtn}
            onPress={() => setIsAddPageModalOpen(true)}
          >
            <Plus size={14} color="#1E1E1E" style={{ marginRight: 4 }} />
            <Text style={styles.addPageBtnText}>Connect New Page</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pagesList}>
          {pages.length === 0 ? (
            <View style={styles.emptyPageContainer}>
              <Text style={styles.emptyPageText}>0 Pages Connected</Text>
            </View>
          ) : (
            pages.map((p) => (
              <View key={p.id} style={styles.pageCardItem}>
                <View style={styles.pageAvatarWrapper}>
                  {p.pictureUrl ? (
                    <Image source={{ uri: p.pictureUrl }} style={styles.pageAvatarImg} />
                  ) : (
                    <View style={styles.pageAvatarPlaceholder}>
                      <Text style={styles.pageAvatarText}>{p.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.pageMetaInfo}>
                  <Text style={styles.pageNameText} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.pageIdText}>Page ID: {p.pageId}</Text>
                  <View style={styles.pageBadgeRow}>
                    <View style={styles.statusBadge}>
                      <CheckCircle2 size={10} color="#4ADE80" />
                      <Text style={styles.statusBadgeText}>Connected</Text>
                    </View>
                    {(p.unreadConversations || 0) > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {p.unreadConversations} unread
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {pages.length > 1 && (
                  <TouchableOpacity
                    style={styles.deletePageBtn}
                    onPress={() => confirmDeletePage(p.id, p.name)}
                  >
                    <Trash2 size={16} color="#F87171" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </View>

      {/* 2. Audio Alert & Notifications Card */}
      <View style={styles.card}>
        <View style={styles.cardTitleGroup}>
          <Volume2 size={18} color="#A78BFA" />
          <Text style={styles.cardTitle}>Audio Alert & Notifications</Text>
        </View>
        <Text style={styles.cardDesc}>
          Chime sound and real-time push alerts when clients message your page.
        </Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Sound Type:</Text>
          <Text style={styles.settingValue}>High-Gain Harmonic Triad Bell</Text>
        </View>
      </View>

      {/* 3. Global Automation Settings */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleGroup}>
            <Bot size={18} color="#D4AF37" />
            <Text style={styles.cardTitle}>Global Auto-Reply Switch</Text>
          </View>
          <Switch
            value={settings?.globalAutoReply ?? true}
            onValueChange={(val) => handleUpdateGlobalAutoReply(val)}
            trackColor={{ false: '#555555', true: '#E6C259' }}
            thumbColor={settings?.globalAutoReply ? '#D4AF37' : '#121212'}
          />
        </View>
        <Text style={styles.cardDesc}>
          When turned off, no automated replies will be sent, regardless of individual rules.
        </Text>
      </View>

      {/* 4. Meta Graph API Connection */}
      <View style={styles.card}>
        <View style={styles.cardTitleGroup}>
          <ShieldCheck size={18} color="#D4AF37" />
          <Text style={styles.cardTitle}>Meta Graph API Connection</Text>
        </View>
        <Text style={styles.cardDesc}>
          Validates your Page Access Token against Meta's Graph API.
        </Text>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Connection Status:</Text>
          {settings?.facebookStatus?.connected ? (
            <View style={styles.badgeSuccess}>
              <CheckCircle2 size={12} color="#4ADE80" />
              <Text style={styles.badgeSuccessText}>Active & Verified</Text>
            </View>
          ) : (
            <View style={styles.badgeError}>
              <XCircle size={12} color="#F87171" />
              <Text style={styles.badgeErrorText}>Disconnected</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.actionBtnSecondary}
          onPress={handleVerify}
          disabled={verifying}
        >
          {verifying ? (
            <ActivityIndicator color="#F3F4F6" size="small" />
          ) : (
            <Text style={styles.actionBtnSecondaryText}>Test Connection</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 5. Webhook Integration & Page Subscription */}
      <View style={styles.card}>
        <View style={styles.cardTitleGroup}>
          <Globe size={18} color="#B5952F" />
          <Text style={styles.cardTitle}>Webhook Integration</Text>
        </View>
        <Text style={styles.cardDesc}>
          Ensure Facebook forwards all incoming Messenger messages in real-time.
        </Text>

        <View style={styles.urlBox}>
          <Text style={styles.urlBoxLabel}>Webhook Callback URL:</Text>
          <Text style={styles.urlBoxText} selectable>{webhookUrl}</Text>
        </View>
      </View>

      {/* 6. Facebook History Backfill */}
      <View style={styles.card}>
        <View style={styles.cardTitleGroup}>
          <RefreshCw size={18} color="#D4AF37" />
          <Text style={styles.cardTitle}>Facebook History Backfill</Text>
        </View>
        <Text style={styles.cardDesc}>
          Fetch existing conversations and prior message history from Facebook Graph API.
        </Text>

        <TouchableOpacity
          style={[styles.actionBtnPrimary, syncStatus?.inProgress && styles.btnDisabled]}
          onPress={() => handleTriggerSync()}
          disabled={syncStatus?.inProgress}
        >
          {syncStatus?.inProgress ? (
            <ActivityIndicator color="#1E1E1E" size="small" />
          ) : (
            <Text style={styles.actionBtnPrimaryText}>Sync History Now</Text>
          )}
        </TouchableOpacity>

        {syncStatus?.inProgress && (
          <View style={styles.syncProgressBox}>
            <Text style={styles.syncProgressText}>{syncStatus.message || 'Syncing...'}</Text>
            {syncStatus.total && syncStatus.synced !== undefined && (
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, Math.round((syncStatus.synced / syncStatus.total) * 100))}%` },
                  ]}
                />
              </View>
            )}
          </View>
        )}
      </View>

      <AddPageModal
        visible={isAddPageModalOpen}
        onClose={() => setIsAddPageModalOpen(false)}
        onPageAdded={() => {}}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 14,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#F3F4F6',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#333333',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F3F4F6',
    marginLeft: 8,
    flexShrink: 1,
  },
  cardDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
    lineHeight: 17,
  },
  addPageBtn: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  addPageBtnText: {
    color: '#1E1E1E',
    fontSize: 12,
    fontWeight: '600',
  },
  pagesList: {
    marginTop: 6,
    gap: 8,
  },
  emptyPageContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyPageText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  pageCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderColor: '#333333',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  pageAvatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
    overflow: 'hidden',
  },
  pageAvatarImg: {
    width: '100%',
    height: '100%',
  },
  pageAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2A2416',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageAvatarText: {
    color: '#D4AF37',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pageMetaInfo: {
    flex: 1,
    marginRight: 6,
  },
  pageNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F3F4F6',
  },
  pageIdText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  pageBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162C22',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4ADE80',
  },
  unreadBadge: {
    backgroundColor: '#2A2416',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D4AF37',
  },
  deletePageBtn: {
    padding: 6,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  settingValue: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  statusLabel: {
    fontSize: 13,
    color: '#D1D5DB',
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162C22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ADE80',
    marginLeft: 4,
  },
  badgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3F1D1D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F87171',
    marginLeft: 4,
  },
  urlBox: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 10,
  },
  urlBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  urlBoxText: {
    fontSize: 12,
    color: '#B5952F',
    fontWeight: '500',
  },
  actionBtnPrimary: {
    backgroundColor: '#D4AF37',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnPrimaryText: {
    color: '#1E1E1E',
    fontWeight: '600',
    fontSize: 13,
  },
  actionBtnSecondary: {
    backgroundColor: '#2A2A2A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnSecondaryText: {
    color: '#F3F4F6',
    fontWeight: '600',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  syncProgressBox: {
    marginTop: 12,
    backgroundColor: '#121212',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  syncProgressText: {
    fontSize: 12,
    color: '#F3F4F6',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D4AF37',
  },
});
