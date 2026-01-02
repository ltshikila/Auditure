import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Episode, EpisodeStatus } from '@/services/episode.service';

interface GeneratingEpisodeCardProps {
    episode: Episode;
    onPress: () => void;
}

const statusMessages: Record<EpisodeStatus, string> = {
    PENDING: 'Queued...',
    SCRIPT_GENERATING: 'Writing script...',
    SCRIPT_GENERATED: 'Script ready',
    AUDIO_GENERATING: 'Generating audio...',
    COMPLETED: 'Complete!',
    FAILED: 'Failed',
};

const statusProgress: Record<EpisodeStatus, number> = {
    PENDING: 10,
    SCRIPT_GENERATING: 35,
    SCRIPT_GENERATED: 50,
    AUDIO_GENERATING: 75,
    COMPLETED: 100,
    FAILED: 0,
};

export const GeneratingEpisodeCard: React.FC<GeneratingEpisodeCardProps> = ({ episode, onPress }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    const isProcessing = ['PENDING', 'SCRIPT_GENERATING', 'AUDIO_GENERATING'].includes(episode.generationStatus);
    const isFailed = episode.generationStatus === 'FAILED';
    const progress = statusProgress[episode.generationStatus];

    useEffect(() => {
        // Animate progress bar
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
        }).start();

        // Pulse animation for processing states
        if (isProcessing) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.6,
                        duration: 1000,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [episode.generationStatus, isProcessing]);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    return (
        <TouchableOpacity
            onPress={onPress}
            className="mr-4 bg-white rounded-xl p-3 shadow-sm"
            style={{ width: 200 }}
        >
            <View className="flex-row">
                {/* Book Cover Thumbnail */}
                <View className="w-14 h-20 rounded-lg overflow-hidden bg-brand-input mr-3">
                    {episode.book?.coverImageUrl ? (
                        <Image
                            source={{ uri: episode.book.coverImageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full bg-brand-gold/20 items-center justify-center">
                            <Ionicons name="book" size={20} color="#BF9A54" />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View className="flex-1 justify-center">
                    <Text className="font-inter-medium text-[#1A1C1E] text-sm" numberOfLines={2}>
                        {episode.title}
                    </Text>
                    <Text className="font-inter text-[#858585] text-xs mt-1" numberOfLines={1}>
                        {episode.book?.title}
                    </Text>
                </View>
            </View>

            {/* Progress Section */}
            <View className="mt-3">
                {/* Status Text */}
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                        {isProcessing && (
                            <Animated.View style={{ opacity: pulseAnim }}>
                                <Ionicons name="sync" size={12} color="#BF9A54" />
                            </Animated.View>
                        )}
                        {isFailed && (
                            <Ionicons name="alert-circle" size={12} color="#DC2626" />
                        )}
                        {episode.generationStatus === 'COMPLETED' && (
                            <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                        )}
                        <Text
                            className={`font-inter text-xs ml-1 ${
                                isFailed ? 'text-red-600' :
                                episode.generationStatus === 'COMPLETED' ? 'text-green-600' :
                                'text-brand-gold'
                            }`}
                        >
                            {statusMessages[episode.generationStatus]}
                        </Text>
                    </View>
                    <Text className="font-inter text-xs text-[#858585]">
                        {progress}%
                    </Text>
                </View>

                {/* Progress Bar */}
                <View className="h-1.5 bg-[#E8E3D6] rounded-full overflow-hidden">
                    <Animated.View
                        className={`h-full rounded-full ${
                            isFailed ? 'bg-red-500' :
                            episode.generationStatus === 'COMPLETED' ? 'bg-green-500' :
                            'bg-brand-gold'
                        }`}
                        style={{ width: progressWidth }}
                    />
                </View>

                {/* Retry button for failed */}
                {isFailed && (
                    <TouchableOpacity className="mt-2 flex-row items-center justify-center bg-red-50 rounded-lg py-1.5">
                        <Ionicons name="refresh" size={12} color="#DC2626" />
                        <Text className="font-inter-medium text-xs text-red-600 ml-1">Retry</Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
};
