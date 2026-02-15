import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { podcasterService, Podcaster } from '@/services/podcaster.service';
import { storageService } from '@/services/storage.service';
import { ProfilePictureInput } from '@/components/ProfilePictureInput';
import { CustomSlider } from '@/components/CustomSlider';
import { CustomDropdown } from '@/components/CustomDropdown';
import { useAlert } from '@/contexts/AlertContext';
import { PodcastManageSkeleton } from '@/components/skeleton';

export default function ManagePodcaster() {
  const { podcast: podcastId } = useLocalSearchParams();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [podcaster, setPodcaster] = useState<Podcaster | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);

  // Personality state
  const [tone, setTone] = useState(5);
  const [communicationStyle, setCommunicationStyle] = useState(5);
  const [humorLevel, setHumorLevel] = useState(5);
  const [conversationalDepth, setConversationalDepth] = useState(5);
  const [chaosFactor, setChaosFactor] = useState(5);

  // Knowledge & Worldview state
  const [selectedExpertiseTags, setSelectedExpertiseTags] = useState<string[]>([]);
  const [intellectualAngle, setIntellectualAngle] = useState('Skeptical');
  const [viewpointBehavior, setViewpointBehavior] = useState(5);

  const expertiseTags = [
    'Philosophy', 'Psychology', 'Finance', 'History', 'Literature',
    'Politics', 'Self-help', 'Science', 'Business', 'Art & Culture',
  ];

  const intellectualAngleOptions = [
    { label: 'Skeptical', value: 'Skeptical' },
    { label: 'Accepting', value: 'Accepting' },
    { label: 'Critical', value: 'Critical' },
    { label: 'Pragmatic', value: 'Pragmatic' },
    { label: 'Idealistic', value: 'Idealistic' },
    { label: 'Empirical', value: 'Empirical' },
  ];

  const toggleExpertiseTag = (tag: string) => {
    if (selectedExpertiseTags.includes(tag)) {
      setSelectedExpertiseTags(selectedExpertiseTags.filter(t => t !== tag));
    } else {
      if (selectedExpertiseTags.length < 3) {
        setSelectedExpertiseTags([...selectedExpertiseTags, tag]);
      }
    }
  };

  useEffect(() => {
    fetchPodcaster();
  }, [podcastId]);

  const fetchPodcaster = async () => {
    try {
      setLoading(true);
      const token = await storageService.getAccessToken();
      if (!token) {
        router.replace('/(auth)/Auth');
        return;
      }

      const data = await podcasterService.getPodcaster(podcastId as string, token);
      setPodcaster(data);
      setName(data.name);
      setDescription(data.description || '');
      setProfilePicture(data.profilePictureUrl || null);
      setIsPublic(data.isPublic);
      // Personality
      setTone(data.tone);
      setCommunicationStyle(data.communicationStyle);
      setHumorLevel(data.humorLevel);
      setConversationalDepth(data.conversationalDepth);
      setChaosFactor(data.chaosFactor);
      // Knowledge & Worldview
      setSelectedExpertiseTags(data.expertiseTags || []);
      setIntellectualAngle(data.intellectualAngle || 'Skeptical');
      setViewpointBehavior(data.viewpointBehavior);
    } catch (err: any) {
      console.error('Error fetching podcaster:', err);
      showAlert({ title: 'Error', message: err.message || 'Failed to load podcaster' });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // Upload immediately on pick (same pattern as user profile picture)
  const handleImageSelected = async (imageUri: string) => {
    try {
      const token = await storageService.getAccessToken();
      if (!token) return;

      const updated = await podcasterService.uploadProfilePicture(podcastId as string, imageUri, token);
      // Append cache-buster so RN Image doesn't serve stale cached version
      const url = updated.profilePictureUrl
        ? `${updated.profilePictureUrl}?t=${Date.now()}`
        : null;
      setProfilePicture(url);
      setPodcaster(updated);
    } catch (err: any) {
      console.error('Error uploading profile picture:', err);
      showAlert({ title: 'Error', message: err.message || 'Failed to upload profile picture' });
    }
  };

  // Remove immediately (same pattern as user profile picture)
  const handleImageRemoved = async () => {
    try {
      const token = await storageService.getAccessToken();
      if (!token) return;

      const updated = await podcasterService.removeProfilePicture(podcastId as string, token);
      setProfilePicture(updated.profilePictureUrl || null);
      setPodcaster(updated);
    } catch (err: any) {
      console.error('Error removing profile picture:', err);
      showAlert({ title: 'Error', message: err.message || 'Failed to remove profile picture' });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert({ title: 'Validation Error', message: 'Please enter a podcaster name' });
      return;
    }

    try {
      setSaving(true);
      const token = await storageService.getAccessToken();
      if (!token) {
        router.replace('/(auth)/Auth');
        return;
      }

      await podcasterService.update(
        podcastId as string,
        {
          name: name.trim(),
          description: description.trim() || undefined,
          isPublic,
          tone,
          communicationStyle,
          humorLevel,
          conversationalDepth,
          chaosFactor,
          expertiseTags: selectedExpertiseTags,
          intellectualAngle,
          viewpointBehavior,
        },
        token
      );

      showAlert({ title: 'Success', message: 'Podcaster updated successfully' });
      router.back();
    } catch (err: any) {
      console.error('Error updating podcaster:', err);
      showAlert({ title: 'Error', message: err.message || 'Failed to update podcaster' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showAlert({
      title: 'Delete Podcaster',
      message: 'Are you sure you want to delete this podcaster? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const token = await storageService.getAccessToken();
              if (!token) {
                router.replace('/(auth)/Auth');
                return;
              }

              await podcasterService.delete(podcastId as string, token);
              showAlert({ title: 'Success', message: 'Podcaster deleted successfully' });
              router.replace('/(tabs)/studio');
            } catch (err: any) {
              console.error('Error deleting podcaster:', err);
              showAlert({ title: 'Error', message: err.message || 'Failed to delete podcaster' });
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-brand-beige">
        <PodcastManageSkeleton />
      </SafeAreaView>
    );
  }

  if (!podcaster) {
    return (
      <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
        <Text className="font-inter text-gray-500">Podcaster not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-beige">
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2"
          >
            <Image source={require('../../../assets/icons/back.png')} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
          </TouchableOpacity>
          <Text className="font-jakarta-bold text-xl text-gray-900">Manage Podcaster</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Picture */}
        <ProfilePictureInput
          imageUri={profilePicture}
          onImageSelected={handleImageSelected}
          onImageRemoved={handleImageRemoved}
        />

        {/* Name */}
        <View className="mb-6">
          <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-2">Podcaster Name</Text>
          <View className="flex-row items-center bg-brand-input rounded-xl px-4 py-2">
            <TextInput
              className="flex-1 font-inter text-[#1A1C1E]"
              value={name}
              onChangeText={setName}
              placeholder="Enter podcaster name"
              placeholderTextColor="#858585"
            />
          </View>
        </View>

        {/* Description */}
        <View className="mb-6">
          <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-2">Description (Optional)</Text>
          <View className="bg-brand-input rounded-xl px-4 py-3">
            <TextInput
              className="font-inter text-[#1A1C1E]"
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              placeholderTextColor="#858585"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Public Toggle */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center bg-brand-input rounded-xl px-4 py-4">
            <View className="flex-1">
              <Text className="font-inter-medium text-[#1A1C1E]">Public Podcaster</Text>
              <Text className="font-inter text-xs text-gray-500 mt-1">
                Allow others to discover and use this podcaster
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsPublic(!isPublic)}
              className={`w-14 h-8 rounded-full justify-center px-1 ${
                isPublic ? 'bg-brand-gold' : 'bg-gray-300'
              }`}
            >
              <View
                className={`w-6 h-6 rounded-full bg-white ${
                  isPublic ? 'self-end' : 'self-start'
                }`}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Voice Configuration Section */}
        <View
          className="mb-6 bg-[#F5F5F0] rounded-2xl p-4"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 14,
          }}
        >
          <Text className="font-inter-bold text-lg text-gray-900 mb-2">Voice Configuration</Text>
          <Text className="font-inter text-sm text-gray-600 mb-3">
            Voice Model: {podcaster.voiceModel}
          </Text>
          <Text className="font-inter text-sm text-gray-600 mb-3">
            Gender: {podcaster.gender}
          </Text>
          <Text className="font-inter text-sm text-gray-600 mb-3">
            Accent: {podcaster.accent}
          </Text>
          <Text className="font-inter text-xs text-gray-500 italic">
            Voice settings can only be changed during podcaster creation
          </Text>
        </View>

        {/* Core Personality Model */}
        <View className="mb-6">
          <Text className="font-inter-bold text-lg text-gray-900 mb-1">Core Personality Model</Text>
          <Text className="font-inter text-sm text-gray-500 mb-4">
            Defines persona consistency across all episodes
          </Text>

          <CustomSlider
            label="Tone"
            value={tone}
            onValueChange={setTone}
            leftLabel="Calm"
            rightLabel="Energetic"
          />

          <CustomSlider
            label="Communication Style"
            value={communicationStyle}
            onValueChange={setCommunicationStyle}
            leftLabel="Storytelling"
            rightLabel="Analytical"
          />

          <CustomSlider
            label="Humor Level"
            value={humorLevel}
            onValueChange={setHumorLevel}
            leftLabel="Dry"
            rightLabel="Comedic"
          />

          <CustomSlider
            label="Conversational Depth"
            value={conversationalDepth}
            onValueChange={setConversationalDepth}
            leftLabel="Surface-Level"
            rightLabel="Deep Thinking"
          />

          <CustomSlider
            label="Chaos Factor"
            value={chaosFactor}
            onValueChange={setChaosFactor}
            leftLabel="Steady"
            rightLabel="Volatile"
          />
        </View>

        {/* Knowledge & Worldview */}
        <View className="mb-6">
          <Text className="font-inter-bold text-lg text-gray-900 mb-1">Knowledge & Worldview</Text>
          <Text className="font-inter text-sm text-gray-500 mb-4">
            Governs interpretation style across all books covered
          </Text>

          {/* Expertise Tags */}
          <View className="mb-6">
            <Text className="text-[#1A1C1E] font-inter-medium text-base mb-1">Expertise Tags</Text>
            <Text className="font-inter text-sm text-gray-500 mb-3">Choose 1-3</Text>
            <View className="flex-row flex-wrap gap-2">
              {expertiseTags.map(tag => {
                const isSelected = selectedExpertiseTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleExpertiseTag(tag)}
                    className={`px-4 py-2 rounded-full ${isSelected ? 'bg-brand-red' : 'bg-[#E8E3D6]'}`}
                  >
                    <Text className={`font-inter text-sm ${isSelected ? 'text-white' : 'text-[#1A1C1E]'}`}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Intellectual Angle */}
          <View className="mb-4">
            <Text className="text-[#1A1C1E] font-inter-medium text-base mb-1">Intellectual Angle</Text>
            <Text className="font-inter text-sm text-gray-500 mb-2">
              The angle in which the podcaster approaches a book's ideas
            </Text>
            <CustomDropdown
              label=""
              options={intellectualAngleOptions}
              selectedValue={intellectualAngle}
              onSelect={setIntellectualAngle}
            />
          </View>

          {/* Viewpoint Behavior */}
          <View className="mb-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-[#1A1C1E] font-inter-medium text-base">Viewpoint Behavior</Text>
              <View className="bg-brand-gold rounded-full px-4 py-1.5">
                <Text className="text-white font-inter-medium text-base">{viewpointBehavior}</Text>
              </View>
            </View>
            <Text className="font-inter text-sm text-gray-500 mb-2">
              Defines debate and critique tendencies
            </Text>
            <CustomSlider
              label=""
              value={viewpointBehavior}
              onValueChange={setViewpointBehavior}
              leftLabel="Agreeable"
              rightLabel="Challenging"
              showValue={false}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || deleting}
          className={`bg-brand-gold rounded-full py-4 mb-4 ${
            saving || deleting ? 'opacity-50' : ''
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-jakarta-bold text-center">Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDelete}
          disabled={saving || deleting}
          className={`border-2 border-red-500 rounded-full py-4 mb-6 ${
            saving || deleting ? 'opacity-50' : ''
          }`}
        >
          {deleting ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <Text className="text-red-500 font-jakarta-bold text-center">Delete Podcaster</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
