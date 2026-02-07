import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useCallback,
    ReactNode,
} from 'react';
import TrackPlayer, {
    State,
    Capability,
    Event,
    usePlaybackState,
    useProgress,
    useTrackPlayerEvents,
    AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import { Episode } from '@/services/episode.service';
import { playbackService } from '@/services/playback.service';
import { storageService } from '@/services/storage.service';
import { resolveCoverUrl } from '@/services/api';
import { useAuth } from './AuthContext';

interface PlaybackState {
    episode: Episode | null;
    isPlaying: boolean;
    isLoading: boolean;
    position: number; // in milliseconds
    duration: number; // in milliseconds
    playbackRate: number;
}

interface PlaybackContextType extends PlaybackState {
    play: (episode: Episode) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    seekTo: (positionMs: number) => Promise<void>;
    skipForward: (seconds?: number) => Promise<void>;
    skipBackward: (seconds?: number) => Promise<void>;
    setPlaybackRate: (rate: number) => Promise<void>;
    stop: () => Promise<void>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const usePlayback = () => {
    const context = useContext(PlaybackContext);
    if (!context) {
        throw new Error('usePlayback must be used within PlaybackProvider');
    }
    return context;
};

// ---- Track Player Setup ----

let isPlayerSetup = false;

async function setupPlayer(): Promise<void> {
    if (isPlayerSetup) return;

    try {
        await TrackPlayer.setupPlayer({
            minBuffer: 30,
            maxBuffer: 120,
            playBuffer: 5,
            backBuffer: 30,
        });

        await TrackPlayer.updateOptions({
            capabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.Stop,
                Capability.SeekTo,
                Capability.JumpForward,
                Capability.JumpBackward,
            ],
            compactCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.JumpForward,
                Capability.JumpBackward,
            ],
            forwardJumpInterval: 10,
            backwardJumpInterval: 10,
            android: {
                appKilledPlaybackBehavior:
                    AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
            },
        });

        isPlayerSetup = true;
    } catch (error) {
        // setupPlayer throws if already initialized - that's OK
        if ((error as Error).message?.includes('already been initialized')) {
            isPlayerSetup = true;
        } else {
            console.error('Error setting up TrackPlayer:', error);
        }
    }
}

// ---- Provider Component ----

interface PlaybackProviderProps {
    children: ReactNode;
}

export const PlaybackProvider: React.FC<PlaybackProviderProps> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const saveProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasIncrementedPlayCount = useRef<boolean>(false);
    const wasAuthenticatedRef = useRef<boolean>(isAuthenticated);
    const episodeRef = useRef<Episode | null>(null);

    const [episode, setEpisode] = useState<Episode | null>(null);
    const [playbackRate, setPlaybackRateState] = useState(1.0);
    const [isLoading, setIsLoading] = useState(false);

    // RNTP hooks for reactive state
    const playbackState = usePlaybackState();
    const progress = useProgress(500);

    // Derive isPlaying from RNTP state
    const isPlaying = playbackState.state === State.Playing;

    // Convert RNTP progress (seconds) to milliseconds for API compatibility
    const positionMs = Math.round(progress.position * 1000);
    const durationMs = Math.round(progress.duration * 1000);

    // Keep episodeRef in sync
    useEffect(() => {
        episodeRef.current = episode;
    }, [episode]);

    // Setup player on mount
    useEffect(() => {
        setupPlayer();
        return () => {
            cleanup();
        };
    }, []);

    // Handle playback state changes for loading indicator
    useEffect(() => {
        const state = playbackState.state;
        setIsLoading(
            state === State.Loading ||
            state === State.Buffering ||
            state === State.Connecting
        );
    }, [playbackState.state]);

    // Handle track ending
    useTrackPlayerEvents(
        [Event.PlaybackQueueEnded],
        async (event) => {
            if (event.track !== undefined) {
                await saveProgress();
                setEpisode(null);
                episodeRef.current = null;
            }
        }
    );

    // Stop playback when user logs out
    useEffect(() => {
        if (wasAuthenticatedRef.current && !isAuthenticated) {
            stopPlayback();
        }
        wasAuthenticatedRef.current = isAuthenticated;
    }, [isAuthenticated]);

    // ---- Progress Saving ----

    const saveProgress = useCallback(async () => {
        if (!episodeRef.current) return;
        try {
            const token = await storageService.getAccessToken();
            const currentProgress = await TrackPlayer.getProgress();
            const currentPositionMs = Math.round(currentProgress.position * 1000);
            if (token && currentPositionMs > 0) {
                await playbackService.saveProgress(
                    episodeRef.current.id,
                    currentPositionMs,
                    token
                );
            }
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }, []);

    const startProgressSaving = useCallback(() => {
        if (saveProgressIntervalRef.current) {
            clearInterval(saveProgressIntervalRef.current);
        }
        saveProgressIntervalRef.current = setInterval(() => {
            saveProgress();
        }, 10000);
    }, [saveProgress]);

    const stopProgressSaving = useCallback(() => {
        if (saveProgressIntervalRef.current) {
            clearInterval(saveProgressIntervalRef.current);
            saveProgressIntervalRef.current = null;
        }
    }, []);

    // ---- Cleanup ----

    const cleanup = async () => {
        stopProgressSaving();
        try {
            await TrackPlayer.reset();
        } catch (error) {
            console.error('Error resetting TrackPlayer:', error);
        }
    };

    // ---- Playback Actions ----

    const play = useCallback(async (ep: Episode) => {
        setIsLoading(true);
        setEpisode(ep);
        episodeRef.current = ep;
        hasIncrementedPlayCount.current = false;

        // Save progress for previous track before switching
        stopProgressSaving();
        await saveProgress();

        try {
            await TrackPlayer.reset();

            // Get resume position
            const token = await storageService.getAccessToken();
            let initialPositionSec = 0;
            if (token) {
                const savedProgress = await playbackService.getProgress(ep.id, token);
                if (savedProgress?.position) {
                    initialPositionSec = savedProgress.position / 1000;
                }
            }

            // Build stream URL with auth header
            const streamUrl = playbackService.getStreamUrl(ep.id);
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Resolve artwork URL
            const artwork = resolveCoverUrl(ep.book?.coverImageUrl) || undefined;

            // Add track to queue
            await TrackPlayer.add({
                id: ep.id,
                url: streamUrl,
                headers: headers,
                title: ep.title,
                artist: ep.book?.author || ep.podcaster?.name || 'Auditure',
                album: ep.book?.title || '',
                artwork: artwork,
                duration: ep.duration ? ep.duration : undefined,
            });

            // Seek to saved position before playing
            if (initialPositionSec > 0) {
                await TrackPlayer.seekTo(initialPositionSec);
            }

            // Restore playback rate
            if (playbackRate !== 1.0) {
                await TrackPlayer.setRate(playbackRate);
            }

            await TrackPlayer.play();
            startProgressSaving();

            // Increment play count (once per session)
            if (!hasIncrementedPlayCount.current) {
                await playbackService.incrementPlayCount(ep.id);
                hasIncrementedPlayCount.current = true;
            }
        } catch (error) {
            console.error('Error playing episode:', error);
            setIsLoading(false);
            setEpisode(null);
            episodeRef.current = null;
        }
    }, [playbackRate, saveProgress, startProgressSaving, stopProgressSaving]);

    const pause = useCallback(async () => {
        try {
            await TrackPlayer.pause();
            await saveProgress();
        } catch (error) {
            console.error('Error pausing:', error);
        }
    }, [saveProgress]);

    const resume = useCallback(async () => {
        try {
            await TrackPlayer.play();
        } catch (error) {
            console.error('Error resuming:', error);
        }
    }, []);

    const seekTo = useCallback(async (posMs: number) => {
        try {
            await TrackPlayer.seekTo(posMs / 1000);
        } catch (error) {
            console.error('Error seeking:', error);
        }
    }, []);

    const skipForward = useCallback(async (seconds: number = 30) => {
        try {
            await TrackPlayer.seekBy(seconds);
        } catch (error) {
            console.error('Error skipping forward:', error);
        }
    }, []);

    const skipBackward = useCallback(async (seconds: number = 10) => {
        try {
            await TrackPlayer.seekBy(-seconds);
        } catch (error) {
            console.error('Error skipping backward:', error);
        }
    }, []);

    const setPlaybackRate = useCallback(async (rate: number) => {
        try {
            await TrackPlayer.setRate(rate);
            setPlaybackRateState(rate);
        } catch (error) {
            console.error('Error setting playback rate:', error);
            setPlaybackRateState(rate);
        }
    }, []);

    const stopPlayback = useCallback(async () => {
        stopProgressSaving();
        try {
            await saveProgress();
            await TrackPlayer.reset();
        } catch (error) {
            console.error('Error stopping:', error);
        }

        hasIncrementedPlayCount.current = false;
        setEpisode(null);
        episodeRef.current = null;
        setPlaybackRateState(1.0);
    }, [saveProgress, stopProgressSaving]);

    return (
        <PlaybackContext.Provider
            value={{
                episode,
                isPlaying,
                isLoading,
                position: positionMs,
                duration: durationMs,
                playbackRate,
                play,
                pause,
                resume,
                seekTo,
                skipForward,
                skipBackward,
                setPlaybackRate,
                stop: stopPlayback,
            }}
        >
            {children}
        </PlaybackContext.Provider>
    );
};
