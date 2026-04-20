import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EpisodeFeedItem } from '@/services/feed.service';
import { resolveCoverUrl } from '@/services/api';

interface ContinueListeningCardProps {
    episode: EpisodeFeedItem;
    onPress: () => void;
}

export const ContinueListeningCard: React.FC<ContinueListeningCardProps> = ({ episode, onPress }) => {
    const formatDuration = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
    };

    const remainingMs = (episode.duration || 0) - (episode.progressMs || 0);
    const remainingTime = remainingMs > 0 ? formatDuration(remainingMs) : '0m';
    const progressPercent = episode.progressPercent || 0;

    return (
        <TouchableOpacity
            onPress={onPress}
            className="mr-4 bg-white dark:bg-brand-dark-surface rounded-xl overflow-hidden shadow-sm"
            style={{ width: 200 }}
        >
            {/* Top Section with Cover and Info */}
            <View className="flex-row p-3">
                {/* Book Cover */}
                <View className="w-[60px] h-[80px] rounded-lg overflow-hidden bg-brand-input dark:bg-brand-dark-input mr-3">
                    {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                            style={{ width: 60, height: 80 }}
                            resizeMode="contain"
                        />
                    ) : (
                        <View className="w-full h-full bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 items-center justify-center">
                            <Text className="font-jakarta-bold text-brand-gold text-xs text-center px-1" numberOfLines={2}>
                                {episode.book?.title || 'Book'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Episode Info */}
                <View className="flex-1 justify-center">
                    <Text className="font-inter-medium text-[#1A1C1E] dark:text-brand-dark-text text-sm" numberOfLines={2}>
                        {episode.title}
                    </Text>
                    <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs mt-1" numberOfLines={1}>
                        {episode.podcaster?.name || 'Unknown Podcaster'}
                    </Text>
                    <View className="flex-row items-center mt-1">
                        <Ionicons name="time-outline" size={12} color="#858585" />
                        <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs ml-1">
                            {remainingTime} left
                        </Text>
                    </View>
                </View>

                {/* Play Button */}
                <TouchableOpacity
                    onPress={onPress}
                    className="self-center ml-2"
                >
                    <View className="w-10 h-10 rounded-full bg-brand-red items-center justify-center">
                        <Ionicons name="play" size={20} color="white" style={{ marginLeft: 2 }} />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View className="h-1 bg-black/10 dark:bg-white/10">
                <View
                    className="h-full bg-brand-gold"
                    style={{ width: `${progressPercent}%` }}
                />
            </View>
        </TouchableOpacity>
    );
};
