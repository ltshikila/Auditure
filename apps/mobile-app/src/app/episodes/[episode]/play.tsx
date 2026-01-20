import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { usePlayback } from '@/contexts/PlaybackContext';
import { Episode, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { resolveCoverUrl } from '@/services/api';

const icons = {
    star: require('@/assets/icons/star.png'),
    language: require('@/assets/icons/language.png'),
    microphone: require('@/assets/icons/microphone.png'),
};

// Returns first few lines of transcript as a static preview
// Note: Time-synced preview is disabled because TTS doesn't provide timing data
function getTranscriptPreview(scriptContent: string | null | undefined): string {
    if (!scriptContent) return '';

    // Parse script into lines
    const rawLines = scriptContent
        .split(/(?<=[.!?])\s+|(?=(?:HOST|GUEST|NARRATOR|HOST1|GUEST1|GUEST2):\s)/gi)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // Get first few meaningful lines for preview
    const previewLines: string[] = [];
    for (const line of rawLines) {
        const cleanLine = line.replace(/^(HOST|GUEST|NARRATOR|HOST1|GUEST1|GUEST2):\s*/i, '');
        if (cleanLine.length > 0) {
            previewLines.push(cleanLine);
            if (previewLines.join(' ').length > 150) break;
        }
    }

    return previewLines.join(' ').substring(0, 200);
}

export default function EpisodePlayScreen() {
    const { episode: episodeId } = useLocalSearchParams<{ episode: string }>();
    const { episode, position, duration, play, seekTo } = usePlayback();

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
            const fetchedEpisode = await episodeService.getEpisode(episodeId, token || undefined);
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
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    const displayEpisode = episode?.id === episodeId ? episode : localEpisode;
    const displayPosition = isSeeking ? seekValue : position;

    // Get static transcript preview (time sync not available)
    const transcriptPreview = useMemo(() => {
        return getTranscriptPreview(displayEpisode?.scriptContent);
    }, [displayEpisode?.scriptContent]);

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
            <View className="px-6 flex-row items-center justify-between">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center">
                    <Ionicons name="chevron-down" size={28} color="#1A1C1E" />
                </TouchableOpacity>
                <Text className="font-inter-medium text-brand-black">Now Playing</Text>
                <TouchableOpacity className="w-10 h-10 items-center justify-center">
                    <Ionicons name="ellipsis-horizontal" size={24} color="#1A1C1E" />
                </TouchableOpacity>
            </View>

            {/* Cover Art */}
            <View className="items-center mt-4">
                <View
                    className="rounded-2xl shadow-2xl bg-brand-input overflow-hidden"
                    style={{ borderRadius: 16 }}>
                    {resolveCoverUrl(displayEpisode.book?.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(displayEpisode.book?.coverImageUrl)! }}
                            style={{ width: 195, height: 292, borderRadius: 16 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-[195px] h-[292px] bg-brand-gold/20 items-center justify-center">
                            <Ionicons name="book" size={80} color="#BF9A54" />
                        </View>
                    )}
                </View>
            </View>

            {/* Info */}
            <View className="mt-6">
                <Text
                    className="font-inter text-2xl text-brand-black text-center"
                    numberOfLines={2}>
                    {displayEpisode.title}
                </Text>
                <Text className="font-jakarta text-[#858585] text-center mt-1">
                    {displayEpisode.book?.title}
                </Text>
            </View>

            {/* Stats Row */}
            <View className="flex-row items-center justify-center mt-4 gap-4">
                <View className="flex-row items-center gap-1">
                    <Image
                        source={icons.star}
                        style={{ width: 20, height: 20 }}
                        resizeMode="contain"
                    />
                    <Text className="font-jakarta text-brand-black">4.5</Text>
                </View>
                <View className="flex-row items-center gap-1">
                    <Image
                        source={icons.language}
                        style={{ width: 20, height: 20 }}
                        resizeMode="contain"
                    />
                    <Text className="font-jakarta text-brand-black">English</Text>
                </View>
                <View className="flex-row items-center gap-1">
                    <Image
                        source={icons.microphone}
                        style={{ width: 20, height: 20 }}
                        resizeMode="contain"
                    />
                    <Text className="font-jakarta text-brand-black">
                        {displayEpisode.duration
                            ? `${Math.floor(displayEpisode.duration / 60)} min`
                            : '--'}
                    </Text>
                </View>
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

            {/* Transcript Preview Card - with bottom padding for mini player */}
            {displayEpisode.scriptContent && (
                <TouchableOpacity
                    onPress={() => router.push(`/episodes/${episodeId}/transcript`)}
                    className="mx-6 mt-4 mb-28 bg-[#F5F5F0] rounded-2xl p-4 items-center justify-center shadow-md"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        elevation: 8,
                    }}
                    activeOpacity={0.9}>
                    <Text className="font-inter-medium self-start text-brand-red text-base mb-2">
                        Transcripts
                    </Text>
                    <Text className="font-jakarta text-[#858585] text-sm leading-5" numberOfLines={4}>
                        {transcriptPreview || displayEpisode.scriptContent.substring(0, 150)}
                    </Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}
