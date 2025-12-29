import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Mock Data for Podcasts
const PODCASTS = [
  { id: '1', name: 'Virtual Podcaster Name' },
  { id: '2', name: 'Virtual Podcaster Name' },
  { id: '3', name: 'Virtual Podcaster Name' },
  { id: '4', name: 'Virtual Podcaster Name' },
  { id: '5', name: 'Virtual Podcaster Name' },
];

export default function PodcastsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-brand-beige">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header */}
        <Text className="font-jakarta-bold text-3xl text-gray-900 mb-1">Studio</Text>
        <Text className="font-inter text-gray-500 mb-8">Manage your Virtual Podcasts here!</Text>

        {/* Section Header */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className="font-jakarta-bold text-xl text-gray-900">Select a podcast</Text>
          <TouchableOpacity 
            onPress={() => router.push('/podcasts/create')}
            className="w-8 h-8 rounded-full border border-brand-gold items-center justify-center"
          >
            <Ionicons name="add" size={20} color="#BF9A54" />
          </TouchableOpacity>
        </View>

        {/* Grid of Podcasts */}
        <View className="flex-row flex-wrap justify-between">
          {PODCASTS.map((podcast) => (
            <TouchableOpacity 
              key={podcast.id}
              onPress={() => router.push(`/podcasts/${podcast.id}`)}
              className="w-[48%] bg-[#F5F5F0] rounded-xl p-4 items-center mb-4 aspect-[0.9] justify-center shadow-sm"
            >
              {/* Avatar Placeholder */}
              <View className="w-20 h-20 bg-brand-gold rounded-full mb-4" />
              
              {/* Name */}
              <Text className="font-jakarta-bold text-center text-brand-gold text-sm">
                {podcast.name.split(' ').slice(0, 2).join('\n')}
              </Text>
              <Text className="font-jakarta-bold text-center text-brand-gold text-sm">
                {podcast.name.split(' ').slice(2).join(' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}