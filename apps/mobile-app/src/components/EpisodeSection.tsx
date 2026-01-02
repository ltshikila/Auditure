import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Episode } from '@/services/episode.service';
import { EpisodeCard } from './EpisodeCard';

interface EpisodeSectionProps {
    title: string;
    episodes: Episode[];
    onEpisodePress: (episode: Episode) => void;
    onSeeAll?: () => void;
    showSeeAll?: boolean;
}

export const EpisodeSection: React.FC<EpisodeSectionProps> = ({
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
                <Text className="font-inter-medium text-lg text-[#1A1C1E]">{title}</Text>
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
                    <EpisodeCard
                        key={episode.id}
                        episode={episode}
                        onPress={() => onEpisodePress(episode)}
                    />
                ))}
            </ScrollView>
        </View>
    );
};
