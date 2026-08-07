import * as Keychain from 'react-native-keychain';

export class SecureStore {
  static async setToken(key: string, value: string): Promise<void> {
    await Keychain.setInternetCredentials(
      key, // server / key
      key, // username
      value // password/token
    );
  }

  static async getToken(key: string): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(key);
      if (credentials) {
        return credentials.password;
      }
      return null;
    } catch (e) {
      console.error('[SecureStore] Failed to retrieve token:', e);
      return null;
    }
  }

  static async removeToken(key: string): Promise<void> {
    await Keychain.resetInternetCredentials(key);
  }
}
