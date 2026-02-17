import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Image } from 'react-native';
import { useState, useEffect } from 'react';
import { storageService } from '@/services/storage.service';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      const seen = await storageService.getHasSeenOnboarding();
      setHasSeenOnboarding(seen);
    };
    checkOnboarding();
  }, []);

  if (loading || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F0' }}>
        <Image
          source={require('../assets/icons/logo_1_hd.png')}
          style={{ width: 160, height: 160 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />;
  }

  if (!hasSeenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(auth)/Auth" />;
}
