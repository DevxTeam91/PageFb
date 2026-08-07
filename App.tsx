import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalStateProvider } from './src/context/GlobalStateContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { NetworkObserver } from './src/services/NetworkObserver';
import { OfflineQueue } from './src/services/OfflineQueue';
import { ErrorBoundary } from './src/components/ErrorBoundary';

NetworkObserver.init();
OfflineQueue.startRetryTimer();

const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" animated={true} />
      <ErrorBoundary>
        <GlobalStateProvider>
          <AppNavigator />
        </GlobalStateProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
};

export default App;
