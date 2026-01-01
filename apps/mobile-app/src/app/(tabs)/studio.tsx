import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { podcasterService, Podcaster } from '@/services/podcaster.service';
import { storageService } from '@/services/storage.service';

export default function Studio() {
  const [podcasters, setPodcasters] = useState<Podcaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPodcasters = async (isRefreshing: boolean = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const token = await storageService.getAccessToken();
      if (!token) {
        router.replace('/(auth)/Auth');
        return;
      }

      const data = await podcasterService.getMyPodcasters(token);
      setPodcasters(data);
    } catch (err: any) {
      console.error('Error fetching podcasters:', err);
      setError(err.message || 'Failed to load podcasters');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPodcasters();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchPodcasters();
    }, [])
  );

  const onRefresh = () => {
    fetchPodcasters(true);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
        <ActivityIndicator size="large" color="#BF9A54" />
        <Text className="font-inter text-gray-500 mt-4">Loading your podcasters...</Text>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView className="flex-1 bg-brand-beige">
      <ScrollView
        contentContainerStyle={{ padding: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BF9A54" />
        }
      >
        {/* Header */}
        <Text className="font-inter-bold text-3xl text-gray-900 mb-1">Studio</Text>
        <Text className="font-jakarta mb-8">Manage your Virtual Podcasters here!</Text>

        {/* Error Message */}
        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <Text className="font-inter text-red-800">{error}</Text>
            <TouchableOpacity onPress={() => fetchPodcasters()} className="mt-2">
              <Text className="font-inter-medium text-red-600">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section Header */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className="font-inter-medium text-xl text-gray-900">
            {podcasters.length > 0 ? 'Your Podcasters' : 'Create your first podcaster'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/podcasts/create')}
            className="w-6 h-6 rounded-full border border-brand-gold items-center justify-center"
          >
            <Ionicons name="add" size={16} color="#BF9A54" />
          </TouchableOpacity>
        </View>

        {/* Empty State */}
        {podcasters.length === 0 && !error && (
          <View className="items-center justify-center py-16">
            <View className="w-24 h-24 bg-brand-gold/20 rounded-full items-center justify-center mb-4">
              <Ionicons name="mic" size={48} color="#BF9A54" />
            </View>
            <Text className="font-inter-bold text-xl text-gray-900 mb-2">No podcasters yet</Text>
            <Text className="font-inter text-gray-500 text-center mb-6 px-8">
              Create your first virtual podcaster to bring your books to life
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/podcasts/create')}
              className="bg-brand-gold px-8 py-3 rounded-full"
            >
              <Text className="text-white font-jakarta-bold text-sm">Create Podcaster</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Grid of Podcasters - 3 per row */}
        {podcasters.length > 0 && (
          <View className="flex-row flex-wrap gap-4">
            {podcasters.map((podcaster) => (
              <TouchableOpacity
                key={podcaster.id}
                onPress={() => router.push(`/podcasts/${podcaster.id}`)}
                className="w-[30%] bg-[#F5F5F0] rounded-2xl p-4 py-6 items-center mb-3 aspect-[0.9] justify-center shadow-md"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 14
                }}
              >
                {/* Avatar */}
                {podcaster.profilePictureUrl ? (
                  <Image
                    source={{ uri: podcaster.profilePictureUrl }}
                    className="w-16 h-16 rounded-full mb-3"
                  />
                ) : (
                  <View className="w-16 h-16 bg-brand-gold rounded-full mb-3 items-center justify-center">
                    <Text className="font-jakarta-bold text-white text-xl">
                      {podcaster.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Name */}
                <Text className="font-jakarta-medium text-center text-brand-gold text-xs" numberOfLines={2}>
                  {podcaster.name}
                </Text>

                {/* Stats */}
                {podcaster.playCount > 0 && (
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="play" size={10} color="#8C8577" />
                    <Text className="font-inter text-[10px] text-gray-500 ml-1">
                      {podcaster.playCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}