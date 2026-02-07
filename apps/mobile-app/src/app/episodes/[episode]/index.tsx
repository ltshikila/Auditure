import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Episode, EpisodeComment, AuthorInfo, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { usePlayback } from '@/contexts/PlaybackContext';
import { playbackService, GenerationProgress } from '@/services/playback.service';
import { resolveCoverUrl } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/contexts/AlertContext';
import { EpisodeDetailSkeleton } from '@/components/skeleton';

const icons = {
    star: require('@/assets/icons/star.png'),
    language: require('@/assets/icons/language.png'),
    microphone: require('@/assets/icons/microphone.png'),
    books: require('@/assets/icons/books_fill.png'),
    back: require('@/assets/icons/back.png'),
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

            // Fetch like status for the current user
            if (token) {
                try {
                    const { isLiked: liked } = await episodeService.getLikeStatus(episodeId, token);
                    setIsLiked(liked);
                } catch {
                    // Ignore — like status is non-critical
                }
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load episode');
        } finally {
            setLoading(false);
        }
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
            <SafeAreaView className="flex-1 bg-brand-beige">
                <EpisodeDetailSkeleton />
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
            {episode.summary || episode.description ? (
                <Text className="font-jakarta text-[#666666] leading-6 text-base">
                    {episode.summary || episode.description}
                </Text>
            ) : episode.scriptContent ? (
                <Text className="font-jakarta text-[#666666] leading-6 text-base">
                    {episode.scriptContent
                        .substring(0, 1000)
                        .replace(/^(HOST|GUEST|NARRATOR|HOST1|GUEST1|GUEST2):\s*/gim, '') + '...'}
                </Text>
            ) : (
                <View className="items-center py-12">
                    <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                    <Text className="font-inter text-gray-400 mt-4 text-center">
                        No summary available yet.
                    </Text>
                    <Text className="font-inter text-gray-400 text-sm text-center mt-1">
                        Summary will appear once the episode is generated.
                    </Text>
                </View>
            )}
        </View>
    );

    const renderDetailsTab = () => (
        <View className="px-6 mt-4 mb-32">
            <View className="bg-[#F5F5F0] rounded-2xl p-4" style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 3,
            }}>
                {/* Podcast */}
                <View className="flex-row items-center py-3 border-b border-gray-200">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="mic-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500">Podcaster</Text>
                        <Text className="font-inter-medium text-brand-black">
                            {episode.podcaster?.name || 'Virtual Podcaster'}
                        </Text>
                    </View>
                </View>

                {/* Episode Type */}
                <View className="flex-row items-center py-3 border-b border-gray-200">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="people-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500">Type</Text>
                        <Text className="font-inter-medium text-brand-black">
                            {getEpisodeTypeLabel(episode.episodeType)} ({getEpisodeThemeLabel(episode.episodeTheme)})
                        </Text>
                    </View>
                </View>

                {/* Duration */}
                <View className="flex-row items-center py-3 border-b border-gray-200">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="time-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500">Duration</Text>
                        <Text className="font-inter-medium text-brand-black">
                            {formatDuration(episode.duration)}
                        </Text>
                    </View>
                </View>

                {/* Format */}
                <View className="flex-row items-center py-3 border-b border-gray-200">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="musical-note-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500">Format</Text>
                        <Text className="font-inter-medium text-brand-black">
                            {episode.audioFormat?.toUpperCase() || 'MP3'}
                        </Text>
                    </View>
                </View>

                {/* Plays */}
                <View className="flex-row items-center py-3 border-b border-gray-200">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="play-circle-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500">Total Plays</Text>
                        <Text className="font-inter-medium text-brand-black">
                            {episode.playCount.toLocaleString()}
                        </Text>
                    </View>
                </View>

                {/* Likes */}
                <View className="flex-row items-center py-3 border-b border-gray-200">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="heart-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500">Likes</Text>
                        <Text className="font-inter-medium text-brand-black">
                            {episode.likeCount.toLocaleString()}
                        </Text>
                    </View>
                </View>

                {/* Upload Date */}
                <View className="flex-row items-center py-3">
                    <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                        <Ionicons name="calendar-outline" size={16} color="#BF9A54" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-inter text-xs text-gray-500">Created</Text>
                        <Text className="font-inter-medium text-brand-black">
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
                    <Text className="font-inter text-gray-500 mt-4">Loading author info...</Text>
                </View>
            );
        }

        if (authorError) {
            return (
                <View className="px-6 mt-4 mb-32 items-center py-12">
                    <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
                    <Text className="font-inter text-gray-500 mt-4 text-center">{authorError}</Text>
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
                    <Text className="font-inter text-gray-400 mt-4 text-center">
                        Author information not available.
                    </Text>
                    {episode.book?.author && (
                        <Text className="font-inter text-gray-500 text-sm mt-2">
                            Book by: {episode.book.author}
                        </Text>
                    )}
                </View>
            );
        }

        return (
            <View className="px-6 mt-4 mb-32">
                <View className="bg-[#F5F5F0] rounded-2xl p-5" style={{
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
                                className="w-16 h-16 rounded-full bg-gray-200"
                                onError={() => setAuthorImageFailed(true)}
                                onLoad={(e) => {
                                    // Open Library returns a 1x1 placeholder for missing images
                                    const { width, height } = e.nativeEvent.source;
                                    if (width < 10 || height < 10) {
                                        setAuthorImageFailed(true);
                                    }
                                }}
                            />
                        ) : (
                            <View className="w-16 h-16 bg-brand-gold rounded-full items-center justify-center">
                                <Text className="font-jakarta-bold text-white text-xl">
                                    {authorInfo.name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View className="ml-4 flex-1">
                            <Text className="font-inter-bold text-lg text-brand-black">
                                {authorInfo.name}
                            </Text>
                            {(authorInfo.birthDate || authorInfo.deathDate) && (
                                <Text className="font-inter text-gray-500 text-sm">
                                    {authorInfo.birthDate}
                                    {authorInfo.deathDate ? ` - ${authorInfo.deathDate}` : ''}
                                </Text>
                            )}
                            {authorInfo.works && (
                                <Text className="font-inter text-brand-gold text-sm">
                                    {authorInfo.works.toLocaleString()} known works
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Bio */}
                    {authorInfo.bio && (
                        <View className="mt-2">
                            <Text className="font-inter-medium text-brand-black mb-2">About</Text>
                            <Text className="font-jakarta text-[#666666] leading-6">
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
                    <View className="w-10 h-10 bg-brand-gold rounded-full items-center justify-center mr-3">
                        <Text className="font-jakarta-bold text-white">
                            {user?.firstName?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                    </View>
                    <View className="flex-1 flex-row bg-[#F5F5F0] rounded-full items-center pr-2">
                        <TextInput
                            value={newComment}
                            onChangeText={setNewComment}
                            placeholder="Add a comment..."
                            placeholderTextColor="#858585"
                            className="flex-1 font-inter text-brand-black px-4 py-3"
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
                        <Text className="font-inter text-gray-500 mt-4">Loading comments...</Text>
                    </View>
                ) : commentsError ? (
                    <View className="items-center py-12">
                        <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
                        <Text className="font-inter text-gray-500 mt-4 text-center">
                            {commentsError}
                        </Text>
                        <TouchableOpacity onPress={fetchComments} className="mt-4">
                            <Text className="font-inter-medium text-brand-gold">Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : comments.length === 0 ? (
                    <View className="items-center py-12">
                        <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                        <Text className="font-inter text-gray-400 mt-4 text-center">
                            No comments yet.
                        </Text>
                        <Text className="font-inter text-gray-400 text-sm text-center mt-1">
                            Be the first to share your thoughts!
                        </Text>
                    </View>
                ) : (
                    <View>
                        <Text className="font-inter-medium text-gray-500 mb-4">
                            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                        </Text>
                        {comments.map((comment) => (
                            <View key={comment.id} className="mb-4">
                                <View className="flex-row items-start">
                                    <View className="w-10 h-10 bg-brand-gold/80 rounded-full items-center justify-center mr-3">
                                        <Text className="font-jakarta-bold text-white text-sm">
                                            {comment.user.firstName.charAt(0).toUpperCase()}
                                            {comment.user.lastName.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center justify-between">
                                            <Text className="font-inter-medium text-brand-black">
                                                {comment.user.firstName} {comment.user.lastName}
                                            </Text>
                                            <Text className="font-inter text-gray-400 text-xs">
                                                {formatTimeAgo(comment.createdAt)}
                                            </Text>
                                        </View>
                                        <Text className="font-inter text-[#666666] mt-1 leading-5">
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
        <SafeAreaView edges={['top']} className="flex-1 bg-brand-beige">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1">
                <ScrollView showsVerticalScrollIndicator={false} className="pb-32">
                    {/* Header */}
                    <View className="px-6 pb-2 flex-row items-center justify-between">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 items-center justify-center -ml-2">
                            <Image source={icons.back} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
                        </TouchableOpacity>
                        <Text className="font-jakarta-medium text-lg text-brand-black">About</Text>
                        <TouchableOpacity
                            onPress={handleLike}
                            className="w-10 h-10 items-center justify-center">
                            <Ionicons
                                name={isLiked ? 'heart' : 'heart-outline'}
                                size={24}
                                color="#E8847C"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Book Cover */}
                    <View className="px-6 pt-4 items-center">
                        <View
                            className="rounded-xl overflow-hidden bg-brand-input"
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
                            <Text className="font-inter text-2xl text-brand-black">
                                {episode.title}
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    if (episode.podcaster?.id) {
                                        router.push(`/podcasts/${episode.podcaster.id}`);
                                    }
                                }}
                                disabled={!episode.podcaster?.id}>
                                <Text className="font-jakarta text-[#858585] mt-1">
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
                        <View className="flex-row items-center gap-1">
                            <Image
                                source={icons.star}
                                style={{ width: 20, height: 20 }}
                                resizeMode="contain"
                            />
                            <Text className="font-jakarta text-brand-black">4.5</Text>
                        </View>

                        <View className="flex-row items-center gap-1">
                            <Image
                                source={icons.language}
                                style={{ width: 20, height: 20 }}
                                resizeMode="contain"
                            />
                            <Text className="font-jakarta text-brand-black">
                                {episode.book?.language?.toUpperCase() || 'EN'}
                            </Text>
                        </View>

                        <View className="flex-row items-center gap-1">
                            <Image
                                source={icons.microphone}
                                style={{ width: 20, height: 20 }}
                                resizeMode="contain"
                            />
                            <Text className="font-jakarta text-brand-black">
                                {formatDuration(episode.duration)}
                            </Text>
                        </View>
                    </View>

                    {/* Generation Progress (if generating) */}
                    {isGenerating && (
                        <View className="px-6 mt-4">
                            <View
                                className="bg-[#F5F5F0] rounded-2xl p-4 items-center mb-3 justify-center shadow-md"
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
                                        <Text className="font-inter-medium text-brand-black ml-2">
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
                                <Text className="font-inter text-[#858585] text-xs mt-2 text-center">
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
                                    activeTab === 'summary' ? 'text-[#E06065]' : 'text-[#858585]'
                                } ml-1`}>
                                Summary
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('details')}
                            className={`pb-3 mr-8 ${activeTab === 'details' ? 'border-b-2 border-[#E06065]' : ''}`}>
                            <Text
                                className={`font-inter${activeTab === 'details' ? '-medium' : ''} ${
                                    activeTab === 'details' ? 'text-[#E06065]' : 'text-[#858585]'
                                }`}>
                                Details
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('author')}
                            className={`pb-3 mr-8 ${activeTab === 'author' ? 'border-b-2 border-[#E06065]' : ''}`}>
                            <Text
                                className={`font-inter${activeTab === 'author' ? '-medium' : ''} ${
                                    activeTab === 'author' ? 'text-[#E06065]' : 'text-[#858585]'
                                }`}>
                                Author
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('comments')}
                            className={`pb-3 ${activeTab === 'comments' ? 'border-b-2 border-[#E06065]' : ''}`}>
                            <Text
                                className={`font-inter${activeTab === 'comments' ? '-medium' : ''} ${
                                    activeTab === 'comments' ? 'text-[#E06065]' : 'text-[#858585]'
                                } mr-1`}>
                                Comments
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Content */}
                    {renderTabContent()}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
