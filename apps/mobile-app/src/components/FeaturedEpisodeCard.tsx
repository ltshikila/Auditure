import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { EpisodeFeedItem } from '@/services/feed.service';
import { resolveCoverUrl } from '@/services/api';

interface FeaturedEpisodeCardProps {
    episode: EpisodeFeedItem;
    onPress: () => void;
    onFavoritePress?: () => void;
    isFavorited?: boolean;
}

export const FeaturedEpisodeCard: React.FC<FeaturedEpisodeCardProps> = ({
    episode,
    onPress,
    onFavoritePress,
    isFavorited = false,
}) => {
    const rating = episode.likeCount && episode.playCount
        ? Math.min(5, Math.max(1, (episode.likeCount / Math.max(episode.playCount, 1)) * 5 + 3)).toFixed(1)
        : '4.8';

    return (
        <View className="mr-4" style={{ width: 220 }}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
                {/* Card Container */}
                <View className="w-[220px] h-[300px] rounded-2xl overflow-hidden bg-brand-input shadow-md">
                    {/* Book Cover */}
                    {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                            style={{ width: 220, height: 300 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 items-center justify-center">
                            <Text className="font-jakarta-bold text-brand-gold text-xl text-center px-4" numberOfLines={3}>
                                {episode.book?.title || 'Book'}
                            </Text>
                        </View>
                    )}

                    {/* Favorite Button */}
                    <TouchableOpacity
                        onPress={onFavoritePress}
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 items-center justify-center"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={isFavorited ? 'heart' : 'heart-outline'}
                            size={20}
                            color={isFavorited ? '#FF4B4B' : 'white'}
                        />
                    </TouchableOpacity>

                    {/* Bottom Overlay */}
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
                        className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-16"
                    >
                        {/* Episode Name */}
                        <Text className="font-inter-bold text-white text-base" numberOfLines={1}>
                            {episode.title}
                        </Text>

                        {/* Book Name and Rating */}
                        <View className="flex-row items-center justify-between mt-1">
                            <Text className="font-inter text-white/80 text-sm flex-1 mr-2" numberOfLines={1}>
                                {episode.book?.title || 'Unknown Book'}
                            </Text>
                            <View className="flex-row items-center">
                                <Ionicons name="star-outline" size={14} color="rgba(255,255,255,0.7)" />
                                <Text className="font-inter-medium text-white/70 text-sm ml-1">{rating}</Text>
                            </View>
                        </View>

                        {/* Progress Bar - only show if there's progress */}
                        {episode.progressPercent !== undefined && episode.progressPercent > 0 && (
                            <View className="mt-2 h-1 bg-white/30 rounded-full overflow-hidden">
                                <View
                                    className="h-full bg-white rounded-full"
                                    style={{ width: `${Math.min(episode.progressPercent, 100)}%` }}
                                />
                            </View>
                        )}
                    </LinearGradient>
                </View>
            </TouchableOpacity>
        </View>
    );
};
