import { Stack } from 'expo-router';
import React from 'react';

export default function EpisodeDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="play"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="transcript"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
