import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useRef,
    useCallback,
    ReactNode,
} from 'react';
import {
    Audio,
    AVPlaybackStatus,
    InterruptionModeIOS,
    InterruptionModeAndroid,
} from 'expo-av';
import { Episode } from '@/services/episode.service';
import { playbackService } from '@/services/playback.service';
import { storageService } from '@/services/storage.service';
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

interface PlaybackProviderProps {
    children: ReactNode;
}

export const PlaybackProvider: React.FC<PlaybackProviderProps> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const soundRef = useRef<Audio.Sound | null>(null);
    const saveProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasIncrementedPlayCount = useRef<boolean>(false);
    const positionRef = useRef<number>(0);
    const wasAuthenticatedRef = useRef<boolean>(isAuthenticated);

    const [state, setState] = useState<PlaybackState>({
        episode: null,
        isPlaying: false,
        isLoading: false,
        position: 0,
        duration: 0,
        playbackRate: 1.0,
    });

    // Setup audio mode on mount
    useEffect(() => {
        setupAudioMode();
        return () => {
            cleanup();
        };
    }, []);

    // Stop playback when user logs out
    useEffect(() => {
        // If user was authenticated but is no longer, stop playback
        if (wasAuthenticatedRef.current && !isAuthenticated) {
            cleanup();
            setState({
                episode: null,
                isPlaying: false,
                isLoading: false,
                position: 0,
                duration: 0,
                playbackRate: 1.0,
            });
        }
        wasAuthenticatedRef.current = isAuthenticated;
    }, [isAuthenticated]);

    const setupAudioMode = async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                interruptionModeIOS: InterruptionModeIOS.DuckOthers,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
                playThroughEarpieceAndroid: false,
            });
        } catch (error) {
            console.error('Error setting audio mode:', error);
        }
    };

    const cleanup = async () => {
        if (saveProgressIntervalRef.current) {
            clearInterval(saveProgressIntervalRef.current);
            saveProgressIntervalRef.current = null;
        }
        if (soundRef.current) {
            try {
                await soundRef.current.unloadAsync();
            } catch (error) {
                console.error('Error unloading sound:', error);
            }
            soundRef.current = null;
        }
    };

    const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            setState((prev) => ({ ...prev, isLoading: true }));
            return;
        }

        positionRef.current = status.positionMillis;

        setState((prev) => ({
            ...prev,
            isPlaying: status.isPlaying,
            isLoading: false,
            position: status.positionMillis,
            duration: status.durationMillis || prev.duration,
        }));

        // Handle playback finished
        if (status.didJustFinish) {
            setState((prev) => ({ ...prev, isPlaying: false, position: 0 }));
            positionRef.current = 0;
        }
    }, []);

    const saveProgress = useCallback(async () => {
        if (!state.episode) return;
        try {
            const token = await storageService.getAccessToken();
            if (token && positionRef.current > 0) {
                await playbackService.saveProgress(
                    state.episode.id,
                    positionRef.current,
                    token
                );
            }
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }, [state.episode]);

    const startProgressSaving = useCallback(() => {
        if (saveProgressIntervalRef.current) {
            clearInterval(saveProgressIntervalRef.current);
        }
        // Save progress every 10 seconds
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

    const play = useCallback(async (episode: Episode) => {
        setState((prev) => ({ ...prev, isLoading: true, episode }));
        hasIncrementedPlayCount.current = false;

        // Unload previous sound
        if (soundRef.current) {
            try {
                stopProgressSaving();
                await saveProgress();
                await soundRef.current.unloadAsync();
            } catch (error) {
                console.error('Error unloading previous sound:', error);
            }
            soundRef.current = null;
        }

        try {
            // Get resume position
            const token = await storageService.getAccessToken();
            let initialPosition = 0;
            if (token) {
                const progress = await playbackService.getProgress(episode.id, token);
                if (progress?.position) {
                    initialPosition = progress.position;
                }
            }

            // Build stream URL with auth header
            const streamUrl = playbackService.getStreamUrl(episode.id);
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            // Create and load sound
            const { sound } = await Audio.Sound.createAsync(
                { uri: streamUrl, headers },
                {
                    shouldPlay: true,
                    positionMillis: initialPosition,
                    progressUpdateIntervalMillis: 500,
                    rate: 1.0,
                    shouldCorrectPitch: true,
                },
                onPlaybackStatusUpdate
            );

            soundRef.current = sound;
            positionRef.current = initialPosition;
            startProgressSaving();

            // Increment play count (only once per play session)
            if (!hasIncrementedPlayCount.current) {
                await playbackService.incrementPlayCount(episode.id);
                hasIncrementedPlayCount.current = true;
            }
        } catch (error) {
            console.error('Error playing episode:', error);
            setState((prev) => ({ ...prev, isLoading: false, episode: null }));
        }
    }, [onPlaybackStatusUpdate, saveProgress, startProgressSaving, stopProgressSaving]);

    const pause = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.pauseAsync();
                await saveProgress();
            } catch (error) {
                console.error('Error pausing:', error);
            }
        }
    }, [saveProgress]);

    const resume = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.playAsync();
            } catch (error) {
                console.error('Error resuming:', error);
            }
        }
    }, []);

    const seekTo = useCallback(async (positionMs: number) => {
        if (soundRef.current) {
            try {
                await soundRef.current.setPositionAsync(positionMs);
                positionRef.current = positionMs;
            } catch (error) {
                console.error('Error seeking:', error);
            }
        }
    }, []);

    const skipForward = useCallback(async (seconds: number = 30) => {
        const newPosition = Math.min(
            positionRef.current + seconds * 1000,
            state.duration
        );
        await seekTo(newPosition);
    }, [state.duration, seekTo]);

    const skipBackward = useCallback(async (seconds: number = 10) => {
        const newPosition = Math.max(positionRef.current - seconds * 1000, 0);
        await seekTo(newPosition);
    }, [seekTo]);

    const setPlaybackRate = useCallback(async (rate: number) => {
        if (soundRef.current) {
            try {
                await soundRef.current.setRateAsync(rate, true);
                setState((prev) => ({ ...prev, playbackRate: rate }));
            } catch (error) {
                console.error('Error setting playback rate:', error);
            }
        } else {
            setState((prev) => ({ ...prev, playbackRate: rate }));
        }
    }, []);

    const stop = useCallback(async () => {
        stopProgressSaving();

        if (soundRef.current) {
            try {
                await saveProgress();
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch (error) {
                console.error('Error stopping:', error);
            }
            soundRef.current = null;
        }

        hasIncrementedPlayCount.current = false;
        positionRef.current = 0;

        setState({
            episode: null,
            isPlaying: false,
            isLoading: false,
            position: 0,
            duration: 0,
            playbackRate: 1.0,
        });
    }, [saveProgress, stopProgressSaving]);

    return (
        <PlaybackContext.Provider
            value={{
                ...state,
                play,
                pause,
                resume,
                seekTo,
                skipForward,
                skipBackward,
                setPlaybackRate,
                stop,
            }}
        >
            {children}
        </PlaybackContext.Provider>
    );
};
