import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EpisodeFeedItem } from '@/services/feed.service';
import { ContinueListeningCard } from './ContinueListeningCard';

interface ContinueListeningSectionProps {
    title: string;
    episodes: EpisodeFeedItem[];
    onEpisodePress: (episode: EpisodeFeedItem) => void;
    onSeeAll?: () => void;
    showSeeAll?: boolean;
}

export const ContinueListeningSection: React.FC<ContinueListeningSectionProps> = ({
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
                {episodes.map((episode) => (
                    <ContinueListeningCard
                        key={episode.id}
                        episode={episode}
                        onPress={() => onEpisodePress(episode)}
                    />
                ))}
            </ScrollView>
        </View>
    );
};
