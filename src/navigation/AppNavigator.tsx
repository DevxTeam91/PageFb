import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Inbox, Settings, KeySquare } from 'lucide-react-native';
import { NotificationsManager } from '../services/NotificationsManager';
import { useGlobalState } from '../context/GlobalStateContext';

// Screens
import { InboxScreen } from '../screens/InboxScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { RulesScreen } from '../screens/RulesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const InboxStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen 
        name="InboxList" 
        component={InboxScreen} 
        options={{ title: 'Messages' }} 
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ title: 'Chat', tabBarStyle: { display: 'none' } }} 
      />
    </Stack.Navigator>
  );
};

export const AppNavigator = () => {
  const navigationRef = createNavigationContainerRef();
  const { setSelectedConversationId } = useGlobalState();

  useEffect(() => {
    // Only initialize notifications once the navigation container is ready
    NotificationsManager.init((conversationId) => {
      setSelectedConversationId(conversationId);
      if (navigationRef.isReady()) {
        // @ts-ignore - dynamic routing cast
        navigationRef.navigate('Inbox', { 
          screen: 'Chat',
        });
      }
    });
  }, [setSelectedConversationId]);

  return (
    <NavigationContainer ref={navigationRef} theme={DarkTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false, // The stack/screen handles its own header
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Inbox') return <Inbox color={color} size={size} />;
            if (route.name === 'Rules') return <KeySquare color={color} size={size} />;
            if (route.name === 'Settings') return <Settings color={color} size={size} />;
            return null;
          },
          tabBarActiveTintColor: '#D4AF37', // Gold
          tabBarInactiveTintColor: '#94a3b8',
          tabBarStyle: {
            backgroundColor: '#1E1E1E',
            borderTopColor: '#333333', // border-subtle
          },
        })}
      >
        <Tab.Screen name="Inbox" component={InboxStack} />
        <Tab.Screen 
          name="Rules" 
          component={RulesScreen} 
          options={{ headerShown: true, title: 'Auto-Reply Rules' }}
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ headerShown: true, title: 'Settings' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
