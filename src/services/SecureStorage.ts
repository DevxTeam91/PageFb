/**
 * SecureStorage — wraps react-native-keychain for sensitive credentials.
 *
 * Sensitive (stored in Keychain / Android Keystore):
 *   - pageAccessToken
 *   - appSecret
 *
 * Non-sensitive (stored in AsyncStorage):
 *   - pageId, pageName, appId, installationId
 */

import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEYCHAIN_SERVICE = 'com.fbpageinbox.credentials';
const ASYNC_KEY_PAGE_ID = '@my_page_id';
const ASYNC_KEY_PAGE_NAME = '@my_page_name';
const ASYNC_KEY_APP_ID = '@my_app_id';
const ASYNC_KEY_INSTALLATION_ID = '@installation_id';

export interface InstallationConfig {
  pageId: string;         // Facebook Page ID (e.g. "752790171249695")
  pageDbId: string;       // Backend DB record id
  pageName: string;
  appId: string;
  installationId: string;
  // appSecret and pageAccessToken are stored in Keychain only
}

/**
 * Save sensitive credentials to Keychain.
 * username = appId, password = JSON of { appSecret, pageAccessToken }
 */
export async function saveCredentials(params: {
  appId: string;
  appSecret: string;
  pageAccessToken: string;
}): Promise<void> {
  const payload = JSON.stringify({
    appSecret: params.appSecret,
    pageAccessToken: params.pageAccessToken,
  });

  await Keychain.setGenericPassword(params.appId, payload, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Load credentials from Keychain.
 */
export async function loadCredentials(): Promise<{
  appId: string;
  appSecret: string;
  pageAccessToken: string;
} | null> {
  try {
    const result = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!result) return null;

    const parsed = JSON.parse(result.password);
    return {
      appId: result.username,
      appSecret: parsed.appSecret || '',
      pageAccessToken: parsed.pageAccessToken || '',
    };
  } catch {
    return null;
  }
}

/**
 * Save non-sensitive page config to AsyncStorage.
 */
export async function savePageConfig(params: {
  pageId: string;
  pageDbId: string;
  pageName: string;
  appId: string;
  installationId: string;
}): Promise<void> {
  await AsyncStorage.multiSet([
    [ASYNC_KEY_PAGE_ID, params.pageDbId],    // backend DB id used for API filtering
    [ASYNC_KEY_PAGE_NAME, params.pageName],
    [ASYNC_KEY_APP_ID, params.appId],
    [ASYNC_KEY_INSTALLATION_ID, params.installationId],
    ['@my_fb_page_id', params.pageId],       // raw Facebook page ID
  ]);
}

/**
 * Load non-sensitive page config from AsyncStorage.
 */
export async function loadPageConfig(): Promise<InstallationConfig | null> {
  const results = await AsyncStorage.multiGet([
    ASYNC_KEY_PAGE_ID,
    ASYNC_KEY_PAGE_NAME,
    ASYNC_KEY_APP_ID,
    ASYNC_KEY_INSTALLATION_ID,
    '@my_fb_page_id',
  ]);

  const map = Object.fromEntries(results.map(([k, v]) => [k, v]));

  const pageDbId = map[ASYNC_KEY_PAGE_ID];
  if (!pageDbId) return null;

  return {
    pageId: map['@my_fb_page_id'] || '',
    pageDbId,
    pageName: map[ASYNC_KEY_PAGE_NAME] || 'My Page',
    appId: map[ASYNC_KEY_APP_ID] || '',
    installationId: map[ASYNC_KEY_INSTALLATION_ID] || '',
  };
}

/**
 * Clear all credentials — used on "Change Page" / Disconnect.
 */
export async function clearAllCredentials(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
  await AsyncStorage.multiRemove([
    ASYNC_KEY_PAGE_ID,
    ASYNC_KEY_PAGE_NAME,
    ASYNC_KEY_APP_ID,
    ASYNC_KEY_INSTALLATION_ID,
    '@my_fb_page_id',
    '@my_page_id',     // legacy key from earlier SetupScreen
    '@my_page_name',   // legacy key
  ]);
}

/**
 * Get or generate a persistent installation UUID.
 */
export async function getOrCreateInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(ASYNC_KEY_INSTALLATION_ID);
  if (existing) return existing;

  // Generate a simple UUID v4
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  await AsyncStorage.setItem(ASYNC_KEY_INSTALLATION_ID, uuid);
  return uuid;
}
