import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    TextInput,
    Platform,
    Modal,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Episode, EpisodeComment, AuthorInfo, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { usePlayback } from '@/contexts/PlaybackContext';
import { playbackService, GenerationProgress } from '@/services/playback.service';
import { resolveCoverUrl } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { EpisodeDetailSkeleton } from '@/components/skeleton';
import { formatCount } from '@/utils/formatCount';

const icons = {
    star: require('@/assets/icons/star.png'),
    language: require('@/assets/icons/language.png'),
    microphone: require('@/assets/icons/microphone.png'),
    books: require('@/assets/icons/books_fill.png'),
    back: require('@/assets/icons/back.png'),
    profile: require('@/assets/icons/profile.png'),
};

type TabType = 'summary' | 'details' | 'author' | 'comments';

export default function EpisodeInfoScreen() {
    const { episode: episodeId } = useLocalSearchParams<{ episode: string }>();
    const { user } = useAuth();
    const { showAlert } = useAlert();
    const [episode, setEpisode] = useState<Episode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
    const { play, episode: currentEpisode, isPlaying } = usePlayback();

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('summary');

    // Comments state
    const [comments, setComments] = useState<EpisodeComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState<string | null>(null);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);

    // Author state
    const [authorInfo, setAuthorInfo] = useState<AuthorInfo | null>(null);
    const [authorLoading, setAuthorLoading] = useState(false);
    const [authorError, setAuthorError] = useState<string | null>(null);
    const [authorImageFailed, setAuthorImageFailed] = useState(false);

    // Rating state
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [userRating, setUserRating] = useState<number | null>(null);
    const [selectedRating, setSelectedRating] = useState(0);
    const [submittingRating, setSubmittingRating] = useState(false);

    // Title editing state
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [savingTitle, setSavingTitle] = useState(false);

    const isOwner = episode && user && episode.userId === user.id;

    const handleSaveTitle = async () => {
        if (!episode || !editedTitle.trim() || editedTitle.trim() === episode.title) {
            setIsEditingTitle(false);
            return;
        }
        try {
            setSavingTitle(true);
            const token = await storageService.getAccessToken();
            if (!token) return;
            const updated = await episodeService.update(episode.id, { title: editedTitle.trim() }, token);
            setEpisode({ ...episode, title: updated.title });
            setIsEditingTitle(false);
        } catch (err: any) {
            showAlert({ title: 'Error', message: err.message || 'Failed to update title' });
        } finally {
            setSavingTitle(false);
        }
    };

    const isGenerating =
        episode &&
        episode.generationStatus !== 'COMPLETED' &&
        episode.generationStatus !== 'FAILED';

    // Poll for generation progress when episode is generating
    useEffect(() => {
        if (!isGenerating || !episodeId) return;

        const pollProgress = async () => {
            try {
                const token = await storageService.getAccessToken();
                const progress = await playbackService.getGenerationProgress(
                    episodeId,
                    token || undefined,
                );
                if (progress) {
                    setGenerationProgress(progress);
                    if (progress.status === 'COMPLETED') {
                        fetchEpisode();
                    }
                }
            } catch (err) {
                console.error('Failed to fetch generation progress:', err);
            }
        };

        pollProgress();
        const interval = setInterval(pollProgress, 3000);

        return () => clearInterval(interval);
    }, [isGenerating, episodeId]);

    useEffect(() => {
        fetchEpisode();
    }, [episodeId]);

    // Silently refresh episode data (rating, etc.) when screen regains focus
    const isInitialLoad = useRef(true);
    useFocusEffect(
        useCallback(() => {
            if (isInitialLoad.current) {
                isInitialLoad.current = false;
                return;
            }
            if (!episodeId) return;
            (async () => {
                try {
                    const token = await storageService.getAccessToken();
                    const data = await episodeService.getEpisode(episodeId, token || undefined);
                    setEpisode(data);
                    if (token) {
                        try {
                            const rating = await episodeService.getEpisodeRating(episodeId, token);
                            setUserRating(rating.userRating);
                        } catch { /* non-critical */ }
                    }
                } catch (err: any) {
                    // Episode was deleted — navigate back to episodes tab
                    if (err?.status === 404 || err?.message?.includes('404')) {
                        router.navigate('/(tabs)/episode');
                    }
                }
            })();
        }, [episodeId]),
    );

    // Fetch comments when tab becomes active
    useEffect(() => {
        if (activeTab === 'comments' && episodeId) {
            fetchComments();
        }
    }, [activeTab, episodeId]);

    // Fetch author info when tab becomes active
    useEffect(() => {
        if (activeTab === 'author' && episodeId && !authorInfo && !authorLoading) {
            fetchAuthorInfo();
        }
    }, [activeTab, episodeId]);

    const fetchEpisode = async () => {
        if (!episodeId) return;

        try {
            setLoading(true);
            setError(null);
            const token = await storageService.getAccessToken();
            const data = await episodeService.getEpisode(episodeId, token || undefined);
            setEpisode(data);

            // Fetch like status and rating for the current user
            if (token) {
                try {
                    const { isLiked: liked } = await episodeService.getLikeStatus(episodeId, token);
                    setIsLiked(liked);
                } catch {
                    // Ignore — like status is non-critical
                }
                try {
                    const rating = await episodeService.getEpisodeRating(episodeId, token);
                    setUserRating(rating.userRating);
                } catch {
                    // Ignore — rating is non-critical
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load episode');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitRating = async () => {
        if (!episodeId || selectedRating === 0) return;
        try {
            setSubmittingRating(true);
            const token = await storageService.getAccessToken();
            if (!token) return;
            const result = await episodeService.rateEpisode(episodeId, selectedRating, token);
            setUserRating(result.userRating);
            if (episode) {
                setEpisode({ ...episode, averageRating: result.averageRating, ratingCount: result.ratingCount });
            }
            setShowRatingModal(false);
        } catch (err: any) {
            showAlert({ title: 'Error', message: err.message || 'Failed to submit rating' });
        } finally {
            setSubmittingRating(false);
        }
    };

    const openRatingModal = () => {
        setSelectedRating(userRating || 0);
        setShowRatingModal(true);
    };

    const fetchComments = async () => {
        if (!episodeId) return;

        try {
            setCommentsLoading(true);
            setCommentsError(null);
            const data = await episodeService.getComments(episodeId);
            setComments(data);
        } catch (err: any) {
            setCommentsError(err.message || 'Failed to load comments');
        } finally {
            setCommentsLoading(false);
        }
    };

    const fetchAuthorInfo = async () => {
        if (!episodeId) return;

        try {
            setAuthorLoading(true);
            setAuthorError(null);
            setAuthorImageFailed(false);
            const token = await storageService.getAccessToken();
            const data = await episodeService.getAuthorInfo(episodeId, token || undefined);
            setAuthorInfo(data);
        } catch (err: any) {
            setAuthorError(err.message || 'Failed to load author info');
        } finally {
            setAuthorLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || !episodeId) return;

        try {
            setSubmittingComment(true);
            const token = await storageService.getAccessToken();
            if (!token) {
                showAlert({ title: 'Login Required', message: 'Please log in to add a comment.' });
                return;
            }

            const comment = await episodeService.addComment(episodeId, newComment.trim(), token);
            setComments((prev) => [comment, ...prev]);
            setNewComment('');
        } catch (err: any) {
            showAlert({ title: 'Error', message: err.message || 'Failed to add comment' });
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        showAlert({
            title: 'Delete Comment',
            message: 'Are you sure you want to delete this comment?',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await storageService.getAccessToken();
                            if (!token) return;

                            await episodeService.deleteComment(commentId, token);
                            setComments((prev) => prev.filter((c) => c.id !== commentId));
                        } catch (err: any) {
                            showAlert({ title: 'Error', message: err.message || 'Failed to delete comment' });
                        }
                    },
                },
            ],
        });
    };

    const handlePlay = async () => {
        if (episode) {
            if (currentEpisode?.id === episode.id) {
                router.push(`/episodes/${episode.id}/play`);
            } else {
                await play(episode);
                router.push(`/episodes/${episode.id}/play`);
            }
        }
    };

    const handleLike = async () => {
        if (!episode) return;

        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

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
        if (!seconds) return 'Unknown';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins} min`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatTimeAgo = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return formatDate(dateString);
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

    const getEpisodeTypeLabel = (type: string) => {
        switch (type) {
            case 'MONOLOGUE':
                return 'Solo';
            case 'DUO':
                return 'Duo';
            default:
                return type;
        }
    };

    const getEpisodeThemeLabel = (theme: string) => {
        switch (theme) {
            case 'LECTURE':
                return 'Lecture';
            case 'DISCUSSION':
                return 'Discussion';
            case 'DEBATE':
                return 'Debate';
            default:
                return theme;
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
                <EpisodeDetailSkeleton />
            </SafeAreaView>
        );
    }

    if (error || !episode) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg items-center justify-center px-6">
                <Ionicons name="alert-circle-outline" size={48} color="#920002" />
                <Text className="font-inter text-[#920002] text-center mt-4">
                    {error || 'Episode not found'}
                </Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="mt-6 bg-brand-gold px-6 py-3 rounded-full">
                    <Text className="font-inter-medium text-white">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const isCurrentlyPlaying = currentEpisode?.id === episode.id && isPlaying;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'summary':
                return renderSummaryTab();
            case 'details':
                return renderDetailsTab();
            case 'author':
                return renderAuthorTab();
            case 'comments':
                return renderCommentsTab();
            default:
                return null;
        }
    };

    const renderSummaryTab = () => (
        <View className="px-6 mt-4 mb-32">
            {episode.summary ? (
                <Text className="font-jakarta text-[#666666] dark:text-brand-dark-text-secondary leading-6 text-base">
                    {episode.summary}
                </Text>
            ) : (
                <View className="items-center py-12">
                    <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                    <Text className="font-inter text-gray-400 dark:text-brand-dark-text-muted mt-4 text-center">
                        No summary available yet.
                    </Text>
                    <Text className="font-inter text-gray-400 dark:text-brand-dark-text-muted text-sm text-center mt-1">
                        Summary will appear once the episode is generated.
                    </Text>
                </View>
            )}
        </View>
    );

    const renderDetailsTab = () => (
        <View className="px-6 mt-4 mb-32">
            <View className="bg-[#F5F5F0] dark:bg-brand-dark-surface rounded-2xl p-4" style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 3,
            }}>
                {/* Podcast */}
                <TouchableOpacity
                    onPress={() => {
                        if (episode.podcaster?.id) {
                            router.push(`/podcasts/${episode.podcaster.id}`);
                        }
                    }}
                    disabled={!episode.podcaster?.id}
                    className="flex-row items-center py-3 border-b border-gray-200 dark:border-brand-dark-border"
                >
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="mic-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Podcaster</Text>
                        <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                            {episode.podcaster?.name || 'Virtual Podcaster'}
                        </Text>
                    </View>
                    {episode.podcaster?.id && (
                        <Ionicons name="chevron-forward" size={16} color="#BF9A54" />
                    )}
                </TouchableOpacity>

                {/* Book Inspiration */}
                {episode.book && (
                    <TouchableOpacity
                        onPress={() => router.push(`/${episode.book!.id}`)}
                        className="flex-row items-center py-3 border-b border-gray-200 dark:border-brand-dark-border"
                    >
                        <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                            <Image source={icons.books} style={{ width: 16, height: 16, tintColor: '#BF9A54' }} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Book Inspiration</Text>
                            <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                                {episode.book.title}{episode.book.author ? ` by ${episode.book.author}` : ''}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#BF9A54" />
                    </TouchableOpacity>
                )}

                {/* Episode Type */}
                <View className="flex-row items-center py-3 border-b border-gray-200 dark:border-brand-dark-border">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="people-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Type</Text>
                        <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                            {getEpisodeTypeLabel(episode.episodeType)} ({getEpisodeThemeLabel(episode.episodeTheme)})
                        </Text>
                    </View>
                </View>

                {/* Duration */}
                <View className="flex-row items-center py-3 border-b border-gray-200 dark:border-brand-dark-border">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="time-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Duration</Text>
                        <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                            {formatDuration(episode.duration)}
                        </Text>
                    </View>
                </View>

                {/* Format */}
                <View className="flex-row items-center py-3 border-b border-gray-200 dark:border-brand-dark-border">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="musical-note-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Format</Text>
                        <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                            {episode.audioFormat?.toUpperCase() || 'MP3'}
                        </Text>
                    </View>
                </View>

                {/* Plays */}
                <View className="flex-row items-center py-3 border-b border-gray-200 dark:border-brand-dark-border">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="play-circle-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Total Plays</Text>
                        <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                            {formatCount(episode.playCount)}
                        </Text>
                    </View>
                </View>

                {/* Likes */}
                <View className="flex-row items-center py-3 border-b border-gray-200 dark:border-brand-dark-border">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="heart-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Likes</Text>
                        <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                            {formatCount(episode.likeCount)}
                        </Text>
                    </View>
                </View>

                {/* Upload Date */}
                <View className="flex-row items-center py-3">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="calendar-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Created</Text>
                        <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                            {formatDate(episode.createdAt)}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderAuthorTab = () => {
        if (authorLoading) {
            return (
                <View className="px-6 mt-4 mb-32 items-center py-12">
                    <ActivityIndicator size="large" color="#BF9A54" />
                    <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted mt-4">Loading author info...</Text>
                </View>
            );
        }

        if (authorError) {
            return (
                <View className="px-6 mt-4 mb-32 items-center py-12">
                    <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
                    <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted mt-4 text-center">{authorError}</Text>
                    <TouchableOpacity onPress={fetchAuthorInfo} className="mt-4">
                        <Text className="font-inter-medium text-brand-gold">Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (!authorInfo) {
            return (
                <View className="px-6 mt-4 mb-32 items-center py-12">
                    <Ionicons name="person-outline" size={48} color="#D1D5DB" />
                    <Text className="font-inter text-gray-400 dark:text-brand-dark-text-muted mt-4 text-center">
                        Author information not available.
                    </Text>
                    {episode.book?.author && (
                        <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted text-sm mt-2">
                            Book by: {episode.book.author}
                        </Text>
                    )}
                </View>
            );
        }

        return (
            <View className="px-6 mt-4 mb-32">
                <View className="bg-[#F5F5F0] dark:bg-brand-dark-surface rounded-2xl p-5" style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 3,
                }}>
                    {/* Author Header */}
                    <View className="flex-row items-center mb-4">
                        {authorInfo.photoUrl && !authorImageFailed ? (
                            <Image
                                source={{ uri: authorInfo.photoUrl }}
                                className="w-16 h-16 rounded-full bg-gray-200 dark:bg-brand-dark-border"
                                onError={() => setAuthorImageFailed(true)}
                            />
                        ) : (
                            <View className="w-16 h-16 bg-brand-gold rounded-full items-center justify-center">
                                <Ionicons name="person" size={28} color="white" />
                            </View>
                        )}
                        <View className="ml-4 flex-1">
                            <Text className="font-inter-bold text-lg text-brand-black dark:text-brand-dark-text">
                                {authorInfo.name}
                            </Text>
                            {(authorInfo.birthDate || authorInfo.deathDate) && (
                                <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted text-sm">
                                    {authorInfo.birthDate}
                                    {authorInfo.deathDate ? ` - ${authorInfo.deathDate}` : ''}
                                </Text>
                            )}
                            {authorInfo.works && (
                                <Text className="font-inter text-brand-gold text-sm">
                                    {formatCount(authorInfo.works)} known works
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Bio */}
                    {authorInfo.bio && (
                        <View className="mt-2">
                            <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text mb-2">About</Text>
                            <Text className="font-jakarta text-[#666666] dark:text-brand-dark-text-secondary leading-6">
                                {authorInfo.bio.length > 600
                                    ? authorInfo.bio.substring(0, 600) + '...'
                                    : authorInfo.bio}
                            </Text>
                        </View>
                    )}

                    {/* Wikipedia Link */}
                    {authorInfo.wikipedia && (
                        <TouchableOpacity className="mt-4 flex-row items-center">
                            <Ionicons name="link-outline" size={16} color="#BF9A54" />
                            <Text className="font-inter text-brand-gold ml-2">
                                Read more on Wikipedia
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const renderCommentsTab = () => {
        return (
            <View className="px-6 mt-4 mb-32">
                {/* Add Comment Input */}
                <View className="flex-row items-center mb-4">
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden bg-brand-gold">
                        {resolveCoverUrl(user?.profilePictureUrl) ? (
                            <Image source={{ uri: resolveCoverUrl(user!.profilePictureUrl)! }} style={{ width: 40, height: 40 }} resizeMode="cover" />
                        ) : user?.firstName ? (
                            <Text className="font-jakarta-bold text-white">
                                {user.firstName.charAt(0).toUpperCase()}
                            </Text>
                        ) : (
                            <Image source={icons.profile} style={{ width: 20, height: 20, tintColor: 'white' }} />
                        )}
                    </View>
                    <View className="flex-1 flex-row bg-[#F5F5F0] dark:bg-brand-dark-surface rounded-full items-center pr-2">
                        <TextInput
                            value={newComment}
                            onChangeText={setNewComment}
                            placeholder="Add a comment..."
                            placeholderTextColor="#858585"
                            className="flex-1 font-inter text-brand-black dark:text-brand-dark-text px-4 py-3"
                            multiline={false}
                            editable={!submittingComment}
                        />
                        <TouchableOpacity
                            onPress={handleAddComment}
                            disabled={!newComment.trim() || submittingComment}
                            className={`w-8 h-8 rounded-full items-center justify-center ${
                                newComment.trim() ? 'bg-brand-gold' : 'bg-gray-300'
                            }`}>
                            {submittingComment ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Ionicons name="arrow-up" size={18} color="white" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Comments List */}
                {commentsLoading ? (
                    <View className="items-center py-12">
                        <ActivityIndicator size="large" color="#BF9A54" />
                        <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted mt-4">Loading comments...</Text>
                    </View>
                ) : commentsError ? (
                    <View className="items-center py-12">
                        <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
                        <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted mt-4 text-center">
                            {commentsError}
                        </Text>
                        <TouchableOpacity onPress={fetchComments} className="mt-4">
                            <Text className="font-inter-medium text-brand-gold">Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : comments.length === 0 ? (
                    <View className="items-center py-12">
                        <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                        <Text className="font-inter text-gray-400 dark:text-brand-dark-text-muted mt-4 text-center">
                            No comments yet.
                        </Text>
                        <Text className="font-inter text-gray-400 dark:text-brand-dark-text-muted text-sm text-center mt-1">
                            Be the first to share your thoughts!
                        </Text>
                    </View>
                ) : (
                    <View>
                        <Text className="font-inter-medium text-gray-500 dark:text-brand-dark-text-muted mb-4">
                            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                        </Text>
                        {comments.map((comment) => (
                            <View key={comment.id} className="mb-4">
                                <View className="flex-row items-start">
                                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden bg-brand-gold/80">
                                        {resolveCoverUrl(comment.user.profilePictureUrl) ? (
                                            <Image source={{ uri: resolveCoverUrl(comment.user.profilePictureUrl)! }} style={{ width: 40, height: 40 }} resizeMode="cover" />
                                        ) : (
                                            <Text className="font-jakarta-bold text-white text-sm">
                                                {comment.user.firstName.charAt(0).toUpperCase()}
                                                {comment.user.lastName.charAt(0).toUpperCase()}
                                            </Text>
                                        )}
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center justify-between">
                                            <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text">
                                                {comment.user.firstName} {comment.user.lastName}
                                            </Text>
                                            <Text className="font-inter text-gray-400 dark:text-brand-dark-text-muted text-xs">
                                                {formatTimeAgo(comment.createdAt)}
                                            </Text>
                                        </View>
                                        <Text className="font-inter text-[#666666] dark:text-brand-dark-text-secondary mt-1 leading-5">
                                            {comment.content}
                                        </Text>

                                        {/* Delete button for own comments */}
                                        {user && comment.userId === user.id && (
                                            <TouchableOpacity
                                                onPress={() => handleDeleteComment(comment.id)}
                                                className="mt-2 self-start">
                                                <Text className="font-inter text-red-500 text-xs">
                                                    Delete
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
            <KeyboardAwareScrollView
                showsVerticalScrollIndicator={false}
                extraScrollHeight={Platform.OS === 'ios' ? 120 : 80}
                enableOnAndroid
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 128 }}>
                    {/* Header */}
                    <View className="px-6 pb-2 flex-row items-center justify-between">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 items-center justify-center -ml-2">
                            <Image source={icons.back} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
                        </TouchableOpacity>
                        <Text className="font-jakarta-medium text-lg text-brand-black dark:text-brand-dark-text">About</Text>
                        <TouchableOpacity
                            onPress={handleLike}
                            className="w-10 h-10 items-center justify-center">
                            <Ionicons
                                name={isLiked ? 'heart' : 'heart-outline'}
                                size={24}
                                color={isLiked ? '#E8847C' : '#B8B2A3'}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Book Cover */}
                    <View className="px-6 pt-4 items-center">
                        <View
                            className="rounded-xl overflow-hidden bg-brand-input dark:bg-brand-dark-input"
                            style={{ width: 154, height: 230 }}>
                            {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                                <Image
                                    source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                                    style={{ width: 154, height: 230 }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="w-full h-full bg-brand-gold/20 items-center justify-center">
                                    <Image source={icons.books} style={{ width: 40, height: 40, tintColor: '#BF9A54' }} />
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Title Row with Play Button */}
                    <View className="px-6 mt-6 flex-row items-start">
                        <View className="flex-1 pr-4">
                            {isEditingTitle ? (
                                <View className="flex-row items-center">
                                    <TextInput
                                        className="font-inter text-2xl text-brand-black dark:text-brand-dark-text flex-1 border-b border-brand-gold pb-1"
                                        value={editedTitle}
                                        onChangeText={setEditedTitle}
                                        autoFocus
                                        onSubmitEditing={handleSaveTitle}
                                        returnKeyType="done"
                                        maxLength={100}
                                    />
                                    <TouchableOpacity onPress={handleSaveTitle} className="ml-2 p-1" disabled={savingTitle}>
                                        {savingTitle ? (
                                            <ActivityIndicator size="small" color="#BF9A54" />
                                        ) : (
                                            <Ionicons name="checkmark-circle" size={24} color="#BF9A54" />
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setIsEditingTitle(false)} className="ml-1 p-1">
                                        <Ionicons name="close-circle" size={24} color="#858585" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        if (isOwner) {
                                            setEditedTitle(episode.title);
                                            setIsEditingTitle(true);
                                        }
                                    }}
                                    disabled={!isOwner}
                                    activeOpacity={isOwner ? 0.6 : 1}
                                >
                                    <Text className="font-inter text-2xl text-brand-black dark:text-brand-dark-text">
                                        {episode.title}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={() => {
                                    if (episode.podcaster?.id) {
                                        router.push(`/podcasts/${episode.podcaster.id}`);
                                    }
                                }}
                                disabled={!episode.podcaster?.id}>
                                <Text className="font-jakarta text-[#858585] dark:text-brand-dark-text-secondary mt-1">
                                    By {episode.podcaster?.name || 'Virtual Podcaster'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {!isGenerating && episode.generationStatus !== 'FAILED' && (
                            <TouchableOpacity
                                onPress={handlePlay}
                                className="w-14 h-14 rounded-full bg-brand-red items-center justify-center shadow-lg">
                                <Ionicons
                                    name={isCurrentlyPlaying ? 'pause' : 'play'}
                                    size={24}
                                    color="white"
                                />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Stats Row */}
                    <View className="flex-row items-center px-6 mt-6 gap-4">
                        <TouchableOpacity onPress={openRatingModal} className="flex-row items-center gap-1">
                            <Image
                                source={icons.star}
                                style={{ width: 20, height: 20 }}
                                resizeMode="contain"
                            />
                            <Text className="font-jakarta text-brand-black dark:text-brand-dark-text">
                                {episode.averageRating > 0 ? episode.averageRating.toFixed(1) : 'Rate'}
                            </Text>
                        </TouchableOpacity>

                        <View className="flex-row items-center gap-1">
                            <Image
                                source={icons.language}
                                style={{ width: 20, height: 20 }}
                                resizeMode="contain"
                            />
                            <Text className="font-jakarta text-brand-black dark:text-brand-dark-text">
                                {episode.book?.language?.toUpperCase() || 'EN'}
                            </Text>
                        </View>

                        <View className="flex-row items-center gap-1">
                            <Image
                                source={icons.microphone}
                                style={{ width: 20, height: 20 }}
                                resizeMode="contain"
                            />
                            <Text className="font-jakarta text-brand-black dark:text-brand-dark-text">
                                {formatDuration(episode.duration)}
                            </Text>
                        </View>
                    </View>

                    {/* Generation Progress (if generating) */}
                    {isGenerating && (
                        <View className="px-6 mt-4">
                            <View
                                className="bg-[#F5F5F0] dark:bg-brand-dark-surface rounded-2xl p-4 items-center mb-3 justify-center shadow-md"
                                style={{
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 10,
                                    elevation: 8,
                                }}>
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-row items-center">
                                        <ActivityIndicator size="small" color="#BF9A54" />
                                        <Text className="font-inter-medium text-brand-black dark:text-brand-dark-text ml-2">
                                            Generating...
                                        </Text>
                                    </View>
                                    <Text className="font-jakarta-bold text-brand-gold">
                                        {generationProgress?.progress ?? 0}%
                                    </Text>
                                </View>
                                <View className="w-full h-2 bg-[#E8E3D6] rounded-full overflow-hidden">
                                    <View
                                        className="h-full bg-brand-gold rounded-full"
                                        style={{ width: `${generationProgress?.progress ?? 0}%` }}
                                    />
                                </View>
                                <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs mt-2 text-center">
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
                    <View className="flex-row justify-between mx-6 mt-6 border-b border-[#D7D7D7]">
                        <TouchableOpacity
                            onPress={() => setActiveTab('summary')}
                            className={`pb-3 mr-8 ${activeTab === 'summary' ? 'border-b-2 border-[#E06065]' : ''}`}>
                            <Text
                                className={`font-inter${activeTab === 'summary' ? '-medium' : ''} ${
                                    activeTab === 'summary' ? 'text-[#E06065]' : 'text-[#858585] dark:text-brand-dark-text-secondary'
                                } ml-1`}>
                                Summary
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('details')}
                            className={`pb-3 mr-8 ${activeTab === 'details' ? 'border-b-2 border-[#E06065]' : ''}`}>
                            <Text
                                className={`font-inter${activeTab === 'details' ? '-medium' : ''} ${
                                    activeTab === 'details' ? 'text-[#E06065]' : 'text-[#858585] dark:text-brand-dark-text-secondary'
                                }`}>
                                Details
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('author')}
                            className={`pb-3 mr-8 ${activeTab === 'author' ? 'border-b-2 border-[#E06065]' : ''}`}>
                            <Text
                                className={`font-inter${activeTab === 'author' ? '-medium' : ''} ${
                                    activeTab === 'author' ? 'text-[#E06065]' : 'text-[#858585] dark:text-brand-dark-text-secondary'
                                }`}>
                                Author
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('comments')}
                            className={`pb-3 ${activeTab === 'comments' ? 'border-b-2 border-[#E06065]' : ''}`}>
                            <Text
                                className={`font-inter${activeTab === 'comments' ? '-medium' : ''} ${
                                    activeTab === 'comments' ? 'text-[#E06065]' : 'text-[#858585] dark:text-brand-dark-text-secondary'
                                } mr-1`}>
                                Comments
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Content */}
                    {renderTabContent()}
            </KeyboardAwareScrollView>

            {/* Rating Modal */}
            <Modal
                visible={showRatingModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRatingModal(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowRatingModal(false)}
                    className="flex-1 bg-black/50 items-center justify-center"
                >
                    <View
                        className="bg-[#F5F0E8] dark:bg-brand-dark-surface rounded-3xl p-6 mx-8 w-[85%]"
                        onStartShouldSetResponder={() => true}
                    >
                        <Text className="font-inter-bold text-xl text-brand-black dark:text-brand-dark-text text-center mb-2">
                            Rate this Episode
                        </Text>
                        <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted text-center text-sm mb-6">
                            {episode?.title}
                        </Text>

                        {/* Star Selection */}
                        <View className="flex-row justify-center gap-3 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => setSelectedRating(star)}
                                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                >
                                    <Ionicons
                                        name={star <= selectedRating ? 'star' : 'star-outline'}
                                        size={36}
                                        color={star <= selectedRating ? '#BF9A54' : '#D1D5DB'}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            onPress={handleSubmitRating}
                            disabled={selectedRating === 0 || submittingRating}
                            className={`bg-brand-gold py-3 rounded-xl items-center ${selectedRating === 0 ? 'opacity-50' : ''}`}
                        >
                            {submittingRating ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="font-inter-bold text-white text-base">
                                    {userRating ? 'Update Rating' : 'Submit Rating'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}
