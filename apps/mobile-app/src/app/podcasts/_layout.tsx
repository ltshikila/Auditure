import { Stack } from 'expo-router';
import React from 'react';

export default function PodcastsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
                name="create"
                options={{
                    presentation: 'modal',
                    headerShown: false,
                }}
            />

            {/* Dynamic Podcast Folder - has its own _layout.tsx */}
            <Stack.Screen name="[podcast]" options={{ headerShown: false }} />
        </Stack>
    );
}
