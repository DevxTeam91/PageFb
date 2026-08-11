import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Inbox, Settings, KeySquare } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { NotificationsManager } from '../services/NotificationsManager';
import { useGlobalState } from '../context/GlobalStateContext';
import { loadPageConfig } from '../services/SecureStorage';
import { setActivePageContext } from '../services/socket';

// Screens
import { InboxScreen } from '../screens/InboxScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { RulesScreen } from '../screens/RulesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SetupScreen } from '../screens/SetupScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const InboxStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="InboxList" component={InboxScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat', tabBarStyle: { display: 'none' } }} />
    </Stack.Navigator>
  );
};

export const AppNavigator = () => {
  const navigationRef = createNavigationContainerRef();
  const { setSelectedConversationId, setSelectedPageId, loadConversations } = useGlobalState();
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupDone, setIsSetupDone] = useState(false);

  useEffect(() => {
    // Load installation config from SecureStorage + AsyncStorage
    loadPageConfig().then((config) => {
      if (config?.pageDbId) {
        console.log(`[Installation] Restoring page config: pageDbId=${config.pageDbId} fbPageId=${config.pageId}`);
        setSelectedPageId(config.pageDbId);
        // Tell socket to register in page room
        setActivePageContext(config.pageDbId, config.pageId);
        setIsSetupDone(true);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!isSetupDone) return;
    NotificationsManager.init((conversationId) => {
      setSelectedConversationId(conversationId);
      if (navigationRef.isReady()) {
        // @ts-ignore
        navigationRef.navigate('Inbox', { screen: 'Chat' });
      }
    });
  }, [isSetupDone, setSelectedConversationId]);

  // Called by SetupScreen after user configures their page
  const handleSetupComplete = async (pageDbId: string, fbPageId: string) => {
    setSelectedPageId(pageDbId);
    setActivePageContext(pageDbId, fbPageId);
    await loadConversations();
    setIsSetupDone(true);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </View>
    );
  }

  if (!isSetupDone) {
    return <SetupScreen onSetupComplete={handleSetupComplete} />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={DarkTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Inbox') return <Inbox color={color} size={size} />;
            if (route.name === 'Rules') return <KeySquare color={color} size={size} />;
            if (route.name === 'Settings') return <Settings color={color} size={size} />;
            return null;
          },
          tabBarActiveTintColor: '#D4AF37',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarStyle: {
            backgroundColor: '#1E1E1E',
            borderTopColor: '#333333',
          },
        })}
      >
        <Tab.Screen name="Inbox" component={InboxStack} />
        <Tab.Screen name="Rules" component={RulesScreen} options={{ headerShown: true, title: 'Auto-Reply Rules' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
