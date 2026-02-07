import 'expo-router/entry';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/services/trackPlayerService';

// Register the RNTP background playback service.
// This must happen at module scope before the React tree mounts.
TrackPlayer.registerPlaybackService(() => PlaybackService);
