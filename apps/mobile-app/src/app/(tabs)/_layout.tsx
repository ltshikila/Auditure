// apps/mobile-app/src/app/(tabs)/_layout.tsx
import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';

// Import custom icons
const icons = {
  home: require('@/assets/icons/home.png'),
  homeFilled: require('@/assets/icons/home_filled.png'),
  episodes: require('@/assets/icons/episodes.png'),
  episodesFilled: require('@/assets/icons/episodes_filled.png'),
  podcasts: require('@/assets/icons/podcast.png'),
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
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 50, height: 65 }}>
      <Image
        source={focused ? iconFilled : icon}
        style={{
          width: 34,
          height: 34,
          tintColor: focused ? '#2F2F2F' : '#848282',
        }}
        resizeMode="contain"
      />
      {/* Red dot indicator for active tab */}
      {focused && (
        <View
          style={{
            position: 'absolute',
            bottom: 2,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: '#FF4A4A',
          }}
        />
      )}
    </View>
  );
}

export default function TabLayout() {
  const { isAuthenticated, loading } = useAuth();
  const insets = useSafeAreaInsets();

  // Base tab bar height + bottom safe area inset (handles both gesture nav and 3-button nav)
  const tabBarHeight = 72 + insets.bottom;

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
          backgroundColor: '#FBF8F2',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: tabBarHeight,
          paddingTop: 15,
          paddingBottom: insets.bottom,
          paddingHorizontal: 16,
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
            <TabIcon focused={focused} icon={icons.episodes} iconFilled={icons.episodesFilled} />
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
