import { Stack } from 'expo-router';
import React from 'react';

export default function PodcastDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="manage"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
