import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { EpisodeFeedItem } from '@/services/feed.service';
import { resolveCoverUrl } from '@/services/api';
import { episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';

interface FeaturedEpisodeCardProps {
    episode: EpisodeFeedItem;
    onPress: () => void;
}

export const FeaturedEpisodeCard: React.FC<FeaturedEpisodeCardProps> = ({
    episode,
    onPress,
}) => {
    const [isLiked, setIsLiked] = useState(false);

    // Fetch like status on mount
    useEffect(() => {
        (async () => {
            try {
                const token = await storageService.getAccessToken();
                if (!token) return;
                const { isLiked: liked } = await episodeService.getLikeStatus(episode.id, token);
                setIsLiked(liked);
            } catch {
                // non-critical
            }
        })();
    }, [episode.id]);

    const handleLike = async () => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            // Optimistic update
            setIsLiked(!isLiked);

            if (isLiked) {
                await episodeService.unlike(episode.id, token);
            } else {
                await episodeService.like(episode.id, token);
            }
        } catch {
            // Revert on error
            setIsLiked(isLiked);
        }
    };

    const rating = episode.averageRating > 0
        ? episode.averageRating.toFixed(1)
        : null;

    return (
        <View className="mr-4" style={{ width: 220 }}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
                {/* Card Container */}
                <View className="w-[220px] h-[300px] rounded-2xl overflow-hidden bg-[#2A2C2E] shadow-md">
                    {/* Book Cover */}
                    {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                            style={{ width: 220, height: 300 }}
                            resizeMode="contain"
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
                        onPress={handleLike}
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 items-center justify-center"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={isLiked ? 'heart' : 'heart-outline'}
                            size={20}
                            color="white"
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
                            {rating && (
                                <View className="flex-row items-center">
                                    <Ionicons name="star-outline" size={14} color="rgba(255,255,255,0.7)" />
                                    <Text className="font-inter-medium text-white/70 text-sm ml-1">{rating}</Text>
                                </View>
                            )}
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
