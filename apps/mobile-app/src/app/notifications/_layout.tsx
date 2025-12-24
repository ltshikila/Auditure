import { Stack } from 'expo-router';
import React from 'react';

export default function NotificationsLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ title: 'Notifications' }} 
      />
    </Stack>
  );
}