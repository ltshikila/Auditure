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
            <ScrollView showsVerticalScrollIndicator={false}>
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
                            color={isLiked ? '#920002' : '#1A1C1E'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Cover and Info */}
                <View className="px-6 pt-6 items-center">
                    {/* Book Cover */}
                    <View className="w-48 h-72 rounded-xl overflow-hidden shadow-lg bg-brand-input">
                        {episode.book?.coverImageUrl ? (
                            <Image
                                source={{ uri: episode.book.coverImageUrl }}
                                className="w-full h-full"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-full h-full bg-brand-gold/20 items-center justify-center">
                                <Ionicons name="book" size={48} color="#BF9A54" />
                            </View>
                        )}
                    </View>

                    {/* Episode Title */}
                    <Text className="font-jakarta-bold text-2xl text-[#1A1C1E] text-center mt-6 px-4">
                        {episode.title}
                    </Text>

                    {/* Podcaster Name */}
                    {episode.podcaster?.name && (
                        <Text className="font-inter text-[#858585] text-center mt-1">
                            By {episode.podcaster.name}
                        </Text>
                    )}

                    {/* Stats Row */}
                    <View className="flex-row items-center mt-4 space-x-6">
                        {/* Rating - placeholder */}
                        <View className="flex-row items-center">
                            <Ionicons name="star" size={16} color="#BF9A54" />
                            <Text className="font-inter text-[#858585] ml-1">4.5</Text>
                        </View>

                        {/* Language - placeholder */}
                        <View className="flex-row items-center">
                            <Ionicons name="language" size={16} color="#858585" />
                            <Text className="font-inter text-[#858585] ml-1">English</Text>
                        </View>

                        {/* Duration */}
                        <View className="flex-row items-center">
                            <Ionicons name="time-outline" size={16} color="#858585" />
                            <Text className="font-inter text-[#858585] ml-1">
                                {formatDuration(episode.duration)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Tabs - Summary, Details, Author, Reviews */}
                <View className="flex-row px-6 mt-6 border-b border-[#E8E3D6]">
                    <TouchableOpacity className="pb-3 mr-6 border-b-2 border-brand-red">
                        <Text className="font-inter-medium text-brand-red">Summary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="pb-3 mr-6"
                        onPress={() => router.push(`/episodes/${episode.id}/play`)}
                    >
                        <Text className="font-inter text-[#858585]">Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="pb-3 mr-6">
                        <Text className="font-inter text-[#858585]">Author</Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="pb-3">
                        <Text className="font-inter text-[#858585]">Reviews</Text>
                    </TouchableOpacity>
                </View>

                {/* Description / Summary */}
                <View className="px-6 mt-4">
                    <Text className="font-inter text-[#666666] leading-6 text-base">
                        {episode.description ||
                            episode.book?.title
                            ? `An engaging podcast episode about "${episode.book?.title}". Listen to discover insights and perspectives on this fascinating book.`
                            : 'No description available for this episode.'}
                    </Text>
                </View>

                {/* Episode Info Cards */}
                <View className="px-6 mt-6 space-y-3">
                    {/* Play Count */}
                    <View className="flex-row items-center justify-between bg-white rounded-xl p-4">
                        <View className="flex-row items-center">
                            <Ionicons name="play-circle-outline" size={24} color="#BF9A54" />
                            <Text className="font-inter-medium text-[#1A1C1E] ml-3">
                                Play Count
                            </Text>
                        </View>
                        <Text className="font-inter text-[#858585]">
                            {episode.playCount} plays
                        </Text>
                    </View>

                    {/* Likes */}
                    <View className="flex-row items-center justify-between bg-white rounded-xl p-4">
                        <View className="flex-row items-center">
                            <Ionicons name="heart-outline" size={24} color="#BF9A54" />
                            <Text className="font-inter-medium text-[#1A1C1E] ml-3">
                                Likes
                            </Text>
                        </View>
                        <Text className="font-inter text-[#858585]">
                            {episode.likeCount} likes
                        </Text>
                    </View>

                    {/* Transcript Button */}
                    {episode.scriptContent && (
                        <TouchableOpacity
                            onPress={() => router.push(`/episodes/${episode.id}/transcript`)}
                            className="flex-row items-center justify-between bg-white rounded-xl p-4"
                        >
                            <View className="flex-row items-center">
                                <Ionicons
                                    name="document-text-outline"
                                    size={24}
                                    color="#BF9A54"
                                />
                                <Text className="font-inter-medium text-[#1A1C1E] ml-3">
                                    View Transcript
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#858585" />
                        </TouchableOpacity>
                    )}

                    {/* Share Button */}
                    <TouchableOpacity
                        onPress={handleShare}
                        className="flex-row items-center justify-between bg-white rounded-xl p-4"
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="share-social-outline" size={24} color="#BF9A54" />
                            <Text className="font-inter-medium text-[#1A1C1E] ml-3">
                                Share Episode
                            </Text>
                        </View>
                        <Text className="font-inter text-[#858585]">
                            {episode.shareCount} shares
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Play Button / Generation Progress */}
                <View className="px-6 mt-8 mb-32">
                    {isGenerating ? (
                        <View className="bg-brand-input rounded-2xl p-6">
                            {/* Progress Header */}
                            <View className="flex-row items-center justify-between mb-3">
                                <View className="flex-row items-center">
                                    <ActivityIndicator size="small" color="#BF9A54" />
                                    <Text className="font-inter-medium text-[#1A1C1E] ml-2">
                                        Generating Episode
                                    </Text>
                                </View>
                                <Text className="font-jakarta-bold text-brand-gold text-lg">
                                    {generationProgress?.progress ?? 0}%
                                </Text>
                            </View>

                            {/* Progress Bar */}
                            <View className="h-3 bg-[#E8E3D6] rounded-full overflow-hidden">
                                <View
                                    className="h-full bg-brand-gold rounded-full"
                                    style={{ width: `${generationProgress?.progress ?? 0}%` }}
                                />
                            </View>

                            {/* Status Text */}
                            <Text className="font-inter text-[#858585] text-sm mt-3 text-center">
                                {getStatusText(generationProgress?.status)}
                            </Text>
                        </View>
                    ) : episode.generationStatus === 'FAILED' ? (
                        <View className="bg-[#920002]/10 rounded-2xl p-6">
                            <View className="flex-row items-center justify-center mb-2">
                                <Ionicons name="alert-circle" size={24} color="#920002" />
                                <Text className="font-inter-medium text-[#920002] ml-2">
                                    Generation Failed
                                </Text>
                            </View>
                            <Text className="font-inter text-[#920002]/70 text-sm text-center">
                                There was an error generating this episode. Please try again.
                            </Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={handlePlay}
                            className="bg-brand-red rounded-full py-4 flex-row items-center justify-center shadow-lg"
                        >
                            <Ionicons
                                name={isCurrentlyPlaying ? 'pause' : 'play'}
                                size={24}
                                color="white"
                            />
                            <Text className="font-inter-bold text-white text-lg ml-2">
                                {isCurrentlyPlaying ? 'Playing' : 'Play Episode'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
