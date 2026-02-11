// apps/mobile-app/src/app/_layout.tsx
import * as Sentry from '@sentry/react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import '../../global.css'
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    debug: __DEV__,
  });
}
// 1. Import font hooks and specific weights
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  DMSerifDisplay_400Regular
} from '@expo-google-fonts/dm-serif-display';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlaybackProvider } from '@/contexts/PlaybackContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { MiniPlayer } from '@/components/MiniPlayer';

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const colorScheme = useColorScheme();

  // 2. Load the fonts
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    DMSerifDisplay_400Regular,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AlertProvider>
      <AuthProvider>
        <NotificationsProvider>
          <PlaybackProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <View style={{ flex: 1 }}>
                <Stack>
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="podcasts" options={{ headerShown: false }} />
                  <Stack.Screen name="episodes" options={{ headerShown: false }} />
                  <Stack.Screen name="feed" options={{ headerShown: false }} />
                  <Stack.Screen name="notifications" options={{ headerShown: false }} />
                  <Stack.Screen name="search" options={{ headerShown: false }} />
                  <Stack.Screen name="subscription" options={{ headerShown: false }} />
                  <Stack.Screen name="legal" options={{ headerShown: false }} />
                  <Stack.Screen name="[book]" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <MiniPlayer />
              </View>
              <StatusBar style="auto" />
            </ThemeProvider>
          </PlaybackProvider>
        </NotificationsProvider>
      </AuthProvider>
      </AlertProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);