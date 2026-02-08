import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { FeedListSkeleton } from '@/components/skeleton';

const booksIcon = require('@/assets/icons/books_fill.png');
const podcastIcon = require('@/assets/icons/podcast.png');
import {
    feedService,
    EpisodeFeedItem,
    BookFeedItem,
    PodcasterFeedItem,
    SectionId,
} from '@/services/feed.service';
import { resolveCoverUrl } from '@/services/api';

// Section titles mapping
const SECTION_TITLES: Record<string, string> = {
    continue_listening: 'Continue Listening',
    popular: 'Popular Episodes',
    latest: 'Latest Episodes',
    recommended: 'Recommended',
    popular_inspirations: 'Popular Inspirations',
    popular_books: 'Popular Books',
    latest_books: 'Latest Books',
    bestsellers: 'Bestsellers',
    trending: 'Trending Podcasters',
    top_rated: 'Top Rated',
    new_voices: 'New Voices',
};

// Determine item type based on section
const getItemType = (section: string): 'episode' | 'book' | 'podcaster' => {
    if (['continue_listening', 'popular', 'latest', 'recommended'].includes(section)) {
        return 'episode';
    }
    if (['popular_inspirations', 'popular_books', 'latest_books', 'bestsellers'].includes(section)) {
        return 'book';
    }
    return 'podcaster';
};

export default function SeeAllScreen() {
    const { section } = useLocalSearchParams<{ section: string }>();
    const { getAccessToken } = useAuth();

    const [items, setItems] = useState<(EpisodeFeedItem | BookFeedItem | PodcasterFeedItem)[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    const itemType = getItemType(section || '');
    const title = SECTION_TITLES[section || ''] || 'Browse';

    // Fetch data
    const fetchData = async (pageNum: number, isRefreshing: boolean = false) => {
        try {
            if (isRefreshing) {
                setRefreshing(true);
            } else if (pageNum === 1) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }
            setError(null);

            const token = await getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            const response = await feedService.getSectionData(
                section as SectionId,
                token,
                pageNum,
                20
            );

            if (pageNum === 1 || isRefreshing) {
                setItems(response.items);
            } else {
                setItems((prev) => [...prev, ...response.items]);
            }

            setHasMore(response.hasMore);
            setTotalCount(response.totalCount);
            setPage(pageNum);
        } catch (err: any) {
            console.error('[SeeAllScreen] Error fetching data:', err);
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
        }
    };

    // Initial load
    useEffect(() => {
        if (section) {
            fetchData(1);
        }
    }, [section]);

    // Handle refresh
    const onRefresh = () => {
        fetchData(1, true);
    };

    // Handle load more
    const onLoadMore = () => {
        if (!loadingMore && hasMore) {
            fetchData(page + 1);
        }
    };

    // Navigation handlers
    const handleItemPress = (item: EpisodeFeedItem | BookFeedItem | PodcasterFeedItem) => {
        if (itemType === 'episode') {
            router.push(`/episodes/${item.id}`);
        } else if (itemType === 'book') {
            router.push(`/${item.id}`);
        } else {
            router.push(`/podcasts/${item.id}`);
        }
    };

    // Format duration
    const formatDuration = (ms?: number): string => {
        if (!ms) return '';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        return `${minutes}m`;
    };

    // Format number
    const formatNumber = (num: number): string => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    // Render episode item
    const renderEpisodeItem = ({ item }: { item: EpisodeFeedItem }) => (
        <TouchableOpacity
            onPress={() => handleItemPress(item)}
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
                        {formatNumber(item.playCount)}
                    </Text>
                </View>
            </View>

            {/* Progress indicator for continue listening */}
            {item.progressPercent !== undefined && item.progressPercent > 0 && (
                <View className="absolute bottom-0 left-3 right-3 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <View
                        className="h-full bg-brand-red"
                        style={{ width: `${item.progressPercent}%` }}
                    />
                </View>
            )}
        </TouchableOpacity>
    );

    // Render book item
    const renderBookItem = ({ item }: { item: BookFeedItem }) => (
        <TouchableOpacity
            onPress={() => handleItemPress(item)}
            className="flex-row bg-[#F5F5F0] rounded-xl p-3 mb-3 mx-6 shadow-sm"
        >
            {/* Cover */}
            <View className="w-[70px] h-[100px] rounded-lg overflow-hidden bg-brand-input mr-3">
                {resolveCoverUrl(item.coverImageUrl) ? (
                    <Image
                        source={{ uri: resolveCoverUrl(item.coverImageUrl)! }}
                        style={{ width: 70, height: 100 }}
                        resizeMode="contain"
                    />
                ) : (
                    <View className="w-full h-full bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 items-center justify-center">
                        <Image source={booksIcon} style={{ width: 26, height: 26, tintColor: '#BF9A54' }} />
                    </View>
                )}
            </View>

            {/* Info */}
            <View className="flex-1 justify-center">
                <Text className="font-inter-medium text-[#1A1C1E] text-base" numberOfLines={2}>
                    {item.title}
                </Text>
                <Text className="font-inter text-[#858585] text-sm mt-1" numberOfLines={1}>
                    {item.author || 'Unknown Author'}
                </Text>
                <View className="flex-row items-center mt-2">
                    {item.episodeCount !== undefined && item.episodeCount > 0 && (
                        <>
                            <Ionicons name="mic-outline" size={14} color="#BF9A54" />
                            <Text className="font-inter text-brand-gold text-xs ml-1">
                                {item.episodeCount} episode{item.episodeCount !== 1 ? 's' : ''}
                            </Text>
                        </>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    // Render podcaster item
    const renderPodcasterItem = ({ item }: { item: PodcasterFeedItem }) => (
        <TouchableOpacity
            onPress={() => handleItemPress(item)}
            className="flex-row bg-[#F5F5F0] rounded-xl p-3 mb-3 mx-6 shadow-sm"
        >
            {/* Profile Picture */}
            <View className="w-[70px] h-[70px] rounded-full overflow-hidden bg-brand-input mr-3">
                {resolveCoverUrl(item.profilePictureUrl) ? (
                    <Image
                        source={{ uri: resolveCoverUrl(item.profilePictureUrl)! }}
                        style={{ width: 70, height: 70 }}
                        resizeMode="cover"
                    />
                ) : (
                    <View className="w-full h-full bg-[#E8E3D6] items-center justify-center">
                        <Image source={podcastIcon} style={{ width: 28, height: 28, tintColor: '#BF9A54' }} />
                    </View>
                )}
            </View>

            {/* Info */}
            <View className="flex-1 justify-center">
                <Text className="font-inter-medium text-[#1A1C1E] text-base" numberOfLines={1}>
                    {item.name}
                </Text>
                {item.bio && (
                    <Text className="font-inter text-[#858585] text-sm mt-1" numberOfLines={2}>
                        {item.bio}
                    </Text>
                )}
                <View className="flex-row items-center mt-2">
                    {item.averageRating > 0 && (
                        <>
                            <Ionicons name="star" size={14} color="#BF9A54" />
                            <Text className="font-inter text-[#858585] text-xs ml-1 mr-3">
                                {item.averageRating.toFixed(1)}
                            </Text>
                        </>
                    )}
                    <Ionicons name="headset-outline" size={14} color="#858585" />
                    <Text className="font-inter text-[#858585] text-xs ml-1">
                        {formatNumber(item.playCount)}
                    </Text>
                </View>
                {item.expertiseTags && item.expertiseTags.length > 0 && (
                    <View className="flex-row flex-wrap mt-2">
                        {item.expertiseTags.slice(0, 3).map((tag, index) => (
                            <View key={index} className="bg-brand-gold/10 px-2 py-0.5 rounded mr-1 mb-1">
                                <Text className="font-inter text-brand-gold text-xs">{tag}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    // Render item based on type
    const renderItem = ({ item }: { item: EpisodeFeedItem | BookFeedItem | PodcasterFeedItem }) => {
        if (itemType === 'episode') {
            return renderEpisodeItem({ item: item as EpisodeFeedItem });
        } else if (itemType === 'book') {
            return renderBookItem({ item: item as BookFeedItem });
        } else {
            return renderPodcasterItem({ item: item as PodcasterFeedItem });
        }
    };

    // Render footer (loading more indicator)
    const renderFooter = () => {
        if (!loadingMore) return <View className="h-24" />;
        return (
            <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#920002" />
            </View>
        );
    };

    // Render empty state
    const renderEmptyState = () => (
        <View className="flex-1 items-center justify-center py-20">
            <Text className="font-inter-medium text-lg text-[#858585]">No items found</Text>
        </View>
    );

    // Render error state
    const renderErrorState = () => (
        <View className="flex-1 items-center justify-center py-20">
            <Text className="font-inter-medium text-lg text-brand-red">Something went wrong</Text>
            <Text className="font-inter text-sm text-[#858585] mt-2 text-center px-10">{error}</Text>
            <TouchableOpacity
                onPress={() => fetchData(1)}
                className="mt-4 px-6 py-2 bg-brand-red rounded-full"
            >
                <Text className="font-inter-medium text-white">Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-brand-beige" edges={['top', 'left', 'right']}>
            {/* Header */}
            <View className="flex-row items-center px-6 py-4 border-b border-gray-200">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center -ml-2 mr-2">
                    <Image source={require('../../assets/icons/back.png')} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="font-jakarta-bold text-xl text-brand-black">{title}</Text>
                    {totalCount > 0 && (
                        <Text className="font-inter text-sm text-[#858585]">
                            {totalCount} {itemType}{totalCount !== 1 ? 's' : ''}
                        </Text>
                    )}
                </View>
            </View>

            {/* Content */}
            {loading ? (
                <FeedListSkeleton />
            ) : error ? (
                renderErrorState()
            ) : (
                <FlatList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingTop: 16 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#920002"
                            colors={['#920002']}
                        />
                    }
                    onEndReached={onLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={renderEmptyState}
                />
            )}
        </SafeAreaView>
    );
}
