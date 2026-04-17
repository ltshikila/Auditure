import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PodcasterFeedItem } from '@/services/feed.service';
import { resolveCoverUrl } from '@/services/api';
import { formatCount } from '@/utils/formatCount';

const podcastIcon = require('@/assets/icons/podcast.png');

interface PodcasterCardProps {
    podcaster: PodcasterFeedItem;
    onPress: () => void;
}

export const PodcasterCard: React.FC<PodcasterCardProps> = ({ podcaster, onPress }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="mr-2"
            style={{ width: 80 }}
        >
            {/* Profile Picture */}
            <View className="w-[80px] h-[80px] rounded-full overflow-hidden bg-brand-input dark:bg-brand-dark-input mb-2 shadow-sm items-center justify-center">
                {resolveCoverUrl(podcaster.profilePictureUrl) ? (
                    <Image
                        source={{ uri: resolveCoverUrl(podcaster.profilePictureUrl)! }}
                        style={{ width: 80, height: 80 }}
                        resizeMode="cover"
                    />
                ) : (
                    <View className="w-full h-full bg-[#E8E3D6] items-center justify-center">
                        <Image source={podcastIcon} style={{ width: 30, height: 30, tintColor: '#BF9A54' }} />
                    </View>
                )}
            </View>

            {/* Podcaster Name */}
            <Text className="font-inter-medium text-[#1A1C1E] dark:text-brand-dark-text text-xs text-center" numberOfLines={1}>
                {podcaster.name}
            </Text>

            {/* Rating or Play Count */}
            <View className="flex-row items-center justify-center mt-0.5">
                {podcaster.averageRating > 0 ? (
                    <>
                        <Ionicons name="star" size={12} color="#BF9A54" />
                        <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs ml-1">
                            {podcaster.averageRating.toFixed(1)}
                        </Text>
                    </>
                ) : (
                    <>
                        <Ionicons name="play-circle-outline" size={12} color="#858585" />
                        <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs ml-1">
                            {formatCount(podcaster.playCount)}
                        </Text>
                    </>
                )}
            </View>

            {/* Expertise Tags (first tag only) */}
            {podcaster.expertiseTags && podcaster.expertiseTags.length > 0 && (
                <Text className="font-inter text-brand-gold text-xs text-center mt-0.5" numberOfLines={1}>
                    {podcaster.expertiseTags[0]}
                </Text>
            )}
        </TouchableOpacity>
    );
};
