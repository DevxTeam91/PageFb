import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore
import { API_URL, SOCKET_URL } from '@env';

class NetworkManager {
  private activeBaseUrl: string | null = null;
  private readonly STORAGE_KEY = '@app_base_url';
  private abortControllers: Map<string, AbortController> = new Map();
  
  // Offline caching to prevent health check spam
  private offlineUntil: number = 0;

  async getBaseUrl(): Promise<string> {
    if (this.activeBaseUrl) return this.activeBaseUrl;

    if (Date.now() < this.offlineUntil) {
      throw new Error('Network is currently in offline cooldown mode.');
    }

    const cached = await AsyncStorage.getItem(this.STORAGE_KEY);
    if (cached) {
      if (await this.healthCheck(cached)) {
        this.activeBaseUrl = cached;
        this.offlineUntil = 0;
        return cached;
      }
    }

    const candidates = this.getCandidates();
    for (const url of candidates) {
      if (await this.healthCheck(url)) {
        this.activeBaseUrl = url;
        this.offlineUntil = 0;
        await AsyncStorage.setItem(this.STORAGE_KEY, url);
        return url;
      }
    }

    // Cache offline state for 15 seconds to prevent spam
    this.offlineUntil = Date.now() + 15000;
    throw new Error('No reachable backend endpoints found. Are you connected to the network?');
  }

  forceReconnect() {
    this.offlineUntil = 0;
    this.activeBaseUrl = null;
  }

  getSocketUrl(): string | null {
    if (SOCKET_URL) return SOCKET_URL;
    if (this.activeBaseUrl) return this.activeBaseUrl.replace(/\/api\/?$/, '');
    return 'https://chs-business-suit-production-76d3.up.railway.app';
  }

  private getCandidates(): string[] {
    const candidates: string[] = [];
    if (API_URL) candidates.push(API_URL);

    let scriptHost = '';
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    
    if (scriptURL) {
      try {
        const urlObj = new URL(scriptURL);
        scriptHost = urlObj.hostname;
        const inferredUrl = `http://${scriptHost}:3000/api`;
        if (!candidates.includes(inferredUrl)) {
          candidates.push(inferredUrl);
        }
      } catch (err) {
        console.warn('[NetworkManager] Failed to parse scriptURL:', scriptURL);
      }
    }

    const fallbacks = [
      'https://chs-business-suit-production-76d3.up.railway.app/api', // Production fallback
      'http://10.0.2.2:3000/api', // Emulator
      'http://127.0.0.1:3000/api', // ADB Reverse
      'http://localhost:3000/api'
    ];

    for (const fallback of fallbacks) {
      if (!candidates.includes(fallback)) {
        candidates.push(fallback);
      }
    }

    return candidates;
  }

  private async healthCheck(baseUrl: string): Promise<boolean> {
    const healthUrl = `${baseUrl.replace(/\/api\/?$/, '')}/health`;
    console.log(`[NetworkManager] Probing health endpoint: ${healthUrl}`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      console.warn(`[NetworkManager] Health probe failed for ${healthUrl}`);
      return false;
    }
  }

  async fetchWithRetry(endpointPath: string, options: RequestInit = {}, maxRetries = 2): Promise<Response> {
    const method = options.method || 'GET';
    const requestId = `${method}:${endpointPath}`;

    // Deduplication / Cancellation (Only for idempotent GET requests)
    if (method === 'GET') {
      if (this.abortControllers.has(requestId)) {
        this.abortControllers.get(requestId)?.abort();
      }
      const controller = new AbortController();
      this.abortControllers.set(requestId, controller);
    }
    
    const controller = method === 'GET' ? this.abortControllers.get(requestId)! : new AbortController();

    let base;
    try {
      base = await this.getBaseUrl();
    } catch (err) {
      this.abortControllers.delete(requestId);
      throw err;
    }

    const url = `${base}${endpointPath.startsWith('/') ? '' : '/'}${endpointPath}`;

    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[DEBUG] NetworkManager.fetchWithRetry [Attempt ${attempt + 1}] ${method} ${url}`);
        
        // Timeout wrapper
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        const config = { ...options, signal: controller.signal };
        
        const res = await fetch(url, config);
        clearTimeout(timeoutId);
        
        console.log(`[DEBUG] NetworkManager.fetchWithRetry [Success] ${method} ${url} -> Status: ${res.status}`);
        this.abortControllers.delete(requestId);
        return res;
      } catch (err: any) {
        lastError = err;
        if (err.name !== 'AbortError') {
          console.log(`[DEBUG] NetworkManager.fetchWithRetry [Failed] ${method} ${url} -> ${err.name || err.message}`, err.stack);
        } else {
          console.log(`[DEBUG] NetworkManager.fetchWithRetry [Aborted] ${method} ${url} (Deduplicated/Timeout)`);
        }
        
        if (err.name === 'AbortError') {
          // Return a safe mock response to suppress unhandled promise rejections
          if (method === 'GET') this.abortControllers.delete(requestId);
          return new Response(JSON.stringify({ error: 'Request aborted' }), {
            status: 499,
            statusText: 'Client Closed Request',
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        } else {
          // If we exhaust retries, invalidate base URL cache for next time
          this.activeBaseUrl = null;
          AsyncStorage.removeItem(this.STORAGE_KEY).catch(() => {});
        }
      }
    }

    this.abortControllers.delete(requestId);
    throw lastError || new TypeError('Network request failed');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getBaseUrl();
      return true;
    } catch {
      return false;
    }
  }
}

export const networkManager = new NetworkManager();
