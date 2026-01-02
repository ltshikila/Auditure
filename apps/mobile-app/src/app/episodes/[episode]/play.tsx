import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { usePlayback } from '@/contexts/PlaybackContext';
import { Episode, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function EpisodePlayScreen() {
    const { episode: episodeId } = useLocalSearchParams<{ episode: string }>();
    const {
        episode,
        isPlaying,
        isLoading,
        position,
        duration,
        playbackRate,
        play,
        pause,
        resume,
        seekTo,
        skipForward,
        skipBackward,
        setPlaybackRate,
    } = usePlayback();

    const [showRateMenu, setShowRateMenu] = useState(false);
    const [localEpisode, setLocalEpisode] = useState<Episode | null>(null);
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);

    // If we don't have the episode in playback context, fetch it
    useEffect(() => {
        if (!episode || episode.id !== episodeId) {
            fetchAndPlayEpisode();
        }
    }, [episodeId]);

    const fetchAndPlayEpisode = async () => {
        if (!episodeId) return;

        try {
            const token = await storageService.getAccessToken();
            const fetchedEpisode = await episodeService.getEpisode(
                episodeId,
                token || undefined
            );
            setLocalEpisode(fetchedEpisode);

            // Auto-play if episode is ready
            if (fetchedEpisode.generationStatus === 'COMPLETED') {
                await play(fetchedEpisode);
            }
        } catch (error) {
            console.error('Error fetching episode:', error);
        }
    };

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs
                .toString()
                .padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
        if (isPlaying) {
            pause();
        } else {
            resume();
        }
    };

    const handleSliderStart = () => {
        setIsSeeking(true);
        setSeekValue(position);
    };

    const handleSliderChange = (value: number) => {
        setSeekValue(value);
    };

    const handleSliderComplete = async (value: number) => {
        await seekTo(value);
        setIsSeeking(false);
    };

    const handleRateChange = (rate: number) => {
        setPlaybackRate(rate);
        setShowRateMenu(false);
    };

    const displayEpisode = episode?.id === episodeId ? episode : localEpisode;
    const displayPosition = isSeeking ? seekValue : position;

    if (!displayEpisode) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
                <ActivityIndicator size="large" color="#BF9A54" />
                <Text className="font-inter text-[#858585] mt-4">Loading episode...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-brand-beige">
            {/* Header */}
            <View className="px-6 pt-4 flex-row items-center justify-between">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center"
                >
                    <Ionicons name="chevron-down" size={28} color="#1A1C1E" />
                </TouchableOpacity>
                <Text className="font-inter-medium text-[#1A1C1E]">Now Playing</Text>
                <TouchableOpacity className="w-10 h-10 items-center justify-center">
                    <Ionicons name="ellipsis-horizontal" size={24} color="#1A1C1E" />
                </TouchableOpacity>
            </View>

            {/* Cover Art */}
            <View className="flex-1 items-center justify-center px-12">
                <View className="w-full aspect-square max-w-[300px] rounded-2xl overflow-hidden shadow-2xl bg-brand-input">
                    {displayEpisode.book?.coverImageUrl ? (
                        <Image
                            source={{ uri: displayEpisode.book.coverImageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full bg-brand-gold/20 items-center justify-center">
                            <Ionicons name="book" size={80} color="#BF9A54" />
                        </View>
                    )}
                </View>
            </View>

            {/* Info */}
            <View className="px-6 mt-4">
                <Text
                    className="font-jakarta-bold text-xl text-[#1A1C1E] text-center"
                    numberOfLines={2}
                >
                    {displayEpisode.title}
                </Text>
                <Text className="font-inter text-[#858585] text-center mt-1">
                    {displayEpisode.book?.title}
                </Text>
            </View>

            {/* Progress Slider */}
            <View className="px-6 mt-6">
                <Slider
                    value={displayPosition}
                    minimumValue={0}
                    maximumValue={duration || 1}
                    onSlidingStart={handleSliderStart}
                    onValueChange={handleSliderChange}
                    onSlidingComplete={handleSliderComplete}
                    minimumTrackTintColor="#BF9A54"
                    maximumTrackTintColor="#E8E3D6"
                    thumbTintColor="#BF9A54"
                />
                <View className="flex-row justify-between mt-1">
                    <Text className="font-inter text-xs text-[#858585]">
                        {formatTime(displayPosition)}
                    </Text>
                    <Text className="font-inter text-xs text-[#858585]">
                        {formatTime(duration)}
                    </Text>
                </View>
            </View>

            {/* Transcript Toggle */}
            <View className="px-6 mt-4">
                <TouchableOpacity
                    onPress={() => router.push(`/episodes/${episodeId}/transcript`)}
                    className="bg-white rounded-xl py-3 px-4"
                >
                    <View className="flex-row items-center justify-between">
                        <Text className="font-inter-medium text-[#1A1C1E]">Transcripts</Text>
                        <Ionicons name="chevron-forward" size={20} color="#858585" />
                    </View>
                    {displayEpisode.scriptContent && (
                        <Text
                            className="font-inter text-xs text-[#858585] mt-1"
                            numberOfLines={2}
                        >
                            {displayEpisode.scriptContent.substring(0, 100)}...
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Controls */}
            <View className="px-6 mt-6 mb-8">
                <View className="flex-row items-center justify-center">
                    {/* Skip Backward */}
                    <TouchableOpacity
                        onPress={() => skipBackward(10)}
                        className="w-16 h-16 items-center justify-center"
                    >
                        <View className="items-center">
                            <Ionicons name="play-back" size={28} color="#1A1C1E" />
                            <Text className="font-inter text-xs text-[#858585] mt-1">10</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Play/Pause */}
                    <TouchableOpacity
                        onPress={handlePlayPause}
                        className="w-20 h-20 rounded-full bg-brand-red items-center justify-center mx-8 shadow-lg"
                    >
                        {isLoading ? (
                            <ActivityIndicator size="large" color="white" />
                        ) : (
                            <Ionicons
                                name={isPlaying ? 'pause' : 'play'}
                                size={36}
                                color="white"
                            />
                        )}
                    </TouchableOpacity>

                    {/* Skip Forward */}
                    <TouchableOpacity
                        onPress={() => skipForward(30)}
                        className="w-16 h-16 items-center justify-center"
                    >
                        <View className="items-center">
                            <Ionicons name="play-forward" size={28} color="#1A1C1E" />
                            <Text className="font-inter text-xs text-[#858585] mt-1">30</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Bottom Controls */}
                <View className="flex-row items-center justify-center mt-6 space-x-8">
                    {/* Playback Rate */}
                    <TouchableOpacity
                        onPress={() => setShowRateMenu(!showRateMenu)}
                        className="px-4 py-2 rounded-full bg-white border border-[#E8E3D6]"
                    >
                        <Text className="font-inter-medium text-[#1A1C1E]">
                            {playbackRate}x
                        </Text>
                    </TouchableOpacity>

                    {/* Like Button */}
                    <TouchableOpacity className="w-10 h-10 items-center justify-center">
                        <Ionicons name="heart-outline" size={24} color="#1A1C1E" />
                    </TouchableOpacity>
                </View>

                {/* Rate Menu */}
                {showRateMenu && (
                    <View className="flex-row justify-center flex-wrap mt-4 bg-white rounded-xl p-3">
                        {PLAYBACK_RATES.map((rate) => (
                            <TouchableOpacity
                                key={rate}
                                onPress={() => handleRateChange(rate)}
                                className={`px-4 py-2 m-1 rounded-full ${
                                    playbackRate === rate ? 'bg-brand-gold' : 'bg-[#E8E3D6]'
                                }`}
                            >
                                <Text
                                    className={`font-inter text-sm ${
                                        playbackRate === rate ? 'text-white' : 'text-[#1A1C1E]'
                                    }`}
                                >
                                    {rate}x
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
