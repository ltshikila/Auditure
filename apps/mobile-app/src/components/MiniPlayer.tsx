import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayback } from '@/contexts/PlaybackContext';
import { router, useSegments, usePathname } from 'expo-router';
// Animated.View with entering/exiting animations breaks absolute positioning on Android
// import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveCoverUrl } from '@/services/api';
import { episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';

const skipBackIcon = require('@/assets/icons/backward-10-seconds.png');
const skipForwardIcon = require('@/assets/icons/forward-10-seconds.png');
const booksIcon = require('@/assets/icons/books_fill.png');

export const MINI_PLAYER_HEIGHT = 68;
export const SIMPLIFIED_PLAYER_HEIGHT = 54;
// Base tab bar height (85% of original, matches _layout.tsx calculation: 61 + insets.bottom)
export const TAB_BAR_BASE_HEIGHT = 61;

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 1.75, 2];

export const MiniPlayer: React.FC = () => {
    const insets = useSafeAreaInsets();
    const {
        episode,
        isPlaying,
        isLoading,
        playbackRate,
        hasNext,
        hasPrevious,
        pause,
        resume,
        skipBackward,
        skipForward,
        setPlaybackRate,
        playNext,
        playPrevious,
    } = usePlayback();

    const [isLiked, setIsLiked] = useState(false);

    // Fetch like status when episode changes
    useEffect(() => {
        if (!episode) {
            setIsLiked(false);
            return;
        }
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
    }, [episode?.id]);

    const handleLike = useCallback(async (e: any) => {
        e.stopPropagation();
        if (!episode) return;
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;
            if (isLiked) {
                await episodeService.unlike(episode.id, token);
                setIsLiked(false);
            } else {
                await episodeService.like(episode.id, token);
                setIsLiked(true);
            }
        } catch {
            // non-critical
        }
    }, [episode?.id, isLiked]);

    // Use both segments and pathname for reliable route detection
    const segments = useSegments();
    const pathname = usePathname();

    // Hide player when no episode or on auth pages (logged out)
    const isOnAuthPage = (segments as string[])[0] === '(auth)' || pathname.startsWith('/(auth)');
    if (!episode || isOnAuthPage) return null;

    // Check if on play or transcript page - show simplified version
    const isPlayerPage = (segments as string[]).includes('play') || (segments as string[]).includes('transcript');

    // Check if we're in the (tabs) layout - tab bar is only visible there
    // Default to true when segments are empty (app startup race condition before router resolves)
    const TAB_PATHS = ['/home', '/episode', '/studio', '/profile'];
    const isInTabsLayout = (segments as string[]).length === 0 ||
        (segments as string[]).includes('(tabs)') ||
        TAB_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

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

    const handlePlayNext = (e: any) => {
        e.stopPropagation();
        playNext();
    };

    const handlePlayPrevious = (e: any) => {
        e.stopPropagation();
        playPrevious();
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
            <View
                style={{
                    position: 'absolute',
                    left: 16,
                    right: 16,
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

                            {/* Previous Track */}
                            <TouchableOpacity
                                onPress={handlePlayPrevious}
                                disabled={!hasPrevious}
                                className="w-10 h-10 items-center justify-center"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="play-skip-back" size={20} color={hasPrevious ? '#FFFFFF' : '#555555'} />
                            </TouchableOpacity>

                            {/* Skip Back */}
                            <TouchableOpacity
                                onPress={handleSkipBack}
                                className="w-12 h-12 items-center justify-center"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Image source={skipBackIcon} style={{ width: 28, height: 28, tintColor: '#FFFFFF' }} />
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
                                <Image source={skipForwardIcon} style={{ width: 28, height: 28, tintColor: '#FFFFFF' }} />
                            </TouchableOpacity>

                            {/* Next Track */}
                            <TouchableOpacity
                                onPress={handlePlayNext}
                                disabled={!hasNext}
                                className="w-10 h-10 items-center justify-center"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="play-skip-forward" size={20} color={hasNext ? '#FFFFFF' : '#555555'} />
                            </TouchableOpacity>

                            {/* Heart/Like */}
                            <TouchableOpacity
                                onPress={handleLike}
                                className="w-12 h-12 items-center justify-center ml-2"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons
                                    name={isLiked ? 'heart' : 'heart-outline'}
                                    size={24}
                                    color={isLiked ? '#FF4B4B' : '#FFFFFF'}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
            </View>
        );
    }

    // Full player for other pages (with cover and title)
    return (
        <View
            style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: isInTabsLayout ? TAB_BAR_BASE_HEIGHT + insets.bottom + 12 : insets.bottom + 8,
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
                        <View className="rounded-lg overflow-hidden bg-[#2A2C2E] mr-3 items-center justify-center" style={{ width: 30, height: 41 }}>
                            {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                                <Image
                                    source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                                    style={{ width: 30, height: 41, borderRadius: 2}}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="w-full h-full items-center justify-center">
                                    <Image source={booksIcon} style={{ width: 20, height: 20, tintColor: '#BF9A54' }} />
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
                            {/* Previous Track */}
                            <TouchableOpacity
                                onPress={handlePlayPrevious}
                                disabled={!hasPrevious}
                                className="w-9 h-9 items-center justify-center"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="play-skip-back" size={16} color={hasPrevious ? '#FFFFFF' : '#555555'} />
                            </TouchableOpacity>

                            {/* Skip Back */}
                            <TouchableOpacity
                                onPress={handleSkipBack}
                                className="w-9 h-9 items-center justify-center"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Image source={skipBackIcon} style={{ width: 22, height: 22, tintColor: '#FFFFFF' }} />
                            </TouchableOpacity>

                            {/* Play/Pause */}
                            <TouchableOpacity
                                onPress={handlePlayPause}
                                className="w-10 h-10 rounded-full bg-brand-red items-center justify-center mx-1"
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
                                <Image source={skipForwardIcon} style={{ width: 22, height: 22, tintColor: '#FFFFFF' }} />
                            </TouchableOpacity>

                            {/* Next Track */}
                            <TouchableOpacity
                                onPress={handlePlayNext}
                                disabled={!hasNext}
                                className="w-9 h-9 items-center justify-center"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="play-skip-forward" size={16} color={hasNext ? '#FFFFFF' : '#555555'} />
                            </TouchableOpacity>

                            {/* Heart/Like */}
                            <TouchableOpacity
                                onPress={handleLike}
                                className="w-9 h-9 items-center justify-center ml-1"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons
                                    name={isLiked ? 'heart' : 'heart-outline'}
                                    size={20}
                                    color={isLiked ? '#FF4B4B' : '#FFFFFF'}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
        </View>
    );
};

export default MiniPlayer;
