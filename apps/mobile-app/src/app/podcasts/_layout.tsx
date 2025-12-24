import { Stack } from 'expo-router';
import React from 'react';

export default function PodcastsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "", }}>
      <Stack.Screen 
        name="index" 
        options={{ title: 'Podcasts' }} 
      />
      
      <Stack.Screen 
        name="create" 
        options={{ 
          title: 'Create Podcast',
          presentation: 'modal' 
        }} 
      />

      {/* Dynamic Podcast Folder */}
      <Stack.Screen 
        name="[podcast]" 
        options={{ headerShown: false }} 
      />
    </Stack>
  );
}