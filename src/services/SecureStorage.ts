/**
 * SecureStorage — credential storage for per-installation page config.
 * Uses individual AsyncStorage calls (multiSet/multiGet not available in v2.x)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PAGE_DB_ID    = '@my_page_id';
const KEY_PAGE_NAME     = '@my_page_name';
const KEY_APP_ID        = '@my_app_id';
const KEY_FB_PAGE_ID    = '@my_fb_page_id';
const KEY_INSTALLATION  = '@installation_id';
const KEY_APP_SECRET    = '@page_app_secret';
const KEY_PAGE_TOKEN    = '@page_access_token';

export interface InstallationConfig {
  pageId: string;       // Facebook Page ID (e.g. "752790171249695")
  pageDbId: string;     // Backend DB record id
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
  await AsyncStorage.setItem(KEY_APP_ID, params.appId);
  await AsyncStorage.setItem(KEY_APP_SECRET, params.appSecret);
  await AsyncStorage.setItem(KEY_PAGE_TOKEN, params.pageAccessToken);
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
    if (!appId) return null;
    const appSecret      = await AsyncStorage.getItem(KEY_APP_SECRET)      || '';
    const pageAccessToken = await AsyncStorage.getItem(KEY_PAGE_TOKEN)     || '';
    return { appId, appSecret, pageAccessToken };
  } catch {
    return null;
  }
}

/**
 * Save non-sensitive page config using individual setItem calls.
 */
export async function savePageConfig(params: {
  pageId: string;
  pageDbId: string;
  pageName: string;
  appId: string;
  installationId: string;
}): Promise<void> {
  await AsyncStorage.setItem(KEY_PAGE_DB_ID,   params.pageDbId);
  await AsyncStorage.setItem(KEY_PAGE_NAME,    params.pageName);
  await AsyncStorage.setItem(KEY_APP_ID,       params.appId);
  await AsyncStorage.setItem(KEY_INSTALLATION, params.installationId);
  await AsyncStorage.setItem(KEY_FB_PAGE_ID,   params.pageId);
}

/**
 * Load page config using individual getItem calls.
 */
export async function loadPageConfig(): Promise<InstallationConfig | null> {
  const pageDbId       = await AsyncStorage.getItem(KEY_PAGE_DB_ID);
  if (!pageDbId) return null;

  const pageName       = await AsyncStorage.getItem(KEY_PAGE_NAME)    || 'My Page';
  const appId          = await AsyncStorage.getItem(KEY_APP_ID)       || '';
  const installationId = await AsyncStorage.getItem(KEY_INSTALLATION) || '';
  const pageId         = await AsyncStorage.getItem(KEY_FB_PAGE_ID)   || '';

  return { pageId, pageDbId, pageName, appId, installationId };
}

/**
 * Clear all stored credentials and config.
 */
export async function clearAllCredentials(): Promise<void> {
  const keys = [
    KEY_PAGE_DB_ID, KEY_PAGE_NAME, KEY_APP_ID,
    KEY_INSTALLATION, KEY_FB_PAGE_ID,
    KEY_APP_SECRET, KEY_PAGE_TOKEN,
    '@my_page_id', '@my_page_name', // legacy keys
  ];
  for (const key of keys) {
    await AsyncStorage.removeItem(key);
  }
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
