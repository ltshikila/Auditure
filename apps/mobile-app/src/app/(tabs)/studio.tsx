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

export default function Studio() {
  return (
    <SafeAreaView className="flex-1 bg-brand-beige">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header */}
        <Text className="font-inter-bold text-3xl text-gray-900 mb-1">Studio</Text>
        <Text className="font-jakarta mb-8">Manage your Virtual Podcasts here!</Text>

        {/* Section Header */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className="font-inter-medium text-xl text-gray-900">Select a podcast</Text>
          <TouchableOpacity 
            onPress={() => router.push('/podcasts/create')}
            className="w-6 h-6 rounded-full border border-brand-gold items-center justify-center"
          >
            <Ionicons name="add" size={16} color="#BF9A54" />
          </TouchableOpacity>
        </View>

        {/* Grid of Podcasts - 3 per row */}
        <View className="flex-row flex-wrap gap-4">
          {PODCASTS.map((podcast) => (
            <TouchableOpacity
              key={podcast.id}
              onPress={() => router.push(`/podcasts/${podcast.id}`)}
              className="w-[30%] bg-[#F5F5F0] rounded-2xl p-4 py-6 items-center mb-3 aspect-[0.9] justify-center shadow-md"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 14
              }}
            >
              {/* Avatar Placeholder */}
              <View className="w-16 h-16 bg-brand-gold rounded-full mb-3" />

              {/* Name */}
              <Text className="font-jakarta-medium text-center text-brand-gold text-xs">
                {podcast.name.split(' ').slice(0, 2).join('\n')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}