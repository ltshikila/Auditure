import { Stack } from 'expo-router';
import React from 'react';

export default function EpisodesLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: "", }}>
      {/* Main List */}
      <Stack.Screen 
        name="index" 
        options={{ title: 'Episodes' }} 
      />
      
      {/* Create Modal */}
      <Stack.Screen 
        name="create" 
        options={{ 
          title: 'New Episode',
          presentation: 'modal' 
        }} 
      />

      {/* Dynamic Episode Details (Handles [episode]/index and [episode]/play) */}
      <Stack.Screen 
        name="[episode]" 
        options={{ headerShown: false }} 
      />
    </Stack>
  );
}