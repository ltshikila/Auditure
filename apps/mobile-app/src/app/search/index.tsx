import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    ScrollView,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import {
    searchService,
    SearchAllResponse,
    EpisodeSearchResult,
    BookSearchResult,
    PodcasterSearchResult,
    SearchScope,
} from '@/services/search.service';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 10;

type TabType = 'all' | 'episodes' | 'books' | 'podcasters';

const TABS: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'episodes', label: 'Episodes' },
    { key: 'books', label: 'Books' },
    { key: 'podcasters', label: 'Podcasters' },
];

export default function SearchScreen() {
    const { token } = useAuth();
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchAllResponse | null>(null);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const searchInputRef = useRef<TextInput>(null);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    // Load recent searches on mount
    useEffect(() => {
        loadRecentSearches();
    }, []);

    // Debounced search
    useEffect(() => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        if (query.trim().length >= 2) {
            debounceTimeout.current = setTimeout(() => {
                performSearch(query.trim());
            }, 300);
        } else {
            setSearchResults(null);
            setHasSearched(false);
        }

        return () => {
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        };
    }, [query]);

    const loadRecentSearches = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            if (stored) {
                setRecentSearches(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load recent searches:', error);
        }
    };

    const saveRecentSearch = async (searchQuery: string) => {
        try {
            const trimmed = searchQuery.trim();
            if (!trimmed) return;

            const updated = [
                trimmed,
                ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
            ].slice(0, MAX_RECENT_SEARCHES);

            setRecentSearches(updated);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to save recent search:', error);
        }
    };

    const clearRecentSearches = async () => {
        try {
            setRecentSearches([]);
            await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
        } catch (error) {
            console.error('Failed to clear recent searches:', error);
        }
    };

    const removeRecentSearch = async (searchQuery: string) => {
        try {
            const updated = recentSearches.filter(
                (s) => s.toLowerCase() !== searchQuery.toLowerCase()
            );
            setRecentSearches(updated);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (error) {
            console.error('Failed to remove recent search:', error);
        }
    };

    const performSearch = async (searchQuery: string) => {
        setLoading(true);
        setHasSearched(true);
        try {
            const results = await searchService.searchAll(searchQuery, token || undefined);
            setSearchResults(results);
            saveRecentSearch(searchQuery);
        } catch (error) {
            console.error('Search failed:', error);
            setSearchResults(null);
        } finally {
            setLoading(false);
        }
    };

    const handleRecentSearchPress = (searchQuery: string) => {
        setQuery(searchQuery);
        Keyboard.dismiss();
    };

    const handleClearSearch = () => {
        setQuery('');
        setSearchResults(null);
        setHasSearched(false);
        searchInputRef.current?.focus();
    };

    const formatDuration = (seconds: number | null): string => {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        return `${mins} min`;
    };

    // Navigation handlers
    const handleEpisodePress = (episode: EpisodeSearchResult) => {
        router.push(`/episodes/${episode.id}` as any);
    };

    const handleBookPress = (book: BookSearchResult) => {
        router.push(`/${book.id}` as any);
    };

    const handlePodcasterPress = (podcaster: PodcasterSearchResult) => {
        router.push(`/podcasts/${podcaster.id}` as any);
    };

    // Render functions
    const renderEpisodeItem = (episode: EpisodeSearchResult) => (
        <TouchableOpacity
            key={episode.id}
            onPress={() => handleEpisodePress(episode)}
            className="flex-row items-center py-3 px-4"
        >
            {episode.book.coverImageUrl ? (
                <Image
                    source={{ uri: episode.book.coverImageUrl }}
                    className="w-12 h-12 rounded-lg bg-gray-200"
                />
            ) : (
                <View className="w-12 h-12 rounded-lg bg-gray-200 items-center justify-center">
                    <Ionicons name="musical-notes" size={24} color="#9CA3AF" />
                </View>
            )}
            <View className="flex-1 ml-3">
                <Text className="font-jakarta-semibold text-base text-gray-900" numberOfLines={1}>
                    {episode.title}
                </Text>
                <Text className="font-inter text-sm text-gray-500" numberOfLines={1}>
                    {episode.podcaster.name} {episode.duration ? `• ${formatDuration(episode.duration)}` : ''}
                </Text>
            </View>
            <Ionicons name="play-circle-outline" size={24} color="#BF9A54" />
        </TouchableOpacity>
    );

    const renderBookItem = (book: BookSearchResult) => (
        <TouchableOpacity
            key={book.id}
            onPress={() => handleBookPress(book)}
            className="flex-row items-center py-3 px-4"
        >
            {book.coverImageUrl ? (
                <Image
                    source={{ uri: book.coverImageUrl }}
                    className="w-12 h-16 rounded-lg bg-gray-200"
                />
            ) : (
                <View className="w-12 h-16 rounded-lg bg-gray-200 items-center justify-center">
                    <Ionicons name="book" size={24} color="#9CA3AF" />
                </View>
            )}
            <View className="flex-1 ml-3">
                <Text className="font-jakarta-semibold text-base text-gray-900" numberOfLines={1}>
                    {book.title}
                </Text>
                <Text className="font-inter text-sm text-gray-500" numberOfLines={1}>
                    {book.author || 'Unknown Author'}
                </Text>
            </View>
            <Ionicons name="book-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
    );

    const renderPodcasterItem = (podcaster: PodcasterSearchResult) => (
        <TouchableOpacity
            key={podcaster.id}
            onPress={() => handlePodcasterPress(podcaster)}
            className="flex-row items-center py-3 px-4"
        >
            {podcaster.profilePictureUrl ? (
                <Image
                    source={{ uri: podcaster.profilePictureUrl }}
                    className="w-12 h-12 rounded-full bg-gray-200"
                />
            ) : (
                <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center">
                    <Ionicons name="person" size={24} color="#9CA3AF" />
                </View>
            )}
            <View className="flex-1 ml-3">
                <Text className="font-jakarta-semibold text-base text-gray-900" numberOfLines={1}>
                    {podcaster.name}
                </Text>
                <View className="flex-row items-center">
                    {podcaster.averageRating > 0 && (
                        <>
                            <Ionicons name="star" size={12} color="#BF9A54" />
                            <Text className="font-inter text-sm text-gray-500 ml-1">
                                {podcaster.averageRating.toFixed(1)}
                            </Text>
                        </>
                    )}
                    {podcaster.expertiseTags.length > 0 && (
                        <Text className="font-inter text-sm text-gray-500 ml-2" numberOfLines={1}>
                            {podcaster.expertiseTags.slice(0, 2).join(', ')}
                        </Text>
                    )}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
    );

    const renderSection = (
        title: string,
        items: any[],
        renderItem: (item: any) => React.ReactNode,
        hasMore: boolean,
        scope: SearchScope
    ) => {
        if (items.length === 0) return null;

        return (
            <View className="mb-6">
                <View className="flex-row items-center justify-between px-4 mb-2">
                    <Text className="font-jakarta-bold text-lg text-gray-900">{title}</Text>
                    {hasMore && (
                        <TouchableOpacity onPress={() => setActiveTab(scope as TabType)}>
                            <Text className="font-inter-medium text-sm text-brand-gold">See all</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {items.map(renderItem)}
            </View>
        );
    };

    const renderRecentSearches = () => {
        if (recentSearches.length === 0) return null;

        return (
            <View className="px-4 pt-4">
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="font-jakarta-bold text-lg text-gray-900">Recent Searches</Text>
                    <TouchableOpacity onPress={clearRecentSearches}>
                        <Text className="font-inter-medium text-sm text-brand-gold">Clear</Text>
                    </TouchableOpacity>
                </View>
                {recentSearches.map((search, index) => (
                    <TouchableOpacity
                        key={`${search}-${index}`}
                        onPress={() => handleRecentSearchPress(search)}
                        className="flex-row items-center py-3"
                    >
                        <Ionicons name="time-outline" size={20} color="#9CA3AF" />
                        <Text className="font-inter text-base text-gray-700 flex-1 ml-3">
                            {search}
                        </Text>
                        <TouchableOpacity
                            onPress={() => removeRecentSearch(search)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderEmptyState = () => {
        if (!hasSearched) {
            return renderRecentSearches();
        }

        return (
            <View className="flex-1 items-center justify-center py-20">
                <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-4">
                    <Ionicons name="search-outline" size={48} color="#9CA3AF" />
                </View>
                <Text className="font-jakarta-bold text-xl text-gray-900 mb-2">No results found</Text>
                <Text className="font-inter text-gray-500 text-center px-8">
                    Try searching for something else or check your spelling.
                </Text>
            </View>
        );
    };

    const renderAllResults = () => {
        if (!searchResults) return renderEmptyState();

        const { episodes, books, podcasters } = searchResults;
        const hasResults =
            episodes.results.length > 0 ||
            books.results.length > 0 ||
            podcasters.results.length > 0;

        if (!hasResults) return renderEmptyState();

        return (
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {renderSection(
                    'Episodes',
                    episodes.results.slice(0, 3),
                    renderEpisodeItem,
                    episodes.hasMore || episodes.results.length > 3,
                    'episodes'
                )}
                {renderSection(
                    'Books',
                    books.results.slice(0, 3),
                    renderBookItem,
                    books.hasMore || books.results.length > 3,
                    'books'
                )}
                {renderSection(
                    'Virtual Podcasters',
                    podcasters.results.slice(0, 3),
                    renderPodcasterItem,
                    podcasters.hasMore || podcasters.results.length > 3,
                    'podcasters'
                )}
            </ScrollView>
        );
    };

    const renderScopedResults = () => {
        if (!searchResults) return renderEmptyState();

        let items: any[] = [];
        let renderItem: (item: any) => React.ReactNode;

        switch (activeTab) {
            case 'episodes':
                items = searchResults.episodes.results;
                renderItem = renderEpisodeItem;
                break;
            case 'books':
                items = searchResults.books.results;
                renderItem = renderBookItem;
                break;
            case 'podcasters':
                items = searchResults.podcasters.results;
                renderItem = renderPodcasterItem;
                break;
            default:
                return renderAllResults();
        }

        if (items.length === 0) return renderEmptyState();

        return (
            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderItem(item)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
            {/* Header with Search Bar */}
            <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center -ml-2"
                >
                    <Ionicons name="chevron-back" size={24} color="#1A1C1E" />
                </TouchableOpacity>

                <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-4 py-2 ml-2">
                    <Ionicons name="search-outline" size={20} color="#9CA3AF" />
                    <TextInput
                        ref={searchInputRef}
                        className="flex-1 font-inter text-base text-gray-900 ml-2"
                        placeholder="Search episodes, books, podcasters..."
                        placeholderTextColor="#9CA3AF"
                        value={query}
                        onChangeText={setQuery}
                        autoFocus
                        returnKeyType="search"
                        onSubmitEditing={() => {
                            if (query.trim().length >= 2) {
                                performSearch(query.trim());
                                Keyboard.dismiss();
                            }
                        }}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={handleClearSearch}>
                            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Category Tabs */}
            {hasSearched && searchResults && (
                <View className="border-b border-gray-100">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                    >
                        {TABS.map((tab) => (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key)}
                                className={`px-4 py-2 rounded-full mr-2 ${
                                    activeTab === tab.key ? 'bg-brand-gold' : 'bg-gray-100'
                                }`}
                            >
                                <Text
                                    className={`font-inter-medium text-sm ${
                                        activeTab === tab.key ? 'text-white' : 'text-gray-700'
                                    }`}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Content */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#BF9A54" />
                    <Text className="font-inter text-gray-500 mt-4">Searching...</Text>
                </View>
            ) : activeTab === 'all' ? (
                renderAllResults()
            ) : (
                renderScopedResults()
            )}
        </SafeAreaView>
    );
}
