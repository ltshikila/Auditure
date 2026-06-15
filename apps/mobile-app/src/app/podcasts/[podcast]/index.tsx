import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { podcasterService, Podcaster } from '@/services/podcaster.service';
import { episodeService, Episode } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import { resolveCoverUrl } from '@/services/api';
import { usePlayback } from '@/contexts/PlaybackContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { GeneratingEpisodeCard } from '@/components/GeneratingEpisodeCard';
import { TopBar } from '@/components/TopBar';
import { PodcastDetailSkeleton } from '@/components/skeleton';
import { formatCount } from '@/utils/formatCount';

const statIcons = {
  microphone: require('@/assets/icons/microphone.png'),
  episodes: require('@/assets/icons/episodes.png'),
  star: require('@/assets/icons/star.png'),
};
const podcastIcon = require('@/assets/icons/podcast.png');

export default function PodcastDetailsScreen() {
  const { podcast: podcastId } = useLocalSearchParams();
  const [podcaster, setPodcaster] = useState<Podcaster | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [generatingEpisodes, setGeneratingEpisodes] = useState<Episode[]>([]);
  const [completedEpisodes, setCompletedEpisodes] = useState<Episode[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number>(0);

  const { setQueue } = usePlayback();
  const { user } = useAuth();
  const { resolved } = useTheme();
  const isOwner = podcaster?.userId === user?.id;

  useEffect(() => {
    // Validate podcastId is a real UUID — ignore junk from deep links like "notification.click"
    if (podcastId && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(podcastId as string)) {
      router.back();
      return;
    }
    fetchPodcaster();
    fetchUserRating();
  }, [podcastId]);

  // Fetch episodes once we know the podcaster (need userId for ownership check)
  useEffect(() => {
    if (podcaster) {
      fetchEpisodes();
    }
  }, [podcaster?.id, podcaster?.userId]);

  const fetchUserRating = async () => {
    if (!podcastId) return;
    try {
      const token = await storageService.getAccessToken();
      if (!token) return;
      const rating = await podcasterService.getUserRating(podcastId as string, token);
      setUserRating(rating);
    } catch (err) {
      console.error('Error fetching user rating:', err);
    }
  };

  const openRatingModal = () => {
    setSelectedRating(userRating || 0);
    setShowRatingModal(true);
  };

  const handleSubmitRating = async () => {
    if (!podcastId || isRating || selectedRating === 0) return;
    try {
      setIsRating(true);
      const token = await storageService.getAccessToken();
      if (!token) return;
      const result = await podcasterService.rate(podcastId as string, selectedRating, token);
      setUserRating(selectedRating);
      // Update podcaster with new rating
      if (podcaster) {
        setPodcaster({
          ...podcaster,
          averageRating: result.averageRating,
          ratingCount: result.ratingCount,
        });
      }
      setShowRatingModal(false);
    } catch (err) {
      console.error('Error rating podcaster:', err);
    } finally {
      setIsRating(false);
    }
  };

  // Poll for updates on generating episodes
  useEffect(() => {
    if (generatingEpisodes.length > 0) {
      const interval = setInterval(() => {
        fetchEpisodes();
      }, 10000); // Poll every 10 seconds
      return () => clearInterval(interval);
    }
  }, [generatingEpisodes.length]);

  const fetchPodcaster = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await storageService.getAccessToken();
      // Token is optional - public podcasters are viewable by anyone
      const data = await podcasterService.getPodcaster(podcastId as string, token || undefined);
      setPodcaster(data);
    } catch (err: any) {
      console.error('Error fetching podcaster:', err);
      setError(err.message || 'Failed to load podcaster');
    } finally {
      setLoading(false);
    }
  };

  const fetchEpisodes = async () => {
    if (!podcastId || !podcaster) return;
    try {
      const token = await storageService.getAccessToken();

      let podcasterEpisodes: Episode[];

      if (token && podcaster.userId === user?.id) {
        // Owner: fetch own episodes (includes generating/failed)
        const allEpisodes = await episodeService.getMyEpisodes(token);
        podcasterEpisodes = allEpisodes.filter(
          (ep) => ep.podcasterId === podcastId
        );
      } else {
        // Visitor (or no token): fetch public completed episodes via podcaster endpoint
        podcasterEpisodes = await episodeService.getByPodcaster(podcastId as string);
      }
      setEpisodes(podcasterEpisodes);

      // Categorize episodes
      const generating = podcasterEpisodes.filter((ep) =>
        ['PENDING', 'SCRIPT_GENERATING', 'SCRIPT_GENERATED', 'AUDIO_GENERATING', 'FAILED'].includes(
          ep.generationStatus
        )
      );
      const completed = podcasterEpisodes.filter(
        (ep) => ep.generationStatus === 'COMPLETED'
      );
      setGeneratingEpisodes(generating);
      setCompletedEpisodes(completed);
    } catch (err) {
      console.error('Error fetching episodes:', err);
    }
  };

  const handleRetryEpisode = async (episode: Episode) => {
    try {
      const token = await storageService.getAccessToken();
      if (!token) return;
      await episodeService.retry(episode.id, token);
      fetchEpisodes();
    } catch (err) {
      console.error('Error retrying episode:', err);
    }
  };

  const handleCancelEpisode = async (episode: Episode) => {
    try {
      const token = await storageService.getAccessToken();
      if (!token) return;
      await episodeService.delete(episode.id, token);
      fetchEpisodes();
    } catch (err) {
      console.error('Error canceling episode:', err);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
        <TopBar showBackButton />
        <PodcastDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !podcaster) {
    return (
      <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
        <TopBar showBackButton />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-inter-bold text-xl text-gray-900 dark:text-brand-dark-text mb-2">
            {error || 'Podcaster not found'}
          </Text>
          <TouchableOpacity onPress={fetchPodcaster} className="mt-4">
            <Text className="font-inter-medium text-brand-gold">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
      <TopBar showBackButton />
      <ScrollView>
        {/* Header Section */}
        <View className="px-6 pt-2">
          <Text className="font-jakarta-bold text-2xl text-gray-900 dark:text-brand-dark-text mb-1">{podcaster.name}</Text>
          <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted mb-8">
            {podcaster.description || 'No description provided'}
          </Text>

          {/* Profile Section */}
          <View className="items-center mb-8">
            {/* Profile Picture */}
            {resolveCoverUrl(podcaster.profilePictureUrl) ? (
              <Image
                source={{ uri: resolveCoverUrl(podcaster.profilePictureUrl)! }}
                className="w-32 h-32 rounded-full mb-4"
              />
            ) : (
              <View className="w-32 h-32 bg-[#E8E3D6] dark:bg-brand-dark-input rounded-full mb-4 items-center justify-center">
                <Image source={podcastIcon} style={{ width: 56, height: 56, tintColor: '#BF9A54' }} />
              </View>
            )}

            {/* Voice Model Badge */}
            <View className="bg-brand-gold/20 px-4 py-2 rounded-full mb-6">
              <Text className="font-inter-medium text-brand-gold text-sm">
                {podcaster.voiceModel.charAt(0) + podcaster.voiceModel.slice(1).toLowerCase()} • {podcaster.gender.charAt(0) + podcaster.gender.slice(1).toLowerCase()}
              </Text>
            </View>

            {/* Stats Row */}
            <View className="flex-row w-full justify-around px-4 mb-8">
              <View className="items-center">
                <View className="flex-row items-center gap-1">
                  <Image source={statIcons.microphone} style={{ width: 18, height: 18, tintColor: '#E8847C' }} resizeMode="contain" />
                  <Text className="font-jakarta-bold text-lg text-gray-900 dark:text-brand-dark-text">{formatCount(completedEpisodes.length)}</Text>
                </View>
                <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Episodes</Text>
              </View>
              <View className="items-center">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="heart" size={18} color="#E8847C" />
                  <Text className="font-jakarta-bold text-lg text-gray-900 dark:text-brand-dark-text">{formatCount(episodes.reduce((sum, ep) => sum + (ep.likeCount || 0), 0))}</Text>
                </View>
                <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Likes</Text>
              </View>
              <View className="items-center">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="play-circle" size={18} color="#E8847C" />
                  <Text className="font-jakarta-bold text-lg text-gray-900 dark:text-brand-dark-text">{formatCount(episodes.reduce((sum, ep) => sum + (ep.playCount || 0), 0))}</Text>
                </View>
                <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">Plays</Text>
              </View>
              <TouchableOpacity onPress={openRatingModal} className="items-center">
                <View className="flex-row items-center gap-1">
                  <Image source={statIcons.star} style={{ width: 18, height: 18, tintColor: '#E8847C' }} resizeMode="contain" />
                  <Text className="font-jakarta-bold text-lg text-gray-900 dark:text-brand-dark-text">
                    {podcaster.averageRating > 0 ? podcaster.averageRating.toFixed(1) : '-'}
                  </Text>
                </View>
                <Text className="font-inter text-xs text-gray-500 dark:text-brand-dark-text-muted">
                  {podcaster.ratingCount > 0 ? `${podcaster.ratingCount} ratings` : 'Rating'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Manage Button - only for owner */}
            {isOwner && (
              <TouchableOpacity
                onPress={() => router.push(`/podcasts/${podcastId}/manage`)}
                className="bg-black px-8 py-3 rounded-full"
              >
                <Text className="text-white font-jakarta-bold text-sm">Manage Podcaster</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Episodes Section */}
        <View className="mb-24 px-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="font-jakarta-bold text-xl text-gray-900 dark:text-brand-dark-text">Episodes</Text>
            {isOwner && (
              <TouchableOpacity
                onPress={() => router.push('/episodes/create')}
                className="w-6 h-6 rounded-full border border-brand-gold items-center justify-center"
              >
                <Ionicons name="add" size={16} color="#BF9A54" />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort Controls */}
          {completedEpisodes.length > 1 && (
            <View className="flex-row mb-4">
              <TouchableOpacity
                onPress={() => setSortBy('recent')}
                className={`px-4 py-2 rounded-full mr-2 ${sortBy === 'recent' ? 'bg-brand-gold dark:bg-brand-gold' : 'bg-[#F5F0E8] dark:bg-brand-dark-surface border border-[#E0D9CC] dark:border-brand-dark-border'}`}
              >
                <Text className={`font-inter-medium text-xs ${sortBy === 'recent' ? 'text-white' : 'text-gray-600 dark:text-brand-dark-text-secondary'}`}>
                  Most recent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSortBy('popular')}
                className={`px-4 py-2 rounded-full ${sortBy === 'popular' ? 'bg-brand-gold dark:bg-brand-gold' : 'bg-[#F5F0E8] dark:bg-brand-dark-surface border border-[#E0D9CC] dark:border-brand-dark-border'}`}
              >
                <Text className={`font-inter-medium text-xs ${sortBy === 'popular' ? 'text-white' : 'text-gray-600 dark:text-brand-dark-text-secondary'}`}>
                  Most popular
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Generating Episodes */}
          {generatingEpisodes.map((episode) => (
            <GeneratingEpisodeCard
              key={episode.id}
              episode={episode}
              onPress={() => router.push(`/episodes/${episode.id}`)}
              onRetry={() => handleRetryEpisode(episode)}
              onCancel={() => handleCancelEpisode(episode)}
            />
          ))}

          {/* Completed Episodes - List */}
          {completedEpisodes.length > 0 ? (
            [...completedEpisodes]
              .sort((a, b) => {
                if (sortBy === 'popular') return b.playCount - a.playCount;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              })
              .map((episode, index) => (
                <TouchableOpacity
                  key={episode.id}
                  onPress={() => {
                    const sorted = [...completedEpisodes].sort((a, b) => {
                      if (sortBy === 'popular') return b.playCount - a.playCount;
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    });
                    setQueue(sorted);
                    router.push(`/episodes/${episode.id}`);
                  }}
                  className="flex-row items-center py-4"
                  activeOpacity={0.6}
                  style={index > 0 ? { borderTopWidth: 1, borderTopColor: resolved === 'dark' ? '#2E3235' : '#E5E7EB' } : undefined}
                >
                  {/* Index Number */}
                  <Text className="font-inter text-sm text-[#B0A898] w-6">{index + 1}</Text>

                  {/* Book Cover */}
                  <View className="w-[50px] h-[72px] rounded-lg overflow-hidden bg-brand-input dark:bg-brand-dark-input mr-3 items-center justify-center"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}
                  >
                    {resolveCoverUrl(episode.book?.coverImageUrl) ? (
                      <Image
                        source={{ uri: resolveCoverUrl(episode.book?.coverImageUrl)! }}
                        style={{ width: 50, height: 72 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View className="w-full h-full bg-[#E8E3D6] dark:bg-brand-dark-input items-center justify-center">
                        <Ionicons name="book-outline" size={22} color="#BF9A54" />
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View className="flex-1 mr-3">
                    <Text className="font-inter-medium text-[15px] text-[#1A1C1E] dark:text-brand-dark-text" numberOfLines={1}>
                      {episode.title}
                    </Text>
                    <Text className="font-inter text-xs text-[#858585] dark:text-brand-dark-text-secondary mt-1" numberOfLines={1}>
                      {episode.book?.title || 'Unknown Book'}
                    </Text>
                    <View className="flex-row items-center mt-1.5">
                      <View className="flex-row items-center bg-[#EDE8DE] dark:bg-brand-dark-input rounded-full px-2 py-0.5 mr-2">
                        <Ionicons name="play" size={9} color="#BF9A54" />
                        <Text className="font-inter-medium text-[10px] text-[#9A8C6E] ml-1">{formatCount(episode.playCount)}</Text>
                      </View>
                      {episode.duration ? (
                        <View className="flex-row items-center bg-[#EDE8DE] dark:bg-brand-dark-input rounded-full px-2 py-0.5">
                          <Ionicons name="time-outline" size={9} color="#BF9A54" />
                          <Text className="font-inter-medium text-[10px] text-[#9A8C6E] ml-1">
                            {Math.round(episode.duration / 60)} min
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Play Button */}
                  <View className="w-9 h-9 rounded-full bg-[#EDE8DE] dark:bg-brand-dark-input items-center justify-center">
                    <Ionicons name="play" size={16} color="#BF9A54" />
                  </View>
                </TouchableOpacity>
              ))
          ) : generatingEpisodes.length === 0 ? (
            <View className="py-8 items-center">
              <View className="w-16 h-16 bg-brand-gold/20 rounded-full items-center justify-center mb-3">
                <Ionicons name="headset" size={32} color="#BF9A54" />
              </View>
              <Text className="font-inter-bold text-gray-900 dark:text-brand-dark-text mb-2">No episodes yet</Text>
              <Text className="font-inter text-gray-500 dark:text-brand-dark-text-muted text-center text-sm">
                Create your first episode with this podcaster
              </Text>
            </View>
          ) : null}
        </View>

      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-8">
          <View className="bg-[#F5F0E8] dark:bg-brand-dark-surface rounded-3xl w-full max-w-sm p-6">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
              <Text className="font-jakarta-bold text-xl text-gray-900 dark:text-brand-dark-text">Rate podcaster</Text>
              <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                <Ionicons name="close" size={24} color="#1A1C1E" />
              </TouchableOpacity>
            </View>

            {/* Podcaster Avatar */}
            <View className="items-center mb-6">
              {resolveCoverUrl(podcaster.profilePictureUrl) ? (
                <Image
                  source={{ uri: resolveCoverUrl(podcaster.profilePictureUrl)! }}
                  className="w-28 h-28 rounded-2xl"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-28 h-28 bg-[#E8E3D6] dark:bg-brand-dark-input rounded-2xl items-center justify-center">
                  <Image source={podcastIcon} style={{ width: 48, height: 48, tintColor: '#BF9A54' }} />
                </View>
              )}
            </View>

            {/* Star Rating */}
            <View className="flex-row justify-center gap-3 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  className="p-1"
                >
                  <Ionicons
                    name={selectedRating >= star ? 'star' : 'star-outline'}
                    size={36}
                    color={selectedRating >= star ? '#FFD700' : '#9CA3AF'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmitRating}
              disabled={isRating || selectedRating === 0}
              className={`py-3 px-6 rounded-full items-center ${
                selectedRating > 0 ? 'bg-brand-gold' : 'bg-gray-300'
              }`}
            >
              {isRating ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className={`font-jakarta-bold text-base ${
                  selectedRating > 0 ? 'text-white' : 'text-gray-500 dark:text-brand-dark-text-muted'
                }`}>
                  Submit
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}