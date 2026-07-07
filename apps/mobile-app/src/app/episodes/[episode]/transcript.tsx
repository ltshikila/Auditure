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
import { episodeService, Episode, TranscriptSegment } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { usePlayback } from '@/contexts/PlaybackContext';
import { MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';
import { resolveCoverUrl } from '@/services/api';
import { TranscriptSkeleton } from '@/components/skeleton';
import { useIsDark } from '@/hooks/use-colors';

const booksIcon = require('@/assets/icons/books_fill.png');
const backIcon = require('@/assets/icons/back.png');

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LINE_HEIGHT = 64;

// Live sync (highlight + auto-scroll + tap-to-seek) turns on per-episode when the
// backend ships real forced-alignment timestamps (episode.transcriptSegments).
// Episodes without segments fall back to a static, word-count-estimated transcript
// (no sync), since estimated timing is too inaccurate to track playback.
// Master kill-switch: set to false to force every episode back to static mode.
const SYNC_MASTER_ENABLED = true;

// Advance the highlight slightly to counter position-polling latency. Position is
// polled every 250ms, so the sample can be up to 250ms stale; leading by ~half the
// poll interval centers the error (instead of a full 250ms lead, which pushed the
// highlight AHEAD of the voice at line transitions). Tune if needed.
const SYNC_LEAD_MS = 125;

const LIGHT_COLORS = {
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

const DARK_COLORS = {
    background: '#151718',
    backgroundRgb: '21, 23, 24',
    textCurrent: '#ECEDEE',
    textPast: '#4A4E52',
    textFuture: '#687076',
    accent: '#BF9A54',
    accentBg: 'rgba(191, 154, 84, 0.18)',
    border: '#2E3235',
    icon: '#ECEDEE',
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

// Map real alignment segments (seconds) to the screen's TranscriptLine shape (ms).
function segmentsToLines(segments: TranscriptSegment[]): TranscriptLine[] {
    return segments.map((seg, index) => ({
        id: `seg-${index}`,
        text: seg.text,
        startTime: seg.start * 1000,
        endTime: seg.end * 1000,
    }));
}

function getCurrentLineIndex(lines: TranscriptLine[], positionMs: number, enabled: boolean): number {
    // No real timing for this episode — render statically, nothing highlighted.
    if (!enabled || lines.length === 0) return -1;

    // Before the first line starts, treat the first line as the (upcoming) current one.
    if (positionMs < lines[0].startTime) return 0;

    // The current line is the LAST line that has started by now. Using "has started"
    // (rather than start <= pos < end) keeps the highlight stable across the small
    // silent gaps between lines instead of snapping back to the top.
    let lo = 0;
    let hi = lines.length - 1;
    let idx = 0;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid].startTime <= positionMs) {
            idx = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return idx;
}

const TranscriptLineItem = React.memo(({
    item,
    index,
    currentIndex,
    onPress,
    palette,
}: {
    item: TranscriptLine;
    index: number;
    currentIndex: number;
    onPress: (index: number) => void;
    palette: typeof LIGHT_COLORS;
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
                paddingVertical: 14,
            }}
        >
            <Text
                style={{
                    fontSize: isCurrent ? 22 : 17,
                    fontWeight: isCurrent ? '700' : '400',
                    color: syncDisabled ? palette.textCurrent : (isCurrent ? palette.accent : isPast ? palette.textPast : palette.textFuture),
                    textAlign: 'center',
                    lineHeight: isCurrent ? 30 : 24,
                }}
            >
                {item.text}
            </Text>
        </TouchableOpacity>
    );
}, (prev, next) => {
    // Re-render when the line's "current" OR "past" state changes (so colors update as
    // the highlight passes), or when its content / palette changes.
    const sameCurrent = (prev.index === prev.currentIndex) === (next.index === next.currentIndex);
    const samePast = (prev.index < prev.currentIndex) === (next.index < next.currentIndex);
    return prev.item.id === next.item.id &&
           prev.item.text === next.item.text &&
           sameCurrent &&
           samePast &&
           prev.palette === next.palette;
});

TranscriptLineItem.displayName = 'TranscriptLineItem';

export default function TranscriptScreen() {
    const { episode: episodeId } = useLocalSearchParams<{ episode: string }>();
    const insets = useSafeAreaInsets();
    const isDark = useIsDark();
    const COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;
    const [episode, setEpisode] = useState<Episode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userScrolling, setUserScrolling] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastScrolledIndex = useRef<number>(-1);
    const hasInitialScrolled = useRef(false);

    const {
        episode: playbackEpisode,
        position,
        duration,
        play,
        seekTo,
    } = usePlayback();

    const isPlaybackEpisode = playbackEpisode?.id === episodeId;
    const displayEpisode = isPlaybackEpisode ? playbackEpisode : episode;
    const currentPosition = isPlaybackEpisode ? position : 0;
    const totalDuration = isPlaybackEpisode ? duration : (episode?.duration ?? 0) * 1000;

    // Live sync is on only when this episode has real alignment segments.
    const hasTiming = SYNC_MASTER_ENABLED && (displayEpisode?.transcriptSegments?.length ?? 0) > 0;

    const transcriptLines = useMemo(() => {
        const segments = displayEpisode?.transcriptSegments;
        if (segments && segments.length > 0) {
            return segmentsToLines(segments);
        }
        // Fallback: static transcript with estimated (non-synced) timing.
        if (!displayEpisode?.scriptContent || totalDuration <= 0) return [];
        return parseTranscript(displayEpisode.scriptContent, totalDuration);
    }, [displayEpisode?.scriptContent, displayEpisode?.transcriptSegments, totalDuration]);

    const currentLineIndex = useMemo(() => {
        if (transcriptLines.length === 0) return 0;
        return getCurrentLineIndex(transcriptLines, currentPosition + SYNC_LEAD_MS, hasTiming);
    }, [transcriptLines, currentPosition, hasTiming]);

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
        // Keep the current line centered as playback advances — and right when the
        // screen opens. Deliberately NOT gated on isPlaying, so opening the transcript
        // (or scrubbing while paused) still snaps to the right line. The userScrolling
        // guard yields to manual scrolling for a couple of seconds.
        if (!hasTiming || userScrolling) return;
        if (transcriptLines.length === 0 || currentLineIndex < 0) return;
        if (currentLineIndex === lastScrolledIndex.current) return;

        lastScrolledIndex.current = currentLineIndex;
        // First sync (on open) jumps instantly; later updates animate smoothly.
        const animated = hasInitialScrolled.current;
        hasInitialScrolled.current = true;
        flatListRef.current?.scrollToIndex({
            index: currentLineIndex,
            animated,
            viewPosition: 0.5,
        });
    }, [currentLineIndex, userScrolling, transcriptLines.length, hasTiming]);

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
        // Tap-to-seek only when we have real timing; otherwise just scroll/read.
        if (!hasTiming) return;
        if (isPlaybackEpisode) {
            await seekTo(line.startTime);
        } else if (displayEpisode) {
            await play(displayEpisode);
            setTimeout(() => seekTo(line.startTime), 300);
        }
    }, [transcriptLines, isPlaybackEpisode, seekTo, play, displayEpisode, hasTiming]);

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
            palette={COLORS}
        />
    ), [currentLineIndex, handleLineTap, COLORS]);

    const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
        // The target row isn't measured yet (common when jumping far on open). Jump to an
        // estimated offset to force those rows to render, then land precisely on the row.
        const offset = Math.max(0, info.averageItemLength * info.index);
        flatListRef.current?.scrollToOffset({ offset, animated: false });
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.5 });
        }, 80);
    }, []);

    // Bottom padding to account for mini player
    const bottomPadding = MINI_PLAYER_HEIGHT + insets.bottom + 16;

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
                <TranscriptSkeleton />
            </SafeAreaView>
        );
    }

    if (error || !displayEpisode) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg items-center justify-center px-6">
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
            <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
                <View className="px-6 pt-4 pb-4 flex-row items-center justify-between border-b border-black/10 dark:border-white/10">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
                        <Image source={backIcon} style={{ width: 24, height: 24, tintColor: COLORS.icon }} />
                    </TouchableOpacity>
                    <Text className="font-jakarta-bold text-lg text-[#1A1C1E] dark:text-brand-dark-text">Transcript</Text>
                    <View className="w-10 h-10" />
                </View>
                <View className="flex-1 items-center justify-center px-6">
                    <Ionicons name="document-text-outline" size={64} color="#858585" />
                    <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-center mt-4 text-lg">
                        No transcript available
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Calculate header height for centering
    const headerHeight = SCREEN_HEIGHT * 0.3;

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
            {/* Header with book cover */}
            <View className="px-6 pt-2 pb-3 flex-row items-center border-b border-black/10 dark:border-white/10">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
                    <Image source={backIcon} style={{ width: 24, height: 24, tintColor: COLORS.icon }} />
                </TouchableOpacity>

                {/* Book cover thumbnail */}
                <View className="w-10 h-10 rounded-lg overflow-hidden bg-[#E8E3D6] dark:bg-brand-dark-input mx-3 items-center justify-center">
                    {resolveCoverUrl(displayEpisode.book?.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(displayEpisode.book?.coverImageUrl)! }}
                            style={{ width: 40, height: 40 }}
                            resizeMode="contain"
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center">
                            <Image source={booksIcon} style={{ width: 20, height: 20, tintColor: '#BF9A54' }} />
                        </View>
                    )}
                </View>

                <View className="flex-1 mr-2">
                    <Text className="font-jakarta-bold text-sm text-[#1A1C1E] dark:text-brand-dark-text" numberOfLines={1}>
                        {displayEpisode.title}
                    </Text>
                    {isPlaybackEpisode && (
                        <Text className="font-inter text-xs text-[#BF9A54] mt-0.5">
                            {formatTime(currentPosition)} / {formatTime(totalDuration)}
                        </Text>
                    )}
                </View>

                {/* Spacer to balance the back button */}
                <View className="w-10 h-10" />
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
