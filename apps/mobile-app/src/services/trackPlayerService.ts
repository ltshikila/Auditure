import TrackPlayer, { Event } from 'react-native-track-player';

/**
 * Background playback service registered as a headless task.
 * Handles remote events from notification panel, lock screen,
 * and Bluetooth devices even when the app is suspended.
 */
export async function PlaybackService() {
    TrackPlayer.addEventListener(Event.RemotePlay, () => {
        TrackPlayer.play();
    });

    TrackPlayer.addEventListener(Event.RemotePause, () => {
        TrackPlayer.pause();
    });

    TrackPlayer.addEventListener(Event.RemoteStop, () => {
        TrackPlayer.stop();
    });

    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
        TrackPlayer.seekTo(event.position);
    });

    TrackPlayer.addEventListener(Event.RemoteJumpForward, (event) => {
        TrackPlayer.seekBy(event.interval);
    });

    TrackPlayer.addEventListener(Event.RemoteJumpBackward, (event) => {
        TrackPlayer.seekBy(-event.interval);
    });

    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
        if (event.permanent) {
            await TrackPlayer.stop();
        } else if (event.paused) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    });
}
