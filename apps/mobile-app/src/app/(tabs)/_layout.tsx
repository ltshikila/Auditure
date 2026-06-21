// apps/mobile-app/src/app/(tabs)/_layout.tsx
import { Tabs, Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View, Image, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/use-colors';

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
  const colors = useColors();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 44, height: 55 }}>
      <Image
        source={focused ? iconFilled : icon}
        style={{
          width: 29,
          height: 29,
          tintColor: focused ? colors.tabIconSelected : colors.tabIconDefault,
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

// Custom tab button: no Android ripple "circle", just a subtle icon dim on press.
// Spread the navigator's props (incl. its layout `style`) so each tab keeps its
// even flex sizing; only override the ripple and add a press-dim.
function TabBarButton({ style, ...props }: any) {
  return (
    <Pressable
      {...props}
      android_ripple={null}
      style={({ pressed }) => [
        style,
        { justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.5 : 1 },
      ]}
    />
  );
}

export default function TabLayout() {
  const { isAuthenticated, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = useColors();

  // Base tab bar height (85% of original 72) + bottom safe area inset
  const tabBarHeight = 61 + insets.bottom;

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
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: tabBarHeight,
          paddingTop: 12,
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
