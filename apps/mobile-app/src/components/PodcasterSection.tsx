import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
                <Text className="font-inter-medium text-lg text-brand-black">{title}</Text>
                {showSeeAll && onSeeAll && (
                    <TouchableOpacity onPress={onSeeAll} className="flex-row items-center">
                        <Text className="font-inter text-sm text-brand-gold mr-1">See all</Text>
                        <Ionicons name="chevron-forward" size={14} color="#BF9A54" />
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
