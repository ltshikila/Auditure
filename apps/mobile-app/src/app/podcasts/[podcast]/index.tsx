import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { podcasterService, Podcaster } from '@/services/podcaster.service';
import { storageService } from '@/services/storage.service';

export default function PodcastDetailsScreen() {
  const { podcast: podcastId } = useLocalSearchParams();
  const [podcaster, setPodcaster] = useState<Podcaster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPodcaster();
  }, [podcastId]);

  const fetchPodcaster = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await storageService.getAccessToken();
      if (!token) {
        router.replace('/(auth)/Auth');
        return;
      }

      const data = await podcasterService.getPodcaster(podcastId as string, token);
      setPodcaster(data);
    } catch (err: any) {
      console.error('Error fetching podcaster:', err);
      setError(err.message || 'Failed to load podcaster');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
        <ActivityIndicator size="large" color="#BF9A54" />
      </SafeAreaView>
    );
  }

  if (error || !podcaster) {
    return (
      <SafeAreaView className="flex-1 bg-brand-beige">
        <View className="p-6">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <View className="items-center justify-center flex-1">
            <Text className="font-inter-bold text-xl text-gray-900 mb-2">
              {error || 'Podcaster not found'}
            </Text>
            <TouchableOpacity onPress={fetchPodcaster} className="mt-4">
              <Text className="font-inter-medium text-brand-gold">Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-beige">
      <ScrollView>
        {/* Header Section */}
        <View className="px-6 pt-2">
          {/* Top Bar */}
          <View className="flex-row justify-between items-center mb-6">
            <TouchableOpacity onPress={() => router.back()}>
               <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <View className="flex-row gap-4">
              <Ionicons name="notifications-outline" size={24} color="#000" />
              <Ionicons name="search-outline" size={24} color="#000" />
            </View>
          </View>

          <Text className="font-jakarta-bold text-2xl text-gray-900 mb-1">{podcaster.name}</Text>
          <Text className="font-inter text-gray-500 mb-8">
            {podcaster.description || 'No description provided'}
          </Text>

          {/* Profile Section */}
          <View className="items-center mb-8">
            {/* Profile Picture */}
            {podcaster.profilePictureUrl ? (
              <Image
                source={{ uri: podcaster.profilePictureUrl }}
                className="w-32 h-32 rounded-full mb-4"
              />
            ) : (
              <View className="w-32 h-32 bg-brand-gold rounded-full mb-4 items-center justify-center">
                <Text className="font-jakarta-bold text-white text-4xl">
                  {podcaster.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {/* Voice Model Badge */}
            <View className="bg-brand-gold/20 px-4 py-2 rounded-full mb-6">
              <Text className="font-inter-medium text-brand-gold text-sm">
                {podcaster.voiceModel.charAt(0) + podcaster.voiceModel.slice(1).toLowerCase()} • {podcaster.gender.charAt(0) + podcaster.gender.slice(1).toLowerCase()}
              </Text>
            </View>

            {/* Stats Row */}
            <View className="flex-row w-full justify-between px-8 mb-8">
              <View className="items-center">
                <Text className="font-jakarta-bold text-lg text-gray-900">0</Text>
                <Text className="font-inter text-xs text-gray-500">Episodes</Text>
              </View>
              <View className="items-center">
                <Text className="font-jakarta-bold text-lg text-gray-900">{podcaster.likeCount}</Text>
                <Text className="font-inter text-xs text-gray-500">Likes</Text>
              </View>
              <View className="items-center">
                <Text className="font-jakarta-bold text-lg text-gray-900">{podcaster.playCount}</Text>
                <Text className="font-inter text-xs text-gray-500">Plays</Text>
              </View>
            </View>

            {/* Manage Button */}
            <TouchableOpacity
              onPress={() => router.push(`/podcasts/${podcastId}/manage`)}
              className="bg-black px-8 py-3 rounded-full"
            >
              <Text className="text-white font-jakarta-bold text-sm">Manage Podcaster</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Episodes Section */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center px-6 mb-4">
            <Text className="font-jakarta-bold text-xl text-gray-900">Episodes</Text>
            <TouchableOpacity 
              onPress={() => router.push('/episodes/create')}
              className="w-6 h-6 rounded-full border border-brand-gold items-center justify-center"
            >
              <Ionicons name="add" size={16} color="#BF9A54" />
            </TouchableOpacity>
          </View>

          {/* Empty State for Episodes */}
          <View className="px-6 py-8 items-center">
            <View className="w-16 h-16 bg-brand-gold/20 rounded-full items-center justify-center mb-3">
              <Ionicons name="headset" size={32} color="#BF9A54" />
            </View>
            <Text className="font-inter-bold text-gray-900 mb-2">No episodes yet</Text>
            <Text className="font-inter text-gray-500 text-center text-sm">
              Create your first episode with this podcaster
            </Text>
          </View>
        </View>

        {/* Analytics Section (Empty as requested) */}
        <View className="px-6 mb-24">
           <Text className="font-jakarta-bold text-xl text-gray-900 mb-4">Analytics</Text>
           <View className="h-40 bg-white/50 rounded-xl border border-dashed border-gray-300 items-center justify-center">
              <Text className="text-gray-400 font-inter">Analytics Data Placeholder</Text>
           </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}