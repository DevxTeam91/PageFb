/**
 * SecureStorage — credential storage for per-installation page config.
 *
 * For simplicity (personal/private app), credentials are stored in AsyncStorage.
 * Sensitive fields (appSecret, pageAccessToken) are kept separate from UI state.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PAGE_DB_ID    = '@my_page_id';
const KEY_PAGE_NAME     = '@my_page_name';
const KEY_APP_ID        = '@my_app_id';
const KEY_FB_PAGE_ID    = '@my_fb_page_id';
const KEY_INSTALLATION  = '@installation_id';
const KEY_CREDENTIALS   = '@page_credentials'; // JSON: { appSecret, pageAccessToken }

export interface InstallationConfig {
  pageId: string;     // Facebook Page ID (e.g. "752790171249695")
  pageDbId: string;   // Backend DB record id
  pageName: string;
  appId: string;
  installationId: string;
}

/**
 * Save sensitive credentials.
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
  await AsyncStorage.setItem(KEY_CREDENTIALS, payload);
}

/**
 * Load credentials.
 */
export async function loadCredentials(): Promise<{
  appId: string;
  appSecret: string;
  pageAccessToken: string;
} | null> {
  try {
    const appId = await AsyncStorage.getItem(KEY_APP_ID);
    const raw = await AsyncStorage.getItem(KEY_CREDENTIALS);
    if (!raw || !appId) return null;
    const parsed = JSON.parse(raw);
    return {
      appId,
      appSecret: parsed.appSecret || '',
      pageAccessToken: parsed.pageAccessToken || '',
    };
  } catch {
    return null;
  }
}

/**
 * Save non-sensitive page config.
 */
export async function savePageConfig(params: {
  pageId: string;
  pageDbId: string;
  pageName: string;
  appId: string;
  installationId: string;
}): Promise<void> {
  await AsyncStorage.multiSet([
    [KEY_PAGE_DB_ID,   params.pageDbId],
    [KEY_PAGE_NAME,    params.pageName],
    [KEY_APP_ID,       params.appId],
    [KEY_INSTALLATION, params.installationId],
    [KEY_FB_PAGE_ID,   params.pageId],
  ]);
}

/**
 * Load page config.
 */
export async function loadPageConfig(): Promise<InstallationConfig | null> {
  const results = await AsyncStorage.multiGet([
    KEY_PAGE_DB_ID,
    KEY_PAGE_NAME,
    KEY_APP_ID,
    KEY_INSTALLATION,
    KEY_FB_PAGE_ID,
  ]);

  const map: Record<string, string | null> = {};
  results.forEach(([k, v]) => { map[k] = v; });

  const pageDbId = map[KEY_PAGE_DB_ID];
  if (!pageDbId) return null;

  return {
    pageId:         map[KEY_FB_PAGE_ID]   || '',
    pageDbId,
    pageName:       map[KEY_PAGE_NAME]    || 'My Page',
    appId:          map[KEY_APP_ID]       || '',
    installationId: map[KEY_INSTALLATION] || '',
  };
}

/**
 * Clear all stored credentials and config.
 */
export async function clearAllCredentials(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEY_PAGE_DB_ID,
    KEY_PAGE_NAME,
    KEY_APP_ID,
    KEY_INSTALLATION,
    KEY_FB_PAGE_ID,
    KEY_CREDENTIALS,
    '@my_page_id',    // legacy
    '@my_page_name',  // legacy
  ]);
}

/**
 * Get or generate a persistent installation UUID.
 */
export async function getOrCreateInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY_INSTALLATION);
  if (existing) return existing;

  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  await AsyncStorage.setItem(KEY_INSTALLATION, uuid);
  return uuid;
}
