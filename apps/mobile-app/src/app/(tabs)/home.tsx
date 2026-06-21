import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { TopBar, EpisodeSection, BookSection, PodcasterSection, FeaturedEpisodeSection, FeaturedBookSection } from '@/components';
import { HomeSkeleton } from '@/components/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayback } from '@/contexts/PlaybackContext';
import { useIsDark } from '@/hooks/use-colors';
import { Episode } from '@/services/episode.service';
import {
    feedService,
    EpisodesFeedResponse,
    BooksFeedResponse,
    PodcastersFeedResponse,
    EpisodeFeedItem,
    BookFeedItem,
    PodcasterFeedItem,
} from '@/services/feed.service';

type TabType = 'episodes' | 'books' | 'podcasters';

// How long a tab's feed stays "fresh" before a focus/tab-switch triggers a background refresh.
const FEED_STALE_MS = 60_000;

const TABS: { key: TabType; label: string }[] = [
    { key: 'episodes', label: 'Episodes' },
    { key: 'books', label: 'Books' },
    { key: 'podcasters', label: 'Virtual podcasters' },
];

const adaptFeedItemToEpisode = (item: EpisodeFeedItem): Episode => ({
    ...item,
    userId: '',
    podcasterId: item.podcaster?.id || '',
    bookId: item.book?.id || '',
    contentCoverage: 'ENTIRE_BOOK' as const,
    chapters: [],
    episodeType: 'MONOLOGUE' as const,
    episodeTheme: 'LECTURE' as const,
    targetLengthMin: 0,
    targetLengthMax: 0,
    voiceTier: 'STANDARD' as const,
    generationStatus: 'COMPLETED' as const,
    isPublic: true,
    shareCount: 0,
    averageRating: item.averageRating || 0,
    ratingCount: item.ratingCount || 0,
    updatedAt: item.createdAt,
});

export default function HomeScreen() {
    const { getAccessToken, isAuthenticated, user } = useAuth();
    const { setQueue } = usePlayback();
    const isDark = useIsDark();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('episodes');

    // Last successful fetch time per tab, used to decide when a refresh is worth it.
    const lastFetchedRef = useRef<Record<TabType, number>>({ episodes: 0, books: 0, podcasters: 0 });

    // Feed data
    const [episodesFeed, setEpisodesFeed] = useState<EpisodesFeedResponse | null>(null);
    const [booksFeed, setBooksFeed] = useState<BooksFeedResponse | null>(null);
    const [podcastersFeed, setPodcastersFeed] = useState<PodcastersFeedResponse | null>(null);

    // Loading states
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch feed data
    const fetchFeed = async (tab: TabType, isRefreshing: boolean = false) => {
        try {
            if (!isRefreshing) setLoading(true);
            setError(null);
            // Claim freshness up front so a concurrent focus/mount effect skips a duplicate fetch.
            lastFetchedRef.current[tab] = Date.now();

            const token = await getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            switch (tab) {
                case 'episodes':
                    const episodesData = await feedService.getEpisodesFeed(token);
                    setEpisodesFeed(episodesData);
                    break;
                case 'books':
                    const booksData = await feedService.getBooksFeed(token);
                    setBooksFeed(booksData);
                    break;
                case 'podcasters':
                    const podcastersData = await feedService.getPodcastersFeed(token);
                    setPodcastersFeed(podcastersData);
                    break;
            }

            lastFetchedRef.current[tab] = Date.now();
        } catch (err: any) {
            console.error(`[HomeScreen] Error fetching ${tab} feed:`, err);
            setError(err.message || 'Failed to load feed');
            // Allow the next focus/tab-switch to retry instead of treating it as fresh.
            lastFetchedRef.current[tab] = 0;
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Initial load
    useEffect(() => {
        if (isAuthenticated && Date.now() - lastFetchedRef.current[activeTab] > FEED_STALE_MS) {
            fetchFeed(activeTab);
        }
    }, [isAuthenticated]);

    // Refresh on focus, but only if the active tab's feed has gone stale.
    useFocusEffect(
        useCallback(() => {
            if (!isAuthenticated) return;
            const isStale = Date.now() - lastFetchedRef.current[activeTab] > FEED_STALE_MS;
            if (isStale) {
                fetchFeed(activeTab, true);
            }
        }, [activeTab, isAuthenticated])
    );

    // Handle tab change
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        const feedData = tab === 'episodes' ? episodesFeed : tab === 'books' ? booksFeed : podcastersFeed;
        const isStale = Date.now() - lastFetchedRef.current[tab] > FEED_STALE_MS;
        if (!feedData) {
            // No cached data yet — show the skeleton while loading.
            fetchFeed(tab);
        } else if (isStale) {
            // Have data but it's stale — refresh in the background without flashing the skeleton.
            fetchFeed(tab, true);
        }
    };

    // Handle refresh
    const onRefresh = () => {
        setRefreshing(true);
        fetchFeed(activeTab, true);
    };

    // Navigation handlers
    const handleEpisodePressWithQueue = (episode: EpisodeFeedItem, sectionItems: EpisodeFeedItem[]) => {
        setQueue(sectionItems.map(adaptFeedItemToEpisode));
        router.push(`/episodes/${episode.id}`);
    };

    const handleBookPress = (book: BookFeedItem) => {
        router.push(`/${book.id}`);
    };

    const handlePodcasterPress = (podcaster: PodcasterFeedItem) => {
        router.push(`/podcasts/${podcaster.id}`);
    };

    // See All handlers
    const handleSeeAll = (sectionId: string) => {
        router.push(`/feed/see-all?section=${sectionId}&tab=${activeTab}`);
    };

    // Render Discover header
    const renderDiscoverHeader = () => {
        const firstName = user?.firstName?.trim();
        const hour = new Date().getHours();
        const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        const greeting = firstName ? `Good ${timeOfDay}, ${firstName}` : 'Discover';

        return (
            <View className="px-5 pt-2 pb-2">
                <Text className="font-inter-bold text-2xl text-brand-black dark:text-brand-dark-text">{greeting}</Text>
                <Text className="font-jakarta text-brand-black dark:text-brand-dark-text text-sm">Podcast feed catered to you.</Text>
            </View>
        );
    };

    // Render tab selector
    const renderTabSelector = () => (
        <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 10 }}>
            {TABS.map((tab) => (
                <TouchableOpacity
                    key={tab.key}
                    onPress={() => handleTabChange(tab.key)}
                    style={{
                        marginRight: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 18,
                        backgroundColor: activeTab === tab.key ? '#920002' : (isDark ? '#2A2C2E' : '#E7E0CB'),
                        borderWidth: activeTab === tab.key ? 0 : 1,
                        borderColor: isDark ? '#2A2C2E' : '#E7E0CB',
                    }}
                >
                    <Text
                        className={`font-inter-medium text-sm ${
                            activeTab === tab.key ? 'text-white' : 'text-brand-black dark:text-brand-dark-text'
                        }`}
                    >
                        {tab.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    // Render episodes tab content.
    // Renders whatever sections the backend returns, in order, so new feed
    // sections appear automatically without a frontend change. The
    // "continue_listening" section uses the featured-card layout; the rest
    // use the standard horizontal row.
    const renderEpisodesTab = () => {
        if (!episodesFeed) return null;

        return (
            <>
                {episodesFeed.sections
                    .filter(section => section.items.length > 0)
                    .map((section) => {
                        if (section.id === 'continue_listening') {
                            return (
                                <FeaturedEpisodeSection
                                    key={section.id}
                                    title={section.title}
                                    episodes={section.items}
                                    onEpisodePress={(ep) => handleEpisodePressWithQueue(ep, section.items)}
                                    showSeeAll={section.hasMore}
                                    onSeeAll={() => handleSeeAll(section.id)}
                                />
                            );
                        }

                        const episodes = section.items.map(adaptFeedItemToEpisode);
                        return (
                            <EpisodeSection
                                key={section.id}
                                title={section.title}
                                episodes={episodes}
                                onEpisodePress={(episode) => {
                                    setQueue(episodes);
                                    router.push(`/episodes/${episode.id}`);
                                }}
                                showSeeAll={section.hasMore}
                                onSeeAll={() => handleSeeAll(section.id)}
                            />
                        );
                    })}
            </>
        );
    };

    // Render books tab content
    const renderBooksTab = () => {
        if (!booksFeed) return null;

        // Find sections by id
        const inspirationsSection = booksFeed.sections.find(s => s.id === 'popular_inspirations');
        const popularSection = booksFeed.sections.find(s => s.id === 'popular_books');
        const latestSection = booksFeed.sections.find(s => s.id === 'latest_books');

        return (
            <>
                {/* Popular podcast inspirations - Featured Cards */}
                {inspirationsSection && inspirationsSection.items.length > 0 && (
                    <FeaturedBookSection
                        title={inspirationsSection.title}
                        books={inspirationsSection.items}
                        onBookPress={handleBookPress}
                        showSeeAll={inspirationsSection.hasMore}
                        onSeeAll={() => handleSeeAll('popular_inspirations')}
                    />
                )}

                {/* Popular Books */}
                {popularSection && popularSection.items.length > 0 && (
                    <BookSection
                        title={popularSection.title}
                        books={popularSection.items}
                        onBookPress={handleBookPress}
                        showSeeAll={popularSection.hasMore}
                        onSeeAll={() => handleSeeAll('popular_books')}
                    />
                )}

                {/* Latest Books */}
                {latestSection && latestSection.items.length > 0 && (
                    <BookSection
                        title={latestSection.title}
                        books={latestSection.items}
                        onBookPress={handleBookPress}
                        showSeeAll={latestSection.hasMore}
                        onSeeAll={() => handleSeeAll('latest_books')}
                    />
                )}

            </>
        );
    };

    // Render podcasters tab content
    const renderPodcastersTab = () => {
        if (!podcastersFeed) return null;

        // Find sections by id
        const trendingSection = podcastersFeed.sections.find(s => s.id === 'trending');
        const topRatedSection = podcastersFeed.sections.find(s => s.id === 'top_rated');
        const newVoicesSection = podcastersFeed.sections.find(s => s.id === 'new_voices');

        return (
            <>
                {/* Trending */}
                {trendingSection && trendingSection.items.length > 0 && (
                    <PodcasterSection
                        title={trendingSection.title}
                        podcasters={trendingSection.items}
                        onPodcasterPress={handlePodcasterPress}
                        showSeeAll={trendingSection.hasMore}
                        onSeeAll={() => handleSeeAll('trending')}
                    />
                )}

                {/* Top Rated */}
                {topRatedSection && topRatedSection.items.length > 0 && (
                    <PodcasterSection
                        title={topRatedSection.title}
                        podcasters={topRatedSection.items}
                        onPodcasterPress={handlePodcasterPress}
                        showSeeAll={topRatedSection.hasMore}
                        onSeeAll={() => handleSeeAll('top_rated')}
                    />
                )}

                {/* New Voices */}
                {newVoicesSection && newVoicesSection.items.length > 0 && (
                    <PodcasterSection
                        title={newVoicesSection.title}
                        podcasters={newVoicesSection.items}
                        onPodcasterPress={handlePodcasterPress}
                        showSeeAll={newVoicesSection.hasMore}
                        onSeeAll={() => handleSeeAll('new_voices')}
                    />
                )}
            </>
        );
    };

    // Render content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'episodes':
                return renderEpisodesTab();
            case 'books':
                return renderBooksTab();
            case 'podcasters':
                return renderPodcastersTab();
        }
    };

    // Render empty state
    const renderEmptyState = () => {
        const label = activeTab === 'episodes' ? 'episodes' : activeTab === 'books' ? 'books' : 'podcasters';
        return (
            <View className="flex-1 items-center justify-center py-20">
                <Text className="font-inter-medium text-lg text-[#858585] dark:text-brand-dark-text-secondary">
                    No {label} yet
                </Text>
                <Text className="font-inter text-sm text-[#A0A0A0] mt-2 text-center px-10">
                    New {label} land here as the community publishes them. Pull to refresh or check back soon.
                </Text>
                <TouchableOpacity
                    onPress={() => fetchFeed(activeTab)}
                    className="mt-5 px-6 py-2 bg-brand-red rounded-full"
                >
                    <Text className="font-inter-medium text-white">Refresh</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // Render error state
    const renderErrorState = () => (
        <View className="flex-1 items-center justify-center py-20">
            <Text className="font-inter-medium text-lg text-brand-red">
                Something went wrong
            </Text>
            <Text className="font-inter text-sm text-[#858585] dark:text-brand-dark-text-secondary mt-2 text-center px-10">
                {error}
            </Text>
            <TouchableOpacity
                onPress={() => fetchFeed(activeTab)}
                className="mt-4 px-6 py-2 bg-brand-red rounded-full"
            >
                <Text className="font-inter-medium text-white">Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    // Check if current tab has content
    const hasContent = () => {
        switch (activeTab) {
            case 'episodes':
                return episodesFeed && episodesFeed.sections.length > 0;
            case 'books':
                return booksFeed && booksFeed.sections.length > 0;
            case 'podcasters':
                return podcastersFeed && podcastersFeed.sections.length > 0;
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg" edges={['top', 'left', 'right']}>
            <TopBar />

            {/* Discover Header */}
            {renderDiscoverHeader()}

            {/* Tab Selector */}
            {renderTabSelector()}

            {/* Content */}
            {loading && !refreshing ? (
                <HomeSkeleton activeTab={activeTab} />
            ) : error ? (
                renderErrorState()
            ) : (
                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#920002"
                            colors={['#920002']}
                        />
                    }
                >
                    <View className="pt-4">
                        {hasContent() ? renderTabContent() : renderEmptyState()}
                    </View>

                    {/* Bottom padding for tab bar */}
                    <View className="h-24" />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
