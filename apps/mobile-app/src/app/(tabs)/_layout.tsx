// apps/mobile-app/src/app/(tabs)/_layout.tsx
import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Platform, ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/Auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="home" 
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="episode"
        options={{
          title: 'Episode',
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: 'Studio',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}