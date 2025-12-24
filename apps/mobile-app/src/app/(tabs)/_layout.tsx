// apps/mobile-app/src/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Platform } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

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