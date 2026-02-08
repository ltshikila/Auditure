import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Episode, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
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
    const [listenLaterEpisodes, setListenLaterEpisodes] = useState<Episode[]>([]);

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

    const categorizeEpisodes = (allEpisodes: Episode[]) => {
        // Episodes currently being generated
        const generating = allEpisodes.filter(ep =>
            ['PENDING', 'SCRIPT_GENERATING', 'SCRIPT_GENERATED', 'AUDIO_GENERATING', 'FAILED'].includes(ep.generationStatus)
        );
        setGeneratingEpisodes(generating);

        // Completed episodes (My Episodes)
        const completed = allEpisodes.filter(ep => ep.generationStatus === 'COMPLETED');
        setMyEpisodes(completed);

        // For now, we'll use some placeholder logic for other categories
        // In a real app, these would be stored locally or fetched from user preferences
        setDownloadedEpisodes(completed.slice(0, 3)); // Placeholder
        setStartedEpisodes(completed.filter(ep => ep.playCount > 0).slice(0, 3));
        setListenLaterEpisodes(completed.slice(0, 3)); // Placeholder
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

    const handleEpisodePress = (episode: Episode) => {
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
                                    onPress={() => handleEpisodePress(episode)}
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
                    onEpisodePress={handleEpisodePress}
                    showSeeAll={myEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=my')}
                />

                {/* Liked Episodes Section */}
                <EpisodeSection
                    title="Liked Episodes"
                    episodes={likedEpisodes}
                    onEpisodePress={handleEpisodePress}
                    showSeeAll={likedEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=liked')}
                />

                {/* Downloads Section */}
                <EpisodeSection
                    title="Downloads"
                    episodes={downloadedEpisodes}
                    onEpisodePress={handleEpisodePress}
                    showSeeAll={downloadedEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=downloads')}
                />

                {/* Started Episodes Section */}
                <EpisodeSection
                    title="Started episodes"
                    episodes={startedEpisodes}
                    onEpisodePress={handleEpisodePress}
                    showSeeAll={startedEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=started')}
                />

                {/* Listen to Later Section */}
                <EpisodeSection
                    title="Listen to later"
                    episodes={listenLaterEpisodes}
                    onEpisodePress={handleEpisodePress}
                    showSeeAll={listenLaterEpisodes.length > 3}
                    onSeeAll={() => router.push('/episodes/see-all?type=later')}
                />

                {/* Bottom padding for tab bar */}
                <View className="h-24" />
            </ScrollView>
        </SafeAreaView>
    );
}
