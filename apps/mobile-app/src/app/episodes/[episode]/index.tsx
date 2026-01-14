import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Episode, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { usePlayback } from '@/contexts/PlaybackContext';
import { playbackService, GenerationProgress } from '@/services/playback.service';

export default function EpisodeInfoScreen() {
    const { episode: episodeId } = useLocalSearchParams<{ episode: string }>();
    const [episode, setEpisode] = useState<Episode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
    const { play, episode: currentEpisode, isPlaying } = usePlayback();

    const isGenerating = episode && episode.generationStatus !== 'COMPLETED' && episode.generationStatus !== 'FAILED';

    // Poll for generation progress when episode is generating
    useEffect(() => {
        if (!isGenerating || !episodeId) return;

        const pollProgress = async () => {
            try {
                const token = await storageService.getAccessToken();
                const progress = await playbackService.getGenerationProgress(episodeId, token || undefined);
                if (progress) {
                    setGenerationProgress(progress);
                    // If completed, refresh the episode data
                    if (progress.status === 'COMPLETED') {
                        fetchEpisode();
                    }
                }
            } catch (err) {
                console.error('Failed to fetch generation progress:', err);
            }
        };

        // Poll immediately and then every 3 seconds
        pollProgress();
        const interval = setInterval(pollProgress, 3000);

        return () => clearInterval(interval);
    }, [isGenerating, episodeId]);

    useEffect(() => {
        fetchEpisode();
    }, [episodeId]);

    const fetchEpisode = async () => {
        if (!episodeId) return;

        try {
            setLoading(true);
            setError(null);
            const token = await storageService.getAccessToken();
            const data = await episodeService.getEpisode(episodeId, token || undefined);
            setEpisode(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load episode');
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = async () => {
        if (episode) {
            if (currentEpisode?.id === episode.id) {
                // Already playing this episode, go to player
                router.push(`/episodes/${episode.id}/play`);
            } else {
                // Start playing and navigate to player
                await play(episode);
                router.push(`/episodes/${episode.id}/play`);
            }
        }
    };

    const handleShare = async () => {
        if (episode) {
            try {
                await Share.share({
                    message: `Check out "${episode.title}" on Auditure!`,
                });
                await episodeService.share(episode.id);
            } catch (error) {
                console.error('Error sharing:', error);
            }
        }
    };

    const handleLike = async () => {
        if (!episode) return;

        try {
            const token = await storageService.getAccessToken();
            if (!token) {
                // User not logged in, could show login prompt
                return;
            }

            if (isLiked) {
                await episodeService.unlike(episode.id, token);
                setIsLiked(false);
            } else {
                await episodeService.like(episode.id, token);
                setIsLiked(true);
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return 'Unknown duration';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins} min`;
    };

    const getStatusText = (status?: string): string => {
        switch (status) {
            case 'SCRIPT_GENERATING':
                return 'Creating your podcast script...';
            case 'FETCHING_DATA':
                return 'Preparing book content...';
            case 'SCRIPT_GENERATED':
                return 'Script ready, generating audio...';
            case 'AUDIO_GENERATING':
                return 'Converting to audio...';
            case 'COMPLETED':
                return 'Episode ready!';
            case 'FAILED':
                return 'Generation failed';
            default:
                return 'Starting generation...';
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
                <ActivityIndicator size="large" color="#BF9A54" />
            </SafeAreaView>
        );
    }

    if (error || !episode) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center px-6">
                <Ionicons name="alert-circle-outline" size={48} color="#920002" />
                <Text className="font-inter text-[#920002] text-center mt-4">
                    {error || 'Episode not found'}
                </Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="mt-6 bg-brand-gold px-6 py-3 rounded-full"
                >
                    <Text className="font-inter-medium text-white">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const isCurrentlyPlaying = currentEpisode?.id === episode.id && isPlaying;

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-brand-beige">
            <ScrollView showsVerticalScrollIndicator={false} className="pb-32">
                {/* Header */}
                <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <Ionicons name="arrow-back" size={24} color="#1A1C1E" />
                    </TouchableOpacity>
                    <Text className="font-jakarta-bold text-lg text-[#1A1C1E]">
                        About
                    </Text>
                    <TouchableOpacity
                        onPress={handleLike}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <Ionicons
                            name={isLiked ? 'heart' : 'heart-outline'}
                            size={24}
                            color={isLiked ? '#E8847C' : '#E8847C'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Book Cover */}
                <View className="px-6 pt-4 items-center">
                    <View className="h-72 rounded-xl overflow-hidden shadow-lg bg-brand-input">
                        {episode.book?.coverImageUrl ? (
                            <Image
                                source={{ uri: episode.book.coverImageUrl }}
                                style={{ width: 192, height: 288 }}
                                resizeMode="contain"
                            />
                        ) : (
                            <View className="w-48 h-72 bg-brand-gold/20 items-center justify-center">
                                <Ionicons name="book" size={48} color="#BF9A54" />
                            </View>
                        )}
                    </View>
                </View>

                {/* Title Row with Play Button */}
                <View className="px-6 mt-6 flex-row items-start">
                    <View className="flex-1 pr-4">
                        {/* Episode Title */}
                        <Text className="font-jakarta-bold text-2xl text-[#1A1C1E]">
                            {episode.title}
                        </Text>

                        {/* Podcaster Name */}
                        <Text className="font-inter text-[#858585] mt-1">
                            By {episode.podcaster?.name || 'Virtual Podcaster'}
                        </Text>
                    </View>

                    {/* Play Button - positioned to right of title */}
                    {!isGenerating && episode.generationStatus !== 'FAILED' && (
                        <TouchableOpacity
                            onPress={handlePlay}
                            className="w-14 h-14 rounded-full bg-brand-red items-center justify-center shadow-lg"
                        >
                            <Ionicons
                                name={isCurrentlyPlaying ? 'pause' : 'play'}
                                size={24}
                                color="white"
                            />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats Row */}
                <View className="flex-row items-center px-6 mt-4 space-x-6">
                    {/* Rating */}
                    <View className="flex-row items-center">
                        <Ionicons name="star" size={18} color="#E8847C" />
                        <Text className="font-inter-medium text-[#1A1C1E] ml-1.5">4.5</Text>
                    </View>

                    {/* Language */}
                    <View className="flex-row items-center">
                        <Text className="text-lg">🈯</Text>
                        <Text className="font-inter-medium text-[#1A1C1E] ml-1.5">English</Text>
                    </View>

                    {/* Duration */}
                    <View className="flex-row items-center">
                        <Ionicons name="mic" size={18} color="#E8847C" />
                        <Text className="font-inter-medium text-[#1A1C1E] ml-1.5">
                            {formatDuration(episode.duration)}
                        </Text>
                    </View>
                </View>

                {/* Generation Progress (if generating) */}
                {isGenerating && (
                    <View className="px-6 mt-4">
                        <View className="bg-brand-input rounded-2xl p-4">
                            <View className="flex-row items-center justify-between mb-2">
                                <View className="flex-row items-center">
                                    <ActivityIndicator size="small" color="#BF9A54" />
                                    <Text className="font-inter-medium text-[#1A1C1E] ml-2">
                                        Generating...
                                    </Text>
                                </View>
                                <Text className="font-jakarta-bold text-brand-gold">
                                    {generationProgress?.progress ?? 0}%
                                </Text>
                            </View>
                            <View className="h-2 bg-[#E8E3D6] rounded-full overflow-hidden">
                                <View
                                    className="h-full bg-brand-gold rounded-full"
                                    style={{ width: `${generationProgress?.progress ?? 0}%` }}
                                />
                            </View>
                            <Text className="font-inter text-[#858585] text-xs mt-2 text-center">
                                {getStatusText(generationProgress?.status)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Generation Failed */}
                {episode.generationStatus === 'FAILED' && (
                    <View className="px-6 mt-4">
                        <View className="bg-[#920002]/10 rounded-xl p-4 flex-row items-center">
                            <Ionicons name="alert-circle" size={20} color="#920002" />
                            <Text className="font-inter text-[#920002] ml-2 flex-1">
                                Generation failed. Please try again.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Tabs */}
                <View className="flex-row px-6 mt-6 border-b border-[#E8E3D6]">
                    <TouchableOpacity className="pb-3 mr-8 border-b-2 border-brand-red">
                        <Text className="font-inter-medium text-brand-red">Summary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="pb-3 mr-8">
                        <Text className="font-inter text-[#858585]">Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="pb-3 mr-8">
                        <Text className="font-inter text-[#858585]">Author</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="pb-3">
                        <Text className="font-inter text-[#858585]">Reviews</Text>
                    </TouchableOpacity>
                </View>

                {/* Summary / Script Content */}
                <View className="px-6 mt-4 mb-32">
                    <Text className="font-inter text-[#666666] leading-6 text-base">
                        {episode.scriptContent
                            ? episode.scriptContent.substring(0, 800).replace(/^(HOST|GUEST|NARRATOR|HOST1|GUEST1|GUEST2):\s*/gim, '') + '...'
                            : episode.description ||
                              `An engaging podcast episode about "${episode.book?.title || 'this book'}". Listen to discover insights and perspectives on this fascinating book.`}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
