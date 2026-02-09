import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Episode, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { downloadService } from '@/services/download.service';
import { usePlayback } from '@/contexts/PlaybackContext';
import { EpisodeSection } from '@/components/EpisodeSection';
import { GeneratingEpisodeCard } from '@/components/GeneratingEpisodeCard';
import { TopBar } from '@/components';
import { EpisodesSkeleton } from '@/components/skeleton';

export default function EpisodesScreen() {
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Categorized episodes
    const [generatingEpisodes, setGeneratingEpisodes] = useState<Episode[]>([]);
    const [myEpisodes, setMyEpisodes] = useState<Episode[]>([]);
    const [likedEpisodes, setLikedEpisodes] = useState<Episode[]>([]);
    const [downloadedEpisodes, setDownloadedEpisodes] = useState<Episode[]>([]);
    const [startedEpisodes, setStartedEpisodes] = useState<Episode[]>([]);

    const { setQueue } = usePlayback();

    const fetchEpisodes = async (isRefreshing: boolean = false) => {
        try {
            if (isRefreshing) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const token = await storageService.getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            const [data, liked] = await Promise.all([
                episodeService.getMyEpisodes(token),
                episodeService.getLikedEpisodes(token).catch(() => [] as Episode[]),
            ]);
            setEpisodes(data);
            setLikedEpisodes(liked);
            categorizeEpisodes(data);
        } catch (err: any) {
            console.error('Error fetching episodes:', err);
            setError(err.message || 'Failed to load episodes');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const categorizeEpisodes = async (allEpisodes: Episode[]) => {
        // Episodes currently being generated
        const generating = allEpisodes.filter(ep =>
            ['PENDING', 'SCRIPT_GENERATING', 'SCRIPT_GENERATED', 'AUDIO_GENERATING', 'FAILED'].includes(ep.generationStatus)
        );
        setGeneratingEpisodes(generating);

        // Completed episodes (My Episodes)
        const completed = allEpisodes.filter(ep => ep.generationStatus === 'COMPLETED');
        setMyEpisodes(completed);

        // Started episodes (played at least once, within the last 30 days)
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
        setStartedEpisodes(
            completed
                .filter(ep => ep.playCount > 0 && new Date(ep.updatedAt) >= oneMonthAgo)
                .slice(0, 10)
        );

        // Check which episodes are actually downloaded locally
        const downloaded: Episode[] = [];
        for (const ep of completed) {
            const format = ep.audioFormat || 'mp3';
            const isLocal = await downloadService.isDownloaded(ep.id, format);
            if (isLocal) downloaded.push(ep);
        }
        setDownloadedEpisodes(downloaded);
    };

    useEffect(() => {
        fetchEpisodes();
    }, []);

    // Refresh when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchEpisodes();
        }, [])
    );

    // Poll for updates on generating episodes
    useEffect(() => {
        if (generatingEpisodes.length > 0) {
            const interval = setInterval(() => {
                fetchEpisodes(true);
            }, 10000); // Poll every 10 seconds

            return () => clearInterval(interval);
        }
    }, [generatingEpisodes.length]);

    const onRefresh = () => {
        fetchEpisodes(true);
    };

    const handleMyEpisodePress = (episode: Episode) => {
        setQueue(myEpisodes);
        router.push(`/episodes/${episode.id}`);
    };

    const handleLikedEpisodePress = (episode: Episode) => {
        setQueue(likedEpisodes);
        router.push(`/episodes/${episode.id}`);
    };

    const handleDownloadedEpisodePress = (episode: Episode) => {
        setQueue(downloadedEpisodes);
        router.push(`/episodes/${episode.id}`);
    };

    const handleStartedEpisodePress = (episode: Episode) => {
        setQueue(startedEpisodes);
        router.push(`/episodes/${episode.id}`);
    };

    const handleRetryEpisode = async (episode: Episode) => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            await episodeService.retry(episode.id, token);
            fetchEpisodes(true);
        } catch (err: any) {
            console.error('Error retrying episode:', err);
        }
    };

    const handleCancelEpisode = async (episode: Episode) => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            await episodeService.delete(episode.id, token);
            fetchEpisodes(true);
        } catch (err: any) {
            console.error('Error cancelling episode:', err);
        }
    };

    if (loading) {
        return (
            <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-brand-beige">
                <TopBar />
                <View className="px-6 pt-6 pb-6">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="font-inter-bold text-2xl text-brand-black">Episodes</Text>
                            <Text className="font-jakarta text-brand-black text-sm">
                                Manage and view your saved and generated episodes
                            </Text>
                        </View>
                    </View>
                </View>
                <EpisodesSkeleton />
            </SafeAreaView>
        );
    }

    const hasAnyEpisodes = episodes.length > 0;

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-brand-beige">
            <TopBar />
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BF9A54" />
                }
            >
                {/* Header */}
                <View className="px-6 pt-6 pb-6">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="font-inter-bold text-2xl text-brand-black">Episodes</Text>
                            <Text className="font-jakarta text-brand-black text-sm">
                                Manage and view your saved and generated episodes
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.push('/episodes/create')}
                            className="w-6 h-6 rounded-full border border-brand-gold items-center justify-center"
                        >
                            <Ionicons name="add" size={16} color="#BF9A54" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Error Message */}
                {error && (
                    <View className="mx-6 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <Text className="font-inter text-red-800">{error}</Text>
                        <TouchableOpacity onPress={() => fetchEpisodes()} className="mt-2">
                            <Text className="font-inter-medium text-red-600">Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Empty State */}
                {!hasAnyEpisodes && !error && (
                    <View className="items-center justify-center py-20 px-6">
                        <View className="w-24 h-24 bg-brand-gold/20 rounded-full items-center justify-center mb-4">
                            <Ionicons name="headset" size={48} color="#BF9A54" />
                        </View>
                        <Text className="font-inter-bold text-xl text-brand-black mb-2">No episodes yet</Text>
                        <Text className="font-inter text-[#858585] text-center mb-6">
                            Create your first episode to start listening to AI-generated podcasts from your books
                        </Text>
                        <TouchableOpacity
                            onPress={() => router.push('/episodes/create')}
                            className="bg-brand-red px-8 py-3 rounded-full"
                        >
                            <Text className="text-white font-inter-medium text-base">Create Episode</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Generating Episodes Section */}
                {generatingEpisodes.length > 0 && (
                    <View className="mb-6">
                        <View className="flex-row items-center justify-between mb-3 px-6">
                            <View className="flex-row items-center">
                                <Ionicons name="sync" size={18} color="#BF9A54" />
                                <Text className="font-inter-medium text-lg text-brand-black ml-2">
                                    Generating ({generatingEpisodes.length})
                                </Text>
                            </View>
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 24 }}
                        >
                            {generatingEpisodes.map((episode) => (
                                <GeneratingEpisodeCard
                                    key={episode.id}
                                    episode={episode}
                                    onPress={() => router.push(`/episodes/${episode.id}`)}
                                    onRetry={() => handleRetryEpisode(episode)}
                                    onCancel={() => handleCancelEpisode(episode)}
                                />
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* My Episodes Section */}
                <EpisodeSection
                    title="My Episodes"
                    episodes={myEpisodes}
                    onEpisodePress={handleMyEpisodePress}
                    showSeeAll={myEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=my')}
                />

                {/* Liked Episodes Section */}
                <EpisodeSection
                    title="Liked Episodes"
                    episodes={likedEpisodes}
                    onEpisodePress={handleLikedEpisodePress}
                    showSeeAll={likedEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=liked')}
                />

                {/* Downloads Section */}
                <EpisodeSection
                    title="Downloads"
                    episodes={downloadedEpisodes}
                    onEpisodePress={handleDownloadedEpisodePress}
                    showSeeAll={downloadedEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=downloads')}
                />

                {/* Pick up where you left off */}
                <EpisodeSection
                    title="Started episodes"
                    episodes={startedEpisodes}
                    onEpisodePress={handleStartedEpisodePress}
                    showSeeAll={startedEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=started')}
                />

                {/* Bottom padding for tab bar */}
                <View className="h-24" />
            </ScrollView>
        </SafeAreaView>
    );
}
