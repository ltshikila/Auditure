import { Stack } from 'expo-router';
import React from 'react';

export default function EpisodesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="see-all"
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="create"
        options={{
          presentation: 'modal',
          headerShown: false
        }}
      />

      {/* Dynamic Episode Details - has its own _layout.tsx */}
      <Stack.Screen
        name="[episode]"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}