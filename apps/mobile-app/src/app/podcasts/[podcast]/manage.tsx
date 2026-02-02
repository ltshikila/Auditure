import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { podcasterService, Podcaster } from '@/services/podcaster.service';
import { storageService } from '@/services/storage.service';
import { ProfilePictureInput } from '@/components/ProfilePictureInput';

export default function ManagePodcaster() {
  const { podcast: podcastId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [podcaster, setPodcaster] = useState<Podcaster | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);

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
    } catch (err: any) {
      console.error('Error fetching podcaster:', err);
      Alert.alert('Error', err.message || 'Failed to load podcaster');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a podcaster name');
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
          profilePictureUrl: profilePicture || undefined,
          isPublic,
        },
        token
      );

      Alert.alert('Success', 'Podcaster updated successfully');
      router.back();
    } catch (err: any) {
      console.error('Error updating podcaster:', err);
      Alert.alert('Error', err.message || 'Failed to update podcaster');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Podcaster',
      'Are you sure you want to delete this podcaster? This action cannot be undone.',
      [
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
              Alert.alert('Success', 'Podcaster deleted successfully');
              router.replace('/(tabs)/studio');
            } catch (err: any) {
              console.error('Error deleting podcaster:', err);
              Alert.alert('Error', err.message || 'Failed to delete podcaster');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
        <ActivityIndicator size="large" color="#BF9A54" />
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
            <Ionicons name="chevron-back" size={24} color="#1A1C1E" />
          </TouchableOpacity>
          <Text className="font-jakarta-bold text-xl text-gray-900">Manage Podcaster</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Picture */}
        <ProfilePictureInput imageUri={profilePicture} onImageSelected={setProfilePicture} />

        {/* Name */}
        <View className="mb-6">
          <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-2">Podcaster Name</Text>
          <View className="flex-row items-center bg-brand-input rounded-xl px-4 py-3">
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
          className={`border-2 border-red-500 rounded-full py-4 ${
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