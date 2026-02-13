import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Modal, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { usePlayback } from '@/contexts/PlaybackContext';
import { Episode, episodeService } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { resolveCoverUrl } from '@/services/api';

const icons = {
    star: require('@/assets/icons/star.png'),
    language: require('@/assets/icons/language.png'),
    microphone: require('@/assets/icons/microphone.png'),
    books: require('@/assets/icons/books_fill.png'),
};

// Returns first few lines of transcript as a static preview
// Note: Time-synced preview is disabled because TTS doesn't provide timing data
function getTranscriptPreview(scriptContent: string | null | undefined): string {
    if (!scriptContent) return '';

    // Parse script into lines
    const rawLines = scriptContent
        .split(/(?<=[.!?])\s+|(?=(?:HOST|GUEST|NARRATOR|HOST1|GUEST1|GUEST2):\s)/gi)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // Get first few meaningful lines for preview
    const previewLines: string[] = [];
    for (const line of rawLines) {
        const cleanLine = line.replace(/^(HOST|GUEST|NARRATOR|HOST1|GUEST1|GUEST2):\s*/i, '');
        if (cleanLine.length > 0) {
            previewLines.push(cleanLine);
            if (previewLines.join(' ').length > 150) break;
        }
    }

    return previewLines.join(' ').substring(0, 200);
}

export default function EpisodePlayScreen() {
    const { episode: episodeId } = useLocalSearchParams<{ episode: string }>();
    const { episode, position, duration, play, seekTo } = usePlayback();

    const [localEpisode, setLocalEpisode] = useState<Episode | null>(null);
    const [sliderValue, setSliderValue] = useState(0);
    const isSeekingRef = useRef(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [userRating, setUserRating] = useState<number | null>(null);
    const [selectedRating, setSelectedRating] = useState(0);
    const [submittingRating, setSubmittingRating] = useState(false);

    // If we don't have the episode in playback context, fetch it
    useEffect(() => {
        if (!episode || episode.id !== episodeId) {
            fetchAndPlayEpisode();
        }
    }, [episodeId]);

    const fetchAndPlayEpisode = async () => {
        if (!episodeId) return;

        try {
            const token = await storageService.getAccessToken();
            const fetchedEpisode = await episodeService.getEpisode(episodeId, token || undefined);
            setLocalEpisode(fetchedEpisode);

            // Fetch user's rating
            if (token) {
                try {
                    const rating = await episodeService.getEpisodeRating(episodeId, token);
                    setUserRating(rating.userRating);
                } catch { /* non-critical */ }
            }

            // Auto-play if episode is ready
            if (fetchedEpisode.generationStatus === 'COMPLETED') {
                await play(fetchedEpisode);
            }
        } catch (error) {
            console.error('Error fetching episode:', error);
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
            if (localEpisode) {
                setLocalEpisode({ ...localEpisode, averageRating: result.averageRating, ratingCount: result.ratingCount });
            }
            setShowRatingModal(false);
        } catch {
            // non-critical
        } finally {
            setSubmittingRating(false);
        }
    };

    const openRatingModal = () => {
        setSelectedRating(userRating || 0);
        setShowRatingModal(true);
    };

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Convert ms to seconds for slider (large ms values cause native precision issues)
    const positionSec = position / 1000;
    const durationSec = duration / 1000;

    // Update slider from playback progress only when not seeking
    useEffect(() => {
        if (!isSeekingRef.current) {
            setSliderValue(positionSec);
        }
    }, [positionSec]);

    const handleSliderStart = () => {
        isSeekingRef.current = true;
    };

    const handleSliderChange = (value: number) => {
        setSliderValue(value);
    };

    const handleSliderComplete = async (value: number) => {
        await seekTo(value * 1000); // Convert back to ms for seekTo
        setTimeout(() => {
            isSeekingRef.current = false;
        }, 300);
    };

    const handleShare = async () => {
        setShowMenu(false);
        if (!displayEpisode) return;
        try {
            await Share.share({
                message: `Listen to "${displayEpisode.title}" from ${displayEpisode.book?.title || 'Auditure'} on Auditure!`,
            });
        } catch {
            // user cancelled
        }
    };

    const handleViewDetails = () => {
        setShowMenu(false);
        if (episodeId) {
            router.push(`/episodes/${episodeId}`);
        }
    };

    const handleViewTranscript = () => {
        setShowMenu(false);
        if (episodeId) {
            router.push(`/episodes/${episodeId}/transcript`);
        }
    };

    const handleViewBook = () => {
        setShowMenu(false);
        if (displayEpisode?.book?.id) {
            router.push(`/${displayEpisode.book.id}`);
        }
    };

    const displayEpisode = episode?.id === episodeId ? episode : localEpisode;

    // Get static transcript preview (time sync not available)
    const transcriptPreview = useMemo(() => {
        return getTranscriptPreview(displayEpisode?.scriptContent);
    }, [displayEpisode?.scriptContent]);

    if (!displayEpisode) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
                <ActivityIndicator size="large" color="#BF9A54" />
                <Text className="font-inter text-[#858585] mt-4">Loading episode...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-brand-beige">
            {/* Header */}
            <View className="px-6 flex-row items-center justify-between">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center">
                    <Ionicons name="chevron-down" size={28} color="#1A1C1E" />
                </TouchableOpacity>
                <Text className="font-inter-medium text-brand-black">Now Playing</Text>
                <TouchableOpacity
                    onPress={() => setShowMenu(true)}
                    className="w-10 h-10 items-center justify-center">
                    <Ionicons name="ellipsis-horizontal" size={24} color="#1A1C1E" />
                </TouchableOpacity>
            </View>

            {/* Cover Art */}
            <View className="items-center mt-4">
                <View
                    className="rounded-2xl shadow-2xl bg-brand-input overflow-hidden"
                    style={{ borderRadius: 16 }}>
                    {resolveCoverUrl(displayEpisode.book?.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(displayEpisode.book?.coverImageUrl)! }}
                            style={{ width: 195, height: 292, borderRadius: 16 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-[195px] h-[292px] bg-brand-gold/20 items-center justify-center">
                            <Image source={icons.books} style={{ width: 80, height: 80, tintColor: '#BF9A54' }} />
                        </View>
                    )}
                </View>
            </View>

            {/* Info */}
            <View className="mt-6">
                <Text
                    className="font-inter text-2xl text-brand-black text-center"
                    numberOfLines={2}>
                    {displayEpisode.title}
                </Text>
                <Text className="font-jakarta text-[#858585] text-center mt-1">
                    {displayEpisode.book?.title}
                </Text>
            </View>

            {/* Stats Row */}
            <View className="flex-row items-center justify-center mt-4 gap-4">
                <TouchableOpacity onPress={openRatingModal} className="flex-row items-center gap-1">
                    <Image
                        source={icons.star}
                        style={{ width: 20, height: 20 }}
                        resizeMode="contain"
                    />
                    <Text className="font-jakarta text-brand-black">
                        {displayEpisode.averageRating > 0 ? displayEpisode.averageRating.toFixed(1) : 'Rate'}
                    </Text>
                </TouchableOpacity>
                <View className="flex-row items-center gap-1">
                    <Image
                        source={icons.language}
                        style={{ width: 20, height: 20 }}
                        resizeMode="contain"
                    />
                    <Text className="font-jakarta text-brand-black">English</Text>
                </View>
                <View className="flex-row items-center gap-1">
                    <Image
                        source={icons.microphone}
                        style={{ width: 20, height: 20 }}
                        resizeMode="contain"
                    />
                    <Text className="font-jakarta text-brand-black">
                        {displayEpisode.duration
                            ? `${Math.floor(displayEpisode.duration / 60)} min`
                            : '--'}
                    </Text>
                </View>
            </View>

            {/* Progress Slider */}
            <View className="px-6 mt-6">
                <Slider
                    value={sliderValue}
                    minimumValue={0}
                    maximumValue={durationSec || 1}
                    step={1}
                    onSlidingStart={handleSliderStart}
                    onValueChange={handleSliderChange}
                    onSlidingComplete={handleSliderComplete}
                    minimumTrackTintColor="#BF9A54"
                    maximumTrackTintColor="#E8E3D6"
                    thumbTintColor="#BF9A54"
                />
                <View className="flex-row justify-between mt-1">
                    <Text className="font-inter text-xs text-[#858585]">
                        {formatTime(sliderValue * 1000)}
                    </Text>
                    <Text className="font-inter text-xs text-[#858585]">
                        {formatTime(duration)}
                    </Text>
                </View>
            </View>

            {/* Transcript Preview Card - with bottom padding for mini player */}
            {displayEpisode.scriptContent && (
                <TouchableOpacity
                    onPress={() => router.push(`/episodes/${episodeId}/transcript`)}
                    className="mx-6 mt-4 mb-28 bg-[#F5F5F0] rounded-2xl p-4 items-center justify-center shadow-md"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        elevation: 8,
                    }}
                    activeOpacity={0.9}>
                    <Text className="font-inter-medium self-start text-brand-red text-base mb-2">
                        Transcripts
                    </Text>
                    <Text className="font-jakarta text-[#858585] text-sm leading-5" numberOfLines={4}>
                        {transcriptPreview || displayEpisode.scriptContent.substring(0, 150)}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Options Menu */}
            <Modal
                visible={showMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMenu(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                    className="flex-1 bg-black/50 justify-end"
                >
                    <View
                        className="bg-[#F5F0E8] rounded-t-3xl px-6 pt-6 pb-10"
                        onStartShouldSetResponder={() => true}
                    >
                        {/* Handle indicator */}
                        <View className="w-10 h-1 bg-[#D8D2C2] rounded-full self-center mb-6" />

                        <TouchableOpacity
                            onPress={handleViewDetails}
                            className="flex-row items-center py-4"
                        >
                            <Ionicons name="information-circle-outline" size={22} color="#1A1C1E" />
                            <Text className="font-inter-medium text-brand-black text-base ml-4">Episode Details</Text>
                        </TouchableOpacity>

                        {displayEpisode?.scriptContent && (
                            <TouchableOpacity
                                onPress={handleViewTranscript}
                                className="flex-row items-center py-4"
                            >
                                <Ionicons name="document-text-outline" size={22} color="#1A1C1E" />
                                <Text className="font-inter-medium text-brand-black text-base ml-4">View Transcript</Text>
                            </TouchableOpacity>
                        )}

                        {displayEpisode?.book?.id && (
                            <TouchableOpacity
                                onPress={handleViewBook}
                                className="flex-row items-center py-4"
                            >
                                <Image source={icons.books} style={{ width: 22, height: 22, tintColor: '#1A1C1E' }} />
                                <Text className="font-inter-medium text-brand-black text-base ml-4">View Book</Text>
                            </TouchableOpacity>
                        )}

                        {/* Share Episode - hidden until deep linking is set up */}
                        {/* <TouchableOpacity
                            onPress={handleShare}
                            className="flex-row items-center py-4"
                        >
                            <Ionicons name="share-outline" size={22} color="#1A1C1E" />
                            <Text className="font-inter-medium text-brand-black text-base ml-4">Share Episode</Text>
                        </TouchableOpacity> */}
                    </View>
                </TouchableOpacity>
            </Modal>

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
                        className="bg-[#F5F0E8] rounded-3xl p-6 mx-8 w-[85%]"
                        onStartShouldSetResponder={() => true}
                    >
                        <Text className="font-inter-bold text-xl text-brand-black text-center mb-2">
                            Rate this Episode
                        </Text>
                        <Text className="font-inter text-gray-500 text-center text-sm mb-6" numberOfLines={2}>
                            {displayEpisode?.title}
                        </Text>

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
