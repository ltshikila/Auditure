import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Episode, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { usePlayback } from '@/contexts/PlaybackContext';
import { resolveCoverUrl } from '@/services/api';
import { formatCount } from '@/utils/formatCount';
import { FeedListSkeleton } from '@/components/skeleton';

const backIcon = require('@/assets/icons/back.png');

type EpisodeListType = 'my' | 'liked' | 'downloads' | 'started' | 'later';

const TITLES: Record<EpisodeListType, string> = {
    my: 'My Episodes',
    liked: 'Liked Episodes',
    downloads: 'Downloads',
    started: 'Started Episodes',
    later: 'Listen to Later',
};

export default function EpisodesSeeAllScreen() {
    const { type } = useLocalSearchParams<{ type: string }>();
    const listType = (type as EpisodeListType) || 'my';
    const { setQueue } = usePlayback();

    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEpisodes = async (isRefreshing = false) => {
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

            let data: Episode[] = [];

            switch (listType) {
                case 'my':
                    data = await episodeService.getMyEpisodes(token);
                    data = data.filter(ep => ep.generationStatus === 'COMPLETED');
                    break;
                case 'liked':
                    data = await episodeService.getLikedEpisodes(token);
                    break;
                case 'started':
                    data = await episodeService.getMyEpisodes(token);
                    data = data.filter(ep => ep.generationStatus === 'COMPLETED' && ep.playCount > 0);
                    break;
                case 'downloads':
                case 'later':
                    // Placeholder — uses completed episodes for now
                    data = await episodeService.getMyEpisodes(token);
                    data = data.filter(ep => ep.generationStatus === 'COMPLETED');
                    break;
            }

            setEpisodes(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load episodes');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchEpisodes();
    }, [listType]);

    const onRefresh = () => fetchEpisodes(true);

    const handleEpisodePress = (episode: Episode) => {
        setQueue(episodes);
        router.push(`/episodes/${episode.id}`);
    };

    const formatDuration = (seconds?: number): string => {
        if (!seconds) return '';
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    };

    const renderEpisodeItem = ({ item }: { item: Episode }) => (
        <TouchableOpacity
            onPress={() => handleEpisodePress(item)}
            className="flex-row bg-[#F5F5F0] rounded-xl p-3 mb-3 mx-6 shadow-sm"
        >
            {/* Cover */}
            <View className="w-[70px] h-[90px] rounded-lg overflow-hidden bg-brand-input mr-3">
                {resolveCoverUrl(item.book?.coverImageUrl) ? (
                    <Image
                        source={{ uri: resolveCoverUrl(item.book?.coverImageUrl)! }}
                        style={{ width: 70, height: 90 }}
                        resizeMode="contain"
                    />
                ) : (
                    <View className="w-full h-full bg-brand-gold/20 items-center justify-center">
                        <Ionicons name="musical-notes" size={24} color="#BF9A54" />
                    </View>
                )}
            </View>

            {/* Info */}
            <View className="flex-1 justify-center">
                <Text className="font-inter-medium text-[#1A1C1E] text-base" numberOfLines={2}>
                    {item.title}
                </Text>
                <Text className="font-inter text-[#858585] text-sm mt-1" numberOfLines={1}>
                    {item.book?.title || 'Unknown Book'}
                </Text>
                <View className="flex-row items-center mt-2">
                    {item.duration && (
                        <>
                            <Ionicons name="time-outline" size={14} color="#858585" />
                            <Text className="font-inter text-[#858585] text-xs ml-1 mr-3">
                                {formatDuration(item.duration)}
                            </Text>
                        </>
                    )}
                    <Ionicons name="headset-outline" size={14} color="#858585" />
                    <Text className="font-inter text-[#858585] text-xs ml-1">
                        {formatCount(item.playCount)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const title = TITLES[listType] || 'Episodes';

    return (
        <SafeAreaView className="flex-1 bg-brand-beige" edges={['top', 'left', 'right']}>
            {/* Header */}
            <View className="flex-row items-center px-6 py-4 border-b border-gray-200">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2 mr-2">
                    <Image source={backIcon} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="font-jakarta-bold text-xl text-brand-black">{title}</Text>
                    {episodes.length > 0 && !loading && (
                        <Text className="font-inter text-sm text-[#858585]">
                            {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
                        </Text>
                    )}
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <FeedListSkeleton />
            ) : error ? (
                <View className="flex-1 items-center justify-center py-20">
                    <Text className="font-inter-medium text-lg text-brand-red">Something went wrong</Text>
                    <Text className="font-inter text-sm text-[#858585] mt-2 text-center px-10">{error}</Text>
                    <TouchableOpacity onPress={() => fetchEpisodes()} className="mt-4 px-6 py-2 bg-brand-red rounded-full">
                        <Text className="font-inter-medium text-white">Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={episodes}
                    renderItem={renderEpisodeItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingTop: 16 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#BF9A54" />
                    }
                    ListFooterComponent={<View className="h-24" />}
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center py-20">
                            <View className="w-16 h-16 bg-brand-gold/20 rounded-full items-center justify-center mb-3">
                                <Ionicons name="headset" size={32} color="#BF9A54" />
                            </View>
                            <Text className="font-inter-medium text-lg text-[#858585]">No episodes found</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
