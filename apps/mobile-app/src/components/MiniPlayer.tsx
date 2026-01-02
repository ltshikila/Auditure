import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayback } from '@/contexts/PlaybackContext';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

export const MiniPlayer: React.FC = () => {
    const {
        episode,
        isPlaying,
        isLoading,
        pause,
        resume,
        position,
        duration,
    } = usePlayback();

    if (!episode) return null;

    const progress = duration > 0 ? (position / duration) * 100 : 0;

    const handlePress = () => {
        router.push(`/episodes/${episode.id}/play`);
    };

    const handlePlayPause = (e: any) => {
        e.stopPropagation();
        if (isPlaying) {
            pause();
        } else {
            resume();
        }
    };

    return (
        <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutDown.duration(300)}
            className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E8E3D6] shadow-lg"
            style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 8,
            }}
        >
            {/* Progress Bar */}
            <View className="h-1 bg-[#E8E3D6]">
                <View
                    className="h-full bg-brand-gold"
                    style={{ width: `${progress}%` }}
                />
            </View>

            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.9}
                className="flex-row items-center px-4 py-3"
            >
                {/* Cover Image */}
                <View className="w-12 h-12 rounded-lg overflow-hidden bg-brand-input mr-3">
                    {episode.book?.coverImageUrl ? (
                        <Image
                            source={{ uri: episode.book.coverImageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full bg-brand-gold/20 items-center justify-center">
                            <Ionicons name="book" size={20} color="#BF9A54" />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View className="flex-1 mr-3">
                    <Text
                        className="font-inter-medium text-[#1A1C1E] text-sm"
                        numberOfLines={1}
                    >
                        {episode.title}
                    </Text>
                    <Text
                        className="font-inter text-[#858585] text-xs"
                        numberOfLines={1}
                    >
                        {episode.book?.title || 'Unknown book'}
                    </Text>
                </View>

                {/* Controls */}
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={handlePlayPause}
                        className="w-10 h-10 rounded-full bg-brand-red items-center justify-center"
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Ionicons
                                name={isPlaying ? 'pause' : 'play'}
                                size={20}
                                color="white"
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default MiniPlayer;
