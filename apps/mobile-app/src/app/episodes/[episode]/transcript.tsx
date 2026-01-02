import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { episodeService, Episode } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';

export default function TranscriptScreen() {
    const { episode: episodeId } = useLocalSearchParams<{ episode: string }>();
    const [episode, setEpisode] = useState<Episode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchEpisode();
    }, [episodeId]);

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

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
                <ActivityIndicator size="large" color="#BF9A54" />
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
                    className="mt-6 bg-brand-gold px-6 py-3 rounded-full"
                >
                    <Text className="font-inter-medium text-white">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-brand-beige">
            {/* Header */}
            <View className="px-6 pt-4 pb-4 flex-row items-center justify-between border-b border-[#E8E3D6]">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center"
                >
                    <Ionicons name="arrow-back" size={24} color="#1A1C1E" />
                </TouchableOpacity>
                <Text className="font-jakarta-bold text-lg text-[#1A1C1E]">
                    Transcripts
                </Text>
                <TouchableOpacity className="w-10 h-10 items-center justify-center">
                    <Ionicons name="heart-outline" size={24} color="#1A1C1E" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
                className="flex-1 px-6 pt-4"
                showsVerticalScrollIndicator={false}
            >
                {/* Episode Title */}
                <Text className="font-jakarta-bold text-lg text-[#1A1C1E] mb-4">
                    {episode.title}
                </Text>

                {/* Transcript Content */}
                {episode.scriptContent ? (
                    <Text className="font-inter text-[#666666] leading-7 text-base">
                        {episode.scriptContent}
                    </Text>
                ) : (
                    <View className="items-center justify-center py-12">
                        <Ionicons
                            name="document-text-outline"
                            size={48}
                            color="#858585"
                        />
                        <Text className="font-inter text-[#858585] text-center mt-4">
                            No transcript available for this episode.
                        </Text>
                    </View>
                )}

                {/* Bottom padding for mini player */}
                <View className="h-24" />
            </ScrollView>
        </SafeAreaView>
    );
}
