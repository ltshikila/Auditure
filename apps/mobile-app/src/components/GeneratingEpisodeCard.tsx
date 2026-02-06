import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Episode, EpisodeStatus } from '@/services/episode.service';
import { resolveCoverUrl } from '@/services/api';

const booksIcon = require('@/assets/icons/books_fill.png');

interface GeneratingEpisodeCardProps {
    episode: Episode;
    onPress: () => void;
    onRetry?: () => void;
    onCancel?: () => void;
}

const statusMessages: Record<EpisodeStatus, string> = {
    PENDING: 'Queued...',
    SCRIPT_GENERATING: 'Writing script...',
    SCRIPT_GENERATED: 'Script ready',
    AUDIO_GENERATING: 'Generating audio...',
    COMPLETED: 'Complete!',
    FAILED: 'Failed',
};

// Progress values aligned with ai-worker/src/consumers/episode_consumer.py
const statusProgress: Record<EpisodeStatus, number> = {
    PENDING: 10,
    SCRIPT_GENERATING: 40,
    SCRIPT_GENERATED: 60,
    AUDIO_GENERATING: 80,
    COMPLETED: 100,
    FAILED: 0,
};

export const GeneratingEpisodeCard: React.FC<GeneratingEpisodeCardProps> = ({
    episode,
    onPress,
    onRetry,
    onCancel,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    const isProcessing = ['PENDING', 'SCRIPT_GENERATING', 'AUDIO_GENERATING'].includes(
        episode.generationStatus,
    );
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
                ]),
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
            className=" bg-[#F5F5F0] rounded-2xl p-4 items-center mb-3  justify-center shadow-md"
            style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
                elevation: 8,
            }}>
            <View className="flex-row">
                {/* Book Cover Thumbnail */}
                <View className="w-14 h-20 rounded-lg overflow-hidden bg-brand-input mr-3 items-center justify-center">
                    {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                            style={{ width: 56, height: 80 }}
                            resizeMode="contain"
                        />
                    ) : (
                        <View className="w-full h-full bg-brand-gold/20 items-center justify-center">
                            <Image source={booksIcon} style={{ width: 22, height: 22, tintColor: '#BF9A54' }} />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View className="flex-1 justify-start ">
                    <Text className="font-inter-medium text-[#1A1C1E] text-lg" numberOfLines={2}>
                        {episode.title}
                    </Text>
                    <Text className="font-inter text-[#858585] text-xs mt-1" numberOfLines={1}>
                        {episode.book?.title}
                    </Text>
                    {episode.podcaster?.name && (
                        <Text className="font-inter text-[#858585] text-xs mt-0.5" numberOfLines={1}>
                            by {episode.podcaster.name}
                        </Text>
                    )}
                </View>
            </View>

            {/* Progress Section */}
            <View className="mt-3 w-full">
                {/* Status Text */}
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                        {isProcessing && (
                            <Animated.View style={{ opacity: pulseAnim }}>
                                <Ionicons name="sync" size={12} color="#BF9A54" />
                            </Animated.View>
                        )}
                        {isFailed && <Ionicons name="alert-circle" size={12} color="#DC2626" />}
                        {episode.generationStatus === 'COMPLETED' && (
                            <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                        )}
                        <Text
                            className={`font-inter text-xs ml-1 ${
                                isFailed
                                    ? 'text-red-600'
                                    : episode.generationStatus === 'COMPLETED'
                                      ? 'text-green-600'
                                      : 'text-brand-gold'
                            }`}>
                            {statusMessages[episode.generationStatus]}
                        </Text>
                    </View>
                    <Text className="font-inter text-xs text-[#858585]">{progress}%</Text>
                </View>

                {/* Progress Bar */}
                <View className="w-full h-1.5 bg-[#E8E3D6] rounded-full overflow-hidden">
                    <Animated.View
                        className={`h-full rounded-full ${
                            isFailed
                                ? 'bg-red-500'
                                : episode.generationStatus === 'COMPLETED'
                                  ? 'bg-green-500'
                                  : 'bg-brand-gold'
                        }`}
                        style={{ width: progressWidth }}
                    />
                </View>

                {/* Error message and action buttons for failed */}
                {isFailed && (
                    <>
                        {episode.generationError && (
                            <Text className="font-inter text-xs text-red-500 mt-1" numberOfLines={2}>
                                {episode.generationError}
                            </Text>
                        )}
                        <View className="flex-row mt-2 gap-2">
                            <TouchableOpacity
                                onPress={onRetry}
                                className="flex-1 flex-row items-center justify-center bg-red-50 rounded-lg py-1.5">
                                <Ionicons name="refresh" size={12} color="#DC2626" />
                                <Text className="font-inter-medium text-xs text-red-600 ml-1">Retry</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={onCancel}
                                className="flex-1 flex-row items-center justify-center bg-gray-100 rounded-lg py-1.5">
                                <Ionicons name="close" size={12} color="#6B7280" />
                                <Text className="font-inter-medium text-xs text-gray-500 ml-1">Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
};
