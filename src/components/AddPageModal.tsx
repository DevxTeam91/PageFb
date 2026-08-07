import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus, Key, Globe, ShieldCheck } from 'lucide-react-native';
import { PageData } from '../types';
import { addPage } from '../services/api';

interface AddPageModalProps {
  visible: boolean;
  onClose: () => void;
  onPageAdded: (page: PageData) => void;
}

export const AddPageModal: React.FC<AddPageModalProps> = ({ visible, onClose, onPageAdded }) => {
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!token.trim()) {
      setError('Please provide a Facebook User or Page Access Token');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await addPage(token.trim(), name.trim() || undefined);
      if (res.success && res.page) {
        onPageAdded(res.page);
        onClose();
        setToken('');
        setName('');
      } else {
        throw new Error('Failed to connect Facebook Page');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting page');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconBadge}>
                <Plus size={20} color="#D4AF37" />
              </View>
              <View style={styles.titleTextContainer}>
                <Text style={styles.title} numberOfLines={1}>Add Facebook Page</Text>
                <Text style={styles.subtitle} numberOfLines={1}>Connect & manage additional page</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Error Banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Form */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                <Globe size={14} color="#9CA3AF" /> Page Name (Optional)
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. My Second Brand"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                <Key size={14} color="#9CA3AF" /> Access Token *
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Paste token from Graph API Explorer"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={token}
                onChangeText={setToken}
              />
              <Text style={styles.helpText}>
                <ShieldCheck size={12} color="#4ADE80" /> Short-lived tokens auto-convert to lifetime tokens.
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.submitBtn, loading && styles.disabledBtn]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#1E1E1E" size="small" />
                ) : (
                  <>
                    <Plus size={18} color="#1E1E1E" style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>Connect Page</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A2416',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F3F4F6',
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#121212',
    borderColor: '#333333',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#F3F4F6',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 11,
    color: '#4ADE80',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#2A2A2A',
  },
  cancelBtnText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#D4AF37',
  },
  submitBtnText: {
    color: '#1E1E1E',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
