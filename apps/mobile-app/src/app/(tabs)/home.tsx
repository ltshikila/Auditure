import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { TopBar, EpisodeSection, BookSection, PodcasterSection, ContinueListeningSection } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
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

const TABS: { key: TabType; label: string }[] = [
    { key: 'episodes', label: 'Episodes' },
    { key: 'books', label: 'Books' },
    { key: 'podcasters', label: 'Virtual podcasters' },
];

export default function HomeScreen() {
    const { getAccessToken, isAuthenticated } = useAuth();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('episodes');

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
        } catch (err: any) {
            console.error(`[HomeScreen] Error fetching ${tab} feed:`, err);
            setError(err.message || 'Failed to load feed');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Initial load
    useEffect(() => {
        if (isAuthenticated) {
            fetchFeed(activeTab);
        }
    }, [isAuthenticated]);

    // Refresh on focus
    useFocusEffect(
        useCallback(() => {
            if (isAuthenticated) {
                fetchFeed(activeTab, true);
            }
        }, [activeTab, isAuthenticated])
    );

    // Handle tab change
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        // Fetch data for the new tab if we don't have it cached
        const feedData = tab === 'episodes' ? episodesFeed : tab === 'books' ? booksFeed : podcastersFeed;
        if (!feedData) {
            fetchFeed(tab);
        }
    };

    // Handle refresh
    const onRefresh = () => {
        setRefreshing(true);
        fetchFeed(activeTab, true);
    };

    // Navigation handlers
    const handleEpisodePress = (episode: EpisodeFeedItem) => {
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

    // Render tab selector
    const renderTabSelector = () => (
        <View className="flex-row px-6 pt-4 pb-2">
            {TABS.map((tab) => (
                <TouchableOpacity
                    key={tab.key}
                    onPress={() => handleTabChange(tab.key)}
                    className={`mr-4 pb-2 ${activeTab === tab.key ? 'border-b-2 border-brand-red' : ''}`}
                >
                    <Text
                        className={`font-inter-medium text-base ${
                            activeTab === tab.key ? 'text-brand-red' : 'text-[#858585]'
                        }`}
                    >
                        {tab.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    // Render episodes tab content
    const renderEpisodesTab = () => {
        if (!episodesFeed) return null;

        // Find sections by id
        const continueSection = episodesFeed.sections.find(s => s.id === 'continue_listening');
        const popularSection = episodesFeed.sections.find(s => s.id === 'popular');
        const latestSection = episodesFeed.sections.find(s => s.id === 'latest');
        const recommendedSection = episodesFeed.sections.find(s => s.id === 'recommended');

        return (
            <>
                {/* Continue Listening */}
                {continueSection && continueSection.items.length > 0 && (
                    <ContinueListeningSection
                        title={continueSection.title}
                        episodes={continueSection.items}
                        onEpisodePress={handleEpisodePress}
                        showSeeAll={continueSection.hasMore}
                        onSeeAll={() => handleSeeAll('continue_listening')}
                    />
                )}

                {/* Popular Episodes */}
                {popularSection && popularSection.items.length > 0 && (
                    <EpisodeSection
                        title={popularSection.title}
                        episodes={popularSection.items.map(item => ({
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
                            updatedAt: item.createdAt,
                        }))}
                        onEpisodePress={(episode) => handleEpisodePress({ ...episode, playCount: episode.playCount, likeCount: episode.likeCount })}
                        showSeeAll={popularSection.hasMore}
                        onSeeAll={() => handleSeeAll('popular')}
                    />
                )}

                {/* Latest Releases */}
                {latestSection && latestSection.items.length > 0 && (
                    <EpisodeSection
                        title={latestSection.title}
                        episodes={latestSection.items.map(item => ({
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
                            updatedAt: item.createdAt,
                        }))}
                        onEpisodePress={(episode) => handleEpisodePress({ ...episode, playCount: episode.playCount, likeCount: episode.likeCount })}
                        showSeeAll={latestSection.hasMore}
                        onSeeAll={() => handleSeeAll('latest')}
                    />
                )}

                {/* Recommended */}
                {recommendedSection && recommendedSection.items.length > 0 && (
                    <EpisodeSection
                        title={recommendedSection.title}
                        episodes={recommendedSection.items.map(item => ({
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
                            updatedAt: item.createdAt,
                        }))}
                        onEpisodePress={(episode) => handleEpisodePress({ ...episode, playCount: episode.playCount, likeCount: episode.likeCount })}
                        showSeeAll={recommendedSection.hasMore}
                        onSeeAll={() => handleSeeAll('recommended')}
                    />
                )}
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
        const bestsellersSection = booksFeed.sections.find(s => s.id === 'bestsellers');

        return (
            <>
                {/* Popular Inspirations */}
                {inspirationsSection && inspirationsSection.items.length > 0 && (
                    <BookSection
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

                {/* Bestsellers */}
                {bestsellersSection && bestsellersSection.items.length > 0 && (
                    <BookSection
                        title={bestsellersSection.title}
                        books={bestsellersSection.items}
                        onBookPress={handleBookPress}
                        showSeeAll={bestsellersSection.hasMore}
                        onSeeAll={() => handleSeeAll('bestsellers')}
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
    const renderEmptyState = () => (
        <View className="flex-1 items-center justify-center py-20">
            <Text className="font-inter-medium text-lg text-[#858585]">
                No content available
            </Text>
            <Text className="font-inter text-sm text-[#A0A0A0] mt-2 text-center px-10">
                Check back later for new {activeTab === 'episodes' ? 'episodes' : activeTab === 'books' ? 'books' : 'podcasters'}
            </Text>
        </View>
    );

    // Render error state
    const renderErrorState = () => (
        <View className="flex-1 items-center justify-center py-20">
            <Text className="font-inter-medium text-lg text-brand-red">
                Something went wrong
            </Text>
            <Text className="font-inter text-sm text-[#858585] mt-2 text-center px-10">
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
        <SafeAreaView className="flex-1 bg-brand-beige" edges={['top', 'left', 'right']}>
            <TopBar />

            {/* Tab Selector */}
            {renderTabSelector()}

            {/* Content */}
            {loading && !refreshing ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#920002" />
                </View>
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
