import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    Dimensions,
    ListRenderItemInfo,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { episodeService, Episode } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { usePlayback } from '@/contexts/PlaybackContext';
import { MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';
import { resolveCoverUrl } from '@/services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LINE_HEIGHT = 64;

// NOTE: Transcript sync is disabled because TTS audio doesn't provide timing data.
// The word-count estimation is fundamentally inaccurate. To enable sync, we need
// to generate timestamps using speech recognition (e.g., Whisper) after TTS.
const SYNC_ENABLED = false;

const COLORS = {
    background: '#FBF8F2',
    backgroundRgb: '251, 248, 242',
    textCurrent: '#1A1C1E',
    textPast: '#C0C0C0',
    textFuture: '#858585',
    accent: '#BF9A54',
    accentBg: 'rgba(191, 154, 84, 0.12)',
    border: '#E8E3D6',
    icon: '#1A1C1E',
    error: '#920002',
};

interface TranscriptLine {
    id: string;
    text: string;
    startTime: number;
    endTime: number;
}

function parseTranscript(scriptContent: string, durationMs: number): TranscriptLine[] {
    if (!scriptContent || durationMs <= 0) return [];

    const rawLines = scriptContent
        .split(/(?<=[.!?])\s+|(?=(?:HOST|GUEST|NARRATOR|HOST1|GUEST1|GUEST2):\s)/gi)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    const lines: string[] = [];
    for (const line of rawLines) {
        if (line.length > 100) {
            const parts = line.split(/(?<=,)\s+|(?<=;)\s+/);
            if (parts.length > 1) {
                lines.push(...parts.filter(p => p.trim().length > 0));
            } else {
                let remaining = line;
                while (remaining.length > 80) {
                    const breakPoint = remaining.lastIndexOf(' ', 80);
                    if (breakPoint > 40) {
                        lines.push(remaining.substring(0, breakPoint).trim());
                        remaining = remaining.substring(breakPoint).trim();
                    } else {
                        break;
                    }
                }
                if (remaining.length > 0) lines.push(remaining);
            }
        } else {
            lines.push(line);
        }
    }

    const totalWords = lines.reduce((sum, line) =>
        sum + line.split(/\s+/).filter(w => w.length > 0).length, 0);

    if (totalWords === 0) return [];

    const msPerWord = durationMs / totalWords;
    let currentTime = 0;

    return lines.map((text, index) => {
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        const lineDuration = wordCount * msPerWord;
        const line: TranscriptLine = {
            id: `line-${index}`,
            text: text.replace(/^(HOST|GUEST|NARRATOR|HOST1|GUEST1|GUEST2):\s*/i, ''),
            startTime: currentTime,
            endTime: currentTime + lineDuration,
        };
        currentTime += lineDuration;
        return line;
    });
}

function getCurrentLineIndex(lines: TranscriptLine[], positionMs: number): number {
    // Sync disabled - timestamps are estimated and inaccurate
    if (!SYNC_ENABLED) return -1;

    for (let i = 0; i < lines.length; i++) {
        if (positionMs >= lines[i].startTime && positionMs < lines[i].endTime) {
            return i;
        }
    }
    if (lines.length > 0 && positionMs >= lines[lines.length - 1].endTime) {
        return lines.length - 1;
    }
    return 0;
}

const TranscriptLineItem = React.memo(({
    item,
    index,
    currentIndex,
    onPress
}: {
    item: TranscriptLine;
    index: number;
    currentIndex: number;
    onPress: (index: number) => void;
}) => {
    // When sync is disabled (currentIndex = -1), show all lines uniformly
    const syncDisabled = currentIndex < 0;
    const isCurrent = !syncDisabled && index === currentIndex;
    const isPast = !syncDisabled && index < currentIndex;

    return (
        <TouchableOpacity
            onPress={() => onPress(index)}
            activeOpacity={0.7}
            style={{
                minHeight: LINE_HEIGHT,
                justifyContent: 'center',
                paddingHorizontal: 24,
                paddingVertical: 12,
                backgroundColor: isCurrent ? COLORS.accentBg : 'transparent',
                borderRadius: isCurrent ? 12 : 0,
                marginHorizontal: isCurrent ? 12 : 0,
            }}
        >
            <Text
                style={{
                    fontSize: isCurrent ? 24 : 17,
                    fontWeight: isCurrent ? '700' : '400',
                    color: syncDisabled ? COLORS.textCurrent : (isCurrent ? COLORS.textCurrent : isPast ? COLORS.textPast : COLORS.textFuture),
                    textAlign: 'center',
                    lineHeight: isCurrent ? 32 : 24,
                }}
            >
                {item.text}
            </Text>
        </TouchableOpacity>
    );
}, (prev, next) => {
    // Simplified memo - only re-render if item changes or current state changes
    return prev.item.id === next.item.id &&
           (prev.index === prev.currentIndex) === (next.index === next.currentIndex);
});

export default function TranscriptScreen() {
    const { episode: episodeId } = useLocalSearchParams<{ episode: string }>();
    const insets = useSafeAreaInsets();
    const [episode, setEpisode] = useState<Episode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userScrolling, setUserScrolling] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastScrolledIndex = useRef<number>(-1);

    const {
        episode: playbackEpisode,
        position,
        duration,
        isPlaying,
        play,
        seekTo,
    } = usePlayback();

    const isPlaybackEpisode = playbackEpisode?.id === episodeId;
    const displayEpisode = isPlaybackEpisode ? playbackEpisode : episode;
    const currentPosition = isPlaybackEpisode ? position : 0;
    const totalDuration = isPlaybackEpisode ? duration : (episode?.duration ?? 0) * 1000;

    const transcriptLines = useMemo(() => {
        if (!displayEpisode?.scriptContent || totalDuration <= 0) return [];
        return parseTranscript(displayEpisode.scriptContent, totalDuration);
    }, [displayEpisode?.scriptContent, totalDuration]);

    const currentLineIndex = useMemo(() => {
        if (transcriptLines.length === 0) return 0;
        return getCurrentLineIndex(transcriptLines, currentPosition);
    }, [transcriptLines, currentPosition]);

    useEffect(() => {
        if (!isPlaybackEpisode) {
            fetchEpisode();
        } else {
            setLoading(false);
        }
    }, [episodeId, isPlaybackEpisode]);

    const fetchEpisode = async () => {
        if (!episodeId) return;
        try {
            setLoading(true);
            setError(null);
            const token = await storageService.getAccessToken();
            const data = await episodeService.getEpisode(episodeId, token || undefined);
            setEpisode(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load transcript');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Auto-scroll disabled - timestamps are estimated and inaccurate
        if (!SYNC_ENABLED) return;
        if (
            !userScrolling &&
            isPlaying &&
            transcriptLines.length > 0 &&
            currentLineIndex >= 0 &&
            currentLineIndex !== lastScrolledIndex.current
        ) {
            lastScrolledIndex.current = currentLineIndex;
            flatListRef.current?.scrollToIndex({
                index: currentLineIndex,
                animated: true,
                viewPosition: 0.5,
            });
        }
    }, [currentLineIndex, isPlaying, userScrolling, transcriptLines.length]);

    const handleScrollBegin = useCallback(() => {
        setUserScrolling(true);
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    }, []);

    const handleScrollEnd = useCallback(() => {
        scrollTimeout.current = setTimeout(() => setUserScrolling(false), 2000);
    }, []);

    const handleLineTap = useCallback(async (index: number) => {
        const line = transcriptLines[index];
        if (!line) return;
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        // Note: Seeking by line tap is disabled since timestamps are inaccurate
        // The user can still scroll and read the transcript manually
        if (!SYNC_ENABLED) return;
        if (isPlaybackEpisode) {
            await seekTo(line.startTime);
        } else if (displayEpisode) {
            await play(displayEpisode);
            setTimeout(() => seekTo(line.startTime), 300);
        }
    }, [transcriptLines, isPlaybackEpisode, seekTo, play, displayEpisode]);

    const formatTime = useCallback((ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Note: getItemLayout removed - items have variable height now

    const keyExtractor = useCallback((item: TranscriptLine) => item.id, []);

    const renderItem = useCallback(({ item, index }: ListRenderItemInfo<TranscriptLine>) => (
        <TranscriptLineItem
            item={item}
            index={index}
            currentIndex={currentLineIndex}
            onPress={handleLineTap}
        />
    ), [currentLineIndex, handleLineTap]);

    const onScrollToIndexFailed = useCallback((info: { index: number }) => {
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
        }, 100);
    }, []);

    // Bottom padding to account for mini player
    const bottomPadding = MINI_PLAYER_HEIGHT + insets.bottom + 16;

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
                <ActivityIndicator size="large" color={COLORS.accent} />
            </SafeAreaView>
        );
    }

    if (error || !displayEpisode) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center px-6">
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
                <Text className="font-inter text-[#920002] text-center mt-4">
                    {error || 'Episode not found'}
                </Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="mt-6 bg-brand-gold px-6 py-3 rounded-full"
                >
                    <Text className="font-inter-medium text-white">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (!displayEpisode.scriptContent || transcriptLines.length === 0) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige">
                <View className="px-6 pt-4 pb-4 flex-row items-center justify-between border-b border-[#E8E3D6]">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
                        <Ionicons name="arrow-back" size={24} color={COLORS.icon} />
                    </TouchableOpacity>
                    <Text className="font-jakarta-bold text-lg text-[#1A1C1E]">Transcript</Text>
                    <View className="w-10 h-10" />
                </View>
                <View className="flex-1 items-center justify-center px-6">
                    <Ionicons name="document-text-outline" size={64} color="#858585" />
                    <Text className="font-inter text-[#858585] text-center mt-4 text-lg">
                        No transcript available
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Calculate header height for centering
    const headerHeight = SCREEN_HEIGHT * 0.3;

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-brand-beige">
            {/* Header with book cover */}
            <View className="px-6 pt-2 pb-3 flex-row items-center border-b border-[#E8E3D6]">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
                    <Ionicons name="arrow-back" size={24} color={COLORS.icon} />
                </TouchableOpacity>

                {/* Book cover thumbnail */}
                <View className="w-10 h-10 rounded-lg overflow-hidden bg-[#E8E3D6] mx-3 items-center justify-center">
                    {resolveCoverUrl(displayEpisode.book?.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(displayEpisode.book?.coverImageUrl)! }}
                            style={{ width: 40, height: 40 }}
                            resizeMode="contain"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center">
                            <Ionicons name="book" size={18} color="#BF9A54" />
                        </View>
                    )}
                </View>

                <View className="flex-1 mr-2">
                    <Text className="font-jakarta-bold text-sm text-[#1A1C1E]" numberOfLines={1}>
                        {displayEpisode.title}
                    </Text>
                    {isPlaybackEpisode && (
                        <Text className="font-inter text-xs text-[#BF9A54] mt-0.5">
                            {formatTime(currentPosition)} / {formatTime(totalDuration)}
                        </Text>
                    )}
                </View>

                <TouchableOpacity className="w-10 h-10 items-center justify-center">
                    <Ionicons name="share-outline" size={22} color={COLORS.icon} />
                </TouchableOpacity>
            </View>

            {/* Transcript Container */}
            <View className="flex-1 relative">
                {/* Top Gradient */}
                <LinearGradient
                    colors={[COLORS.background, `rgba(${COLORS.backgroundRgb}, 0)`]}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 50,
                        zIndex: 10,
                        pointerEvents: 'none',
                    }}
                />

                {/* Virtualized Transcript */}
                <FlatList
                    ref={flatListRef}
                    data={transcriptLines}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    onScrollBeginDrag={handleScrollBegin}
                    onScrollEndDrag={handleScrollEnd}
                    onMomentumScrollEnd={handleScrollEnd}
                    onScrollToIndexFailed={onScrollToIndexFailed}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={11}
                    removeClippedSubviews={true}
                    ListHeaderComponent={<View style={{ height: headerHeight }} />}
                    ListFooterComponent={<View style={{ height: headerHeight + bottomPadding }} />}
                />

                {/* Bottom Gradient */}
                <LinearGradient
                    colors={[`rgba(${COLORS.backgroundRgb}, 0)`, COLORS.background]}
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 100,
                        zIndex: 10,
                        pointerEvents: 'none',
                    }}
                />
            </View>
        </SafeAreaView>
    );
}
