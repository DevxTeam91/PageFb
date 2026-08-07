import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { reconnectSocket, disconnectSocket, isSocketConnected } from './socket';

type NetworkListener = (isConnected: boolean) => void;

class NetworkObserverService {
  private isConnected: boolean = true;
  private unsubscribeNetInfo: NetInfoSubscription | null = null;
  private listeners: Set<NetworkListener> = new Set();
  
  // Exponential backoff configuration
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30000; // 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;

  init() {
    if (this.unsubscribeNetInfo) return; // Prevent duplicate initialization

    this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
      this.handleNetworkChange(state);
    });
    
    // Initial fetch
    NetInfo.fetch().then(state => this.handleNetworkChange(state));
  }

  private handleNetworkChange(state: NetInfoState) {
    const wasConnected = this.isConnected;
    this.isConnected = !!(state.isConnected && state.isInternetReachable !== false);

    console.log(`[NetworkObserver] Connection state changed: ${this.isConnected ? 'ONLINE' : 'OFFLINE'} (Type: ${state.type})`);

    this.notifyListeners();

    if (this.isConnected && !wasConnected) {
      this.triggerExponentialReconnect();
    } else if (!this.isConnected) {
      this.stopReconnectTimer();
      // Optionally disconnect socket to save battery if we know we are offline
      if (isSocketConnected()) {
        disconnectSocket();
      }
    }
  }

  private triggerExponentialReconnect() {
    if (isSocketConnected()) {
      console.log('[NetworkObserver] Socket already connected. Skipping reconnect.');
      this.reconnectAttempt = 0;
      return;
    }

    if (this.reconnectTimer) {
      console.log('[NetworkObserver] Reconnect already in progress.');
      return;
    }

    // Calculate delay: 1s, 2s, 4s, 8s, 16s, 30s max
    let delay = Math.pow(2, this.reconnectAttempt) * 1000;
    if (delay > this.maxReconnectDelay) {
      delay = this.maxReconnectDelay;
    }

    console.log(`[NetworkObserver] Attempting socket reconnect in ${delay}ms (Attempt ${this.reconnectAttempt + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      
      if (!this.isConnected) {
        console.log('[NetworkObserver] Aborting reconnect because network went offline.');
        return;
      }

      console.log('[NetworkObserver] Executing reconnect...');
      reconnectSocket();
      
      // We rely on socket.ts to emit events when connected.
      // If it fails to connect, socket.ts or GlobalStateContext will trigger another reconnect,
      // or we can increment attempt here if we track connection failure.
      // For now, we increment attempt in case the caller decides to call trigger again.
      this.reconnectAttempt++;
      
    }, delay);
  }

  resetBackoff() {
    this.reconnectAttempt = 0;
    this.stopReconnectTimer();
  }

  private stopReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  subscribe(listener: NetworkListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isConnected));
  }

  isOnline() {
    return this.isConnected;
  }
}

export const NetworkObserver = new NetworkObserverService();
