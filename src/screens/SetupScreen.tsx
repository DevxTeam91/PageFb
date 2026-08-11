import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { addPage } from '../services/api';
import {
  saveCredentials,
  savePageConfig,
  getOrCreateInstallationId,
} from '../services/SecureStorage';

interface SetupScreenProps {
  onSetupComplete: (pageDbId: string, fbPageId: string) => void;
}

type SetupStep = 'credentials' | 'select_page' | 'done';

interface PageOption {
  id: string;       // backend DB id
  pageId: string;   // Facebook page ID
  name: string;
  pictureUrl?: string;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onSetupComplete }) => {
  const [step, setStep] = useState<SetupStep>('credentials');
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [selectedPageDbId, setSelectedPageDbId] = useState<string | null>(null);

  // Step 1: Validate token + add page to backend
  const handleConnect = async () => {
    if (!appId.trim() || !appSecret.trim() || !pageAccessToken.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all three fields.');
      return;
    }

    setLoading(true);
    try {
      // Add page to backend — backend validates token & returns page info
      const result = await addPage(pageAccessToken.trim(), undefined, undefined, appId.trim(), appSecret.trim());

      const newPage: PageOption = {
        id: result.page.id,
        pageId: result.page.pageId,
        name: result.page.name || 'My Page',
        pictureUrl: result.page.pictureUrl,
      };

      setPages([newPage]);
      setSelectedPageDbId(newPage.id);
      setStep('select_page');
    } catch (err: any) {
      Alert.alert(
        'Connection Failed',
        err.message || 'Could not connect. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: User selects their page → save config
  const handleConfirmPage = async () => {
    if (!selectedPageDbId) return;
    const page = pages.find(p => p.id === selectedPageDbId);
    if (!page) return;

    setLoading(true);
    try {
      const installationId = await getOrCreateInstallationId();

      // Save sensitive credentials to Keychain
      await saveCredentials({
        appId: appId.trim(),
        appSecret: appSecret.trim(),
        pageAccessToken: pageAccessToken.trim(),
      });

      // Save non-sensitive config to AsyncStorage
      await savePageConfig({
        pageId: page.pageId,
        pageDbId: page.id,
        pageName: page.name,
        appId: appId.trim(),
        installationId,
      });

      console.log(`[Installation] id=${installationId} configured pageId=${page.pageId}`);

      onSetupComplete(page.id, page.pageId);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save configuration.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'select_page') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrapper}>
            <Text style={styles.icon}>📄</Text>
          </View>
          <Text style={styles.title}>Select Your Page</Text>
          <Text style={styles.subtitle}>
            This phone will be locked to the selected page only.
          </Text>

          <View style={styles.card}>
            {pages.map(page => (
              <TouchableOpacity
                key={page.id}
                style={[
                  styles.pageOption,
                  selectedPageDbId === page.id && styles.pageOptionSelected,
                ]}
                onPress={() => setSelectedPageDbId(page.id)}
                activeOpacity={0.8}
              >
                <View style={styles.pageOptionRadio}>
                  {selectedPageDbId === page.id && <View style={styles.pageOptionRadioDot} />}
                </View>
                <View style={styles.pageOptionInfo}>
                  <Text style={styles.pageOptionName}>{page.name}</Text>
                  <Text style={styles.pageOptionId}>Page ID: {page.pageId}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, (!selectedPageDbId || loading) && styles.buttonDisabled]}
            onPress={handleConfirmPage}
            disabled={!selectedPageDbId || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.buttonText}>Continue →</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Step 1: Credentials
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrapper}>
          <Text style={styles.icon}>🔐</Text>
        </View>

        <Text style={styles.title}>Facebook Page Setup</Text>
        <Text style={styles.subtitle}>
          Connect your Facebook Page. Each phone is isolated to one page only.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>App ID</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Facebook App ID..."
            placeholderTextColor="#64748b"
            value={appId}
            onChangeText={setAppId}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numeric"
          />

          <Text style={styles.label}>App Secret</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Facebook App Secret..."
            placeholderTextColor="#64748b"
            value={appSecret}
            onChangeText={setAppSecret}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <Text style={styles.label}>Page Access Token</Text>
          <TextInput
            style={[styles.input, { minHeight: 90 }]}
            placeholder="Paste your permanent Page Access Token..."
            placeholderTextColor="#64748b"
            value={pageAccessToken}
            onChangeText={setPageAccessToken}
            multiline
            numberOfLines={3}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.hint}>
            Get these from developers.facebook.com → Your App → Settings / Graph API Explorer
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, (!(appId && appSecret && pageAccessToken) || loading) && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={!(appId.trim() && appSecret.trim() && pageAccessToken.trim()) || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.buttonText}>Connect Facebook →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  iconWrapper: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  icon: { fontSize: 36 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 28,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D4AF37',
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    color: '#f8fafc',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 11,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    marginTop: 10,
  },
  button: {
    backgroundColor: '#D4AF37',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  // Page selection
  pageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 10,
    backgroundColor: '#0a0a0a',
  },
  pageOptionSelected: {
    borderColor: '#D4AF37',
    backgroundColor: '#1a1500',
  },
  pageOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D4AF37',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageOptionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D4AF37',
  },
  pageOptionInfo: { flex: 1 },
  pageOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 2,
  },
  pageOptionId: {
    fontSize: 11,
    color: '#64748b',
  },
});
