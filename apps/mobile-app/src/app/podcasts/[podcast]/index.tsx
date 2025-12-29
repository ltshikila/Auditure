import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Mock Data for Episodes
const EPISODES = [
  { id: '1', title: 'Episode Name', book: 'The Laws of Human Nature', cover: '#003366' }, // Blue
  { id: '2', title: 'Episode Name', book: 'Authority', cover: '#FFD700' }, // Yellow
  { id: '3', title: 'Episode Name', book: 'Book Name', cover: '#000000' }, // Black
];

export default function PodcastDetailsScreen() {
  const { podcast } = useLocalSearchParams();

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

          <Text className="font-jakarta-bold text-2xl text-gray-900 mb-1">Virtual Podcast Name</Text>
          <Text className="font-inter text-gray-500 mb-8">Manage your Virtual Podcasts here!</Text>

          {/* Profile Section */}
          <View className="items-center mb-8">
            <View className="w-32 h-32 bg-brand-gold rounded-full mb-4" />
            <Text className="font-inter text-gray-900 mb-6">Bio</Text>

            {/* Stats Row */}
            <View className="flex-row w-full justify-between px-8 mb-8">
              <View className="items-center">
                <Text className="font-jakarta-bold text-lg text-gray-900">23</Text>
                <Text className="font-inter text-xs text-gray-500">Episodes</Text>
              </View>
              <View className="items-center">
                <Text className="font-jakarta-bold text-lg text-gray-900">23</Text>
                <Text className="font-inter text-xs text-gray-500">Followers</Text>
              </View>
              <View className="items-center">
                <Text className="font-jakarta-bold text-lg text-gray-900">23</Text>
                <Text className="font-inter text-xs text-gray-500">Total Plays</Text>
              </View>
            </View>

            {/* Manage Button */}
            <TouchableOpacity 
              onPress={() => router.push(`/podcasts/${podcast}/manage`)}
              className="bg-black px-8 py-3 rounded-full"
            >
              <Text className="text-white font-jakarta-bold text-sm">Manage Podcast</Text>
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}>
            {EPISODES.map((ep) => (
              <TouchableOpacity 
                key={ep.id}
                onPress={() => router.push(`/episodes/${ep.id}`)}
                className="w-32 mr-4"
              >
                {/* Book Cover Placeholder */}
                <View 
                  className="w-32 h-48 rounded-lg mb-2 shadow-sm" 
                  style={{ backgroundColor: ep.cover }}
                />
                <Text className="font-jakarta-bold text-sm text-gray-900" numberOfLines={1}>
                  {ep.title}
                </Text>
                <Text className="font-inter text-xs text-gray-500" numberOfLines={1}>
                  {ep.book}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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