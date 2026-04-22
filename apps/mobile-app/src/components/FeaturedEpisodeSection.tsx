import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { EpisodeFeedItem } from '@/services/feed.service';
import { FeaturedEpisodeCard } from './FeaturedEpisodeCard';

interface FeaturedEpisodeSectionProps {
    title: string;
    episodes: EpisodeFeedItem[];
    onEpisodePress: (episode: EpisodeFeedItem) => void;
    onSeeAll?: () => void;
    showSeeAll?: boolean;
}

export const FeaturedEpisodeSection: React.FC<FeaturedEpisodeSectionProps> = ({
    title,
    episodes,
    onEpisodePress,
    onSeeAll,
    showSeeAll = false,
}) => {
    if (episodes.length === 0) {
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
                {episodes.map((episode) => (
                    <FeaturedEpisodeCard
                        key={episode.id}
                        episode={episode}
                        onPress={() => onEpisodePress(episode)}
                    />
                ))}
            </ScrollView>
        </View>
    );
};
