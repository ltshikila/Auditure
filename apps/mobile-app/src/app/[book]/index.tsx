import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { TopBar } from '@/components/TopBar';
import { EpisodeSection } from '@/components/EpisodeSection';
import { BookDetailSkeleton } from '@/components/skeleton';
import { bookService, BookDetailResponse, BookDetailEpisode } from '@/services/book.service';
import { Episode } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { resolveCoverUrl } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';

const bookIcons = {
    microphone: require('@/assets/icons/microphone.png'),
    books: require('@/assets/icons/books_fill.png'),
    language: require('@/assets/icons/language.png'),
};

export default function BookDetailScreen() {
    const { book: bookId } = useLocalSearchParams<{ book: string }>();

    const [data, setData] = useState<BookDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchBookDetail();
    }, [bookId]);

    const fetchBookDetail = async (isRefreshing = false) => {
        if (!bookId) return;
        try {
            if (!isRefreshing) setLoading(true);
            setError(null);
            const token = await storageService.getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }
            const result = await bookService.getBookDetail(bookId, token);
            setData(result);
        } catch (err: any) {
            setError(err.message || 'Failed to load book');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchBookDetail(true);
    };

    const handleEpisodePress = (episode: Episode) => {
        router.push(`/episodes/${episode.id}`);
    };

    // Adapt BookDetailEpisode to Episode for EpisodeSection
    const adaptEpisodes = (episodes: BookDetailEpisode[]): Episode[] => {
        if (!data) return [];
        return episodes.map(ep => ({
            ...ep,
            userId: '',
            podcasterId: ep.podcaster?.id || '',
            bookId: data.book.id,
            contentCoverage: 'ENTIRE_BOOK' as const,
            chapters: [],
            episodeType: (ep.episodeType as Episode['episodeType']) || 'MONOLOGUE',
            episodeTheme: (ep.episodeTheme as Episode['episodeTheme']) || 'LECTURE',
            targetLengthMin: 0,
            targetLengthMax: 0,
            voiceTier: 'STANDARD' as const,
            generationStatus: 'COMPLETED' as const,
            isPublic: true,
            updatedAt: ep.createdAt,
            book: {
                id: data.book.id,
                title: data.book.title,
                author: data.book.author,
                coverImageUrl: data.book.coverImageUrl,
            },
            podcaster: ep.podcaster,
        }));
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige">
                <TopBar showBackButton />
                <BookDetailSkeleton />
            </SafeAreaView>
        );
    }

    if (error || !data) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige">
                <TopBar showBackButton />
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="font-inter-bold text-xl text-gray-900 mb-2">
                        {error || 'Book not found'}
                    </Text>
                    <TouchableOpacity onPress={() => fetchBookDetail()}>
                        <Text className="font-inter-medium text-brand-gold mt-4">Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const { book, sections } = data;
    const coverUrl = resolveCoverUrl(book.coverImageUrl);
    const hasEpisodes = sections.top.length > 0 || sections.recent.length > 0 || sections.trending.length > 0;

    return (
        <SafeAreaView className="flex-1 bg-brand-beige">
            <TopBar showBackButton />
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Book Header */}
                <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 20 }}>
                    {coverUrl ? (
                        <View style={{ width: 154, height: 230, borderRadius: 12, overflow: 'hidden' }}>
                            <Image
                                source={{ uri: coverUrl }}
                                style={{ width: 154, height: 230 }}
                                resizeMode="cover"
                            />
                        </View>
                    ) : (
                        <View style={{ width: 154, height: 230, borderRadius: 12, overflow: 'hidden' }}>
                            <View className="w-full h-full bg-brand-gold/20 items-center justify-center">
                                <Text className="font-jakarta-bold text-brand-gold text-xl text-center px-4" numberOfLines={4}>
                                    {book.title}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Title & Author */}
                <View className="px-6">
                    <Text className="font-jakarta-bold text-2xl text-gray-900 mb-1">{book.title}</Text>
                    {book.author && (
                        <Text className="font-inter text-gray-500 mb-4">{book.author}</Text>
                    )}
                </View>

                {/* Stats Row */}
                <View className="flex-row justify-around px-6 mb-8">
                    <View className="items-center">
                        <View className="flex-row items-center gap-1">
                            <Image source={bookIcons.microphone} style={{ width: 16, height: 16, tintColor: '#E8847C' }} />
                            <Text className="font-jakarta-bold text-lg text-gray-900">{book.episodeCount}</Text>
                        </View>
                        <Text className="font-inter text-xs text-gray-500">Episodes</Text>
                    </View>
                    <View className="items-center">
                        <View className="flex-row items-center gap-1">
                            <Ionicons name="play-circle" size={18} color="#E8847C" />
                            <Text className="font-jakarta-bold text-lg text-gray-900">{book.totalPlayCount}</Text>
                        </View>
                        <Text className="font-inter text-xs text-gray-500">Plays</Text>
                    </View>
                    {book.pageCount && (
                        <View className="items-center">
                            <View className="flex-row items-center gap-1">
                                <Image source={bookIcons.books} style={{ width: 16, height: 16, tintColor: '#E8847C' }} />
                                <Text className="font-jakarta-bold text-lg text-gray-900">{book.pageCount}</Text>
                            </View>
                            <Text className="font-inter text-xs text-gray-500">Pages</Text>
                        </View>
                    )}
                    {book.language && (
                        <View className="items-center">
                            <View className="flex-row items-center gap-1">
                                <Image source={bookIcons.language} style={{ width: 16, height: 16, tintColor: '#E8847C' }} />
                                <Text className="font-jakarta-bold text-lg text-gray-900">{book.language.toUpperCase()}</Text>
                            </View>
                            <Text className="font-inter text-xs text-gray-500">Language</Text>
                        </View>
                    )}
                </View>

                {/* Episode Sections */}
                {hasEpisodes ? (
                    <>
                        <EpisodeSection
                            title="Top Episodes"
                            episodes={adaptEpisodes(sections.top)}
                            onEpisodePress={handleEpisodePress}
                        />
                        <EpisodeSection
                            title="Recent Episodes"
                            episodes={adaptEpisodes(sections.recent)}
                            onEpisodePress={handleEpisodePress}
                        />
                        <EpisodeSection
                            title="Trending"
                            episodes={adaptEpisodes(sections.trending)}
                            onEpisodePress={handleEpisodePress}
                        />
                    </>
                ) : (
                    <View className="px-6 py-8 items-center">
                        <View className="w-16 h-16 bg-brand-gold/20 rounded-full items-center justify-center mb-3">
                            <Ionicons name="headset" size={32} color="#BF9A54" />
                        </View>
                        <Text className="font-inter-bold text-gray-900 mb-2">No episodes yet</Text>
                        <Text className="font-inter text-gray-500 text-center text-sm">
                            Be the first to create an episode from this book
                        </Text>
                    </View>
                )}

                <View className="h-24" />
            </ScrollView>
        </SafeAreaView>
    );
}
