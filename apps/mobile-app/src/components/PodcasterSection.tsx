import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { PodcasterFeedItem } from '@/services/feed.service';
import { PodcasterCard } from './PodcasterCard';

interface PodcasterSectionProps {
    title: string;
    podcasters: PodcasterFeedItem[];
    onPodcasterPress: (podcaster: PodcasterFeedItem) => void;
    onSeeAll?: () => void;
    showSeeAll?: boolean;
}

export const PodcasterSection: React.FC<PodcasterSectionProps> = ({
    title,
    podcasters,
    onPodcasterPress,
    onSeeAll,
    showSeeAll = false,
}) => {
    if (podcasters.length === 0) {
        return null;
    }

    return (
        <View className="mb-6">
            {/* Section Header */}
            <View className="flex-row items-center justify-between mb-3 px-6">
                <Text className="font-inter-medium text-lg text-brand-black dark:text-brand-dark-text">{title}</Text>
                {showSeeAll && onSeeAll && (
                    <TouchableOpacity onPress={onSeeAll}>
                        <Text className="font-inter text-sm text-brand-red dark:text-red-400">View all</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Horizontal Scroll */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24 }}
            >
                {podcasters.map((podcaster) => (
                    <PodcasterCard
                        key={podcaster.id}
                        podcaster={podcaster}
                        onPress={() => onPodcasterPress(podcaster)}
                    />
                ))}
            </ScrollView>
        </View>
    );
};
