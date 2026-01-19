// apps/mobile-app/src/app/(tabs)/_layout.tsx
import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { Platform, ActivityIndicator, View, Image } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

// Import custom icons
const icons = {
  home: require('@/assets/icons/home.png'),
  homeFilled: require('@/assets/icons/home_filled.png'),
  episodes: require('@/assets/icons/episodes.png'),
  episodesFilled: require('@/assets/icons/episodes_filled.png'),
  podcasts: require('@/assets/icons/podcasts_filled.png'),
  podcastsFilled: require('@/assets/icons/podcast_filled.png'),
  profile: require('@/assets/icons/profile.png'),
  profileFilled: require('@/assets/icons/profile_filled.png'),
  microphone: require('@/assets/icons/microphone.png'),
};

type TabIconProps = {
  focused: boolean;
  icon: any;
  iconFilled: any;
};

function TabIcon({ focused, icon, iconFilled }: TabIconProps) {
  return (
    <Image
      source={focused ? iconFilled : icon}
      style={{
        width: 24,
        height: 24,
        tintColor: focused ? '#1F1F1F' : '#858585',
      }}
      resizeMode="contain"
    />
  );
}

export default function TabLayout() {
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
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#1F1F1F',
        tabBarInactiveTintColor: '#858585',
        tabBarStyle: {
          backgroundColor: '#F5F5F0',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingTop: 10,
          ...Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.home} iconFilled={icons.homeFilled} />
          ),
        }}
      />
      <Tabs.Screen
        name="episode"
        options={{
          title: 'Episodes',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.microphone} iconFilled={icons.microphone} />
          ),
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: 'Studio',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.podcasts} iconFilled={icons.podcastsFilled} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.profile} iconFilled={icons.profileFilled} />
          ),
        }}
      />
    </Tabs>
  );
}
