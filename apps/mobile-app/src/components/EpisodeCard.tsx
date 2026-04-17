import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Episode } from '@/services/episode.service';
import { resolveCoverUrl } from '@/services/api';

interface EpisodeCardProps {
    episode: Episode;
    onPress: () => void;
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({ episode, onPress }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="mr-4"
            style={{ width: 110 }}
        >
            {/* Book Cover */}
            <View className="w-[110px] h-[160px] rounded-lg overflow-hidden bg-brand-input dark:bg-brand-dark-input mb-2 shadow-sm items-center justify-center">
                {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                    <Image
                        source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                        style={{ width: 110, height: 160 }}
                        resizeMode="contain"
                    />
                ) : (
                    <View className="w-full h-full bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 items-center justify-center">
                        <Text className="font-jakarta-bold text-brand-gold text-lg text-center px-2" numberOfLines={3}>
                            {episode.book?.title || 'Book'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Episode Name */}
            <Text className="font-inter-medium text-[#1A1C1E] dark:text-brand-dark-text text-sm" numberOfLines={1}>
                {episode.title}
            </Text>

            {/* Book Name */}
            <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs" numberOfLines={1}>
                {episode.book?.title || 'Unknown Book'}
            </Text>
        </TouchableOpacity>
    );
};
