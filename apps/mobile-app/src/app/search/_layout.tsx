import { Stack } from 'expo-router';
import React from 'react';

export default function SearchLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false, // We usually render a custom search bar input here
        }} 
      />
    </Stack>
  );
}