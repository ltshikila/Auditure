import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayback } from '@/contexts/PlaybackContext';
import { router, useSegments } from 'expo-router';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveCoverUrl } from '@/services/api';

export const MINI_PLAYER_HEIGHT = 80;
export const SIMPLIFIED_PLAYER_HEIGHT = 64;
// Base tab bar height (matches _layout.tsx calculation: 72 + insets.bottom)
export const TAB_BAR_BASE_HEIGHT = 72;

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 1.75, 2];

export const MiniPlayer: React.FC = () => {
    const insets = useSafeAreaInsets();
    const {
        episode,
        isPlaying,
        isLoading,
        playbackRate,
        pause,
        resume,
        skipBackward,
        skipForward,
        setPlaybackRate,
    } = usePlayback();

    // Use segments to detect current route - more reliable than usePathname
    const segments = useSegments();

    if (!episode) return null;

    // Check if on play or transcript page - show simplified version
    const isPlayerPage = (segments as string[]).includes('play') || (segments as string[]).includes('transcript');

    // Check if we're in the (tabs) layout - tab bar is only visible there
    const isInTabsLayout = (segments as string[])[0] === '(tabs)';

    const handlePress = () => {
        if (!isPlayerPage) {
            router.push(`/episodes/${episode.id}/play`);
        }
    };

    const handlePlayPause = (e: any) => {
        e.stopPropagation();
        if (isPlaying) {
            pause();
        } else {
            resume();
        }
    };

    const handleSkipBack = (e: any) => {
        e.stopPropagation();
        skipBackward(10);
    };

    const handleSkipForward = (e: any) => {
        e.stopPropagation();
        skipForward(10);
    };

    const handleSpeedChange = (e: any) => {
        e.stopPropagation();
        const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
        setPlaybackRate(PLAYBACK_SPEEDS[nextIndex]);
    };

    const formatSpeed = (rate: number) => {
        return rate === 1 ? '1x' : `${rate}x`;
    };

    // Simplified player for play/transcript pages (controls only, centered)
    if (isPlayerPage) {
        return (
            <Animated.View
                entering={FadeInDown.duration(300)}
                exiting={FadeOutDown.duration(300)}
                className="absolute left-4 right-4"
                style={{
                    bottom: insets.bottom + 8,
                }}
            >
                <View
                    className="bg-[#1A1C1E] rounded-full overflow-hidden"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 12,
                    }}
                >
                    <View className="flex-row items-center justify-center px-4 py-3">
                        {/* Playback Speed */}
                        <TouchableOpacity
                            onPress={handleSpeedChange}
                            className="w-12 h-12 items-center justify-center mr-2"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text className="text-white text-sm font-inter-medium">
                                {formatSpeed(playbackRate)}
                            </Text>
                        </TouchableOpacity>

                        {/* Skip Back */}
                        <TouchableOpacity
                            onPress={handleSkipBack}
                            className="w-12 h-12 items-center justify-center"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <View className="items-center">
                                <Ionicons name="play-back" size={22} color="#FFFFFF" />
                                <Text className="text-white text-[9px] font-inter -mt-0.5">10</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Play/Pause */}
                        <TouchableOpacity
                            onPress={handlePlayPause}
                            className="w-14 h-14 rounded-full bg-brand-red items-center justify-center mx-4"
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Ionicons
                                    name={isPlaying ? 'pause' : 'play'}
                                    size={24}
                                    color="white"
                                />
                            )}
                        </TouchableOpacity>

                        {/* Skip Forward */}
                        <TouchableOpacity
                            onPress={handleSkipForward}
                            className="w-12 h-12 items-center justify-center"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <View className="items-center">
                                <Ionicons name="play-forward" size={22} color="#FFFFFF" />
                                <Text className="text-white text-[9px] font-inter -mt-0.5">10</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Heart/Like */}
                        <TouchableOpacity
                            onPress={(e) => e.stopPropagation()}
                            className="w-12 h-12 items-center justify-center ml-2"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        );
    }

    // Full player for other pages (with cover and title)
    return (
        <Animated.View
            entering={FadeInDown.duration(300)}
            exiting={FadeOutDown.duration(300)}
            className="absolute left-4 right-4"
            style={{
                bottom: isInTabsLayout ? TAB_BAR_BASE_HEIGHT + insets.bottom + 16 : insets.bottom + 8,
            }}
        >
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.95}
                className="bg-[#1A1C1E] rounded-2xl overflow-hidden"
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 12,
                }}
            >
                {/* Main content row */}
                <View className="flex-row items-center px-4 py-3">
                    {/* Book cover */}
                    <View className="rounded-lg overflow-hidden bg-[#2A2C2E] mr-3 items-center justify-center" style={{ width: 36, height: 48 }}>
                        {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                            <Image
                                source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                                style={{ width: 36, height: 48, borderRadius: 2}}
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-full h-full items-center justify-center">
                                <Ionicons name="book" size={18} color="#BF9A54" />
                            </View>
                        )}
                    </View>

                    {/* Episode info */}
                    <View className="flex-1 mr-2">
                        <Text
                            className="font-inter-medium text-white text-sm"
                            numberOfLines={1}
                        >
                            {episode.title}
                        </Text>
                        <Text
                            className="font-inter text-[#858585] text-xs mt-0.5"
                            numberOfLines={1}
                        >
                            {episode.book?.title || 'Unknown book'}
                        </Text>
                    </View>

                    {/* Controls */}
                    <View className="flex-row items-center">
                        {/* Skip Back */}
                        <TouchableOpacity
                            onPress={handleSkipBack}
                            className="w-9 h-9 items-center justify-center"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <View className="items-center">
                                <Ionicons name="play-back" size={18} color="#FFFFFF" />
                                <Text className="text-white text-[8px] font-inter -mt-0.5">10</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Play/Pause */}
                        <TouchableOpacity
                            onPress={handlePlayPause}
                            className="w-11 h-11 rounded-full bg-brand-red items-center justify-center mx-1"
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

                        {/* Skip Forward */}
                        <TouchableOpacity
                            onPress={handleSkipForward}
                            className="w-9 h-9 items-center justify-center"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <View className="items-center">
                                <Ionicons name="play-forward" size={18} color="#FFFFFF" />
                                <Text className="text-white text-[8px] font-inter -mt-0.5">10</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Heart/Like */}
                        <TouchableOpacity
                            onPress={(e) => e.stopPropagation()}
                            className="w-9 h-9 items-center justify-center ml-1"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default MiniPlayer;
