import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Podcaster } from '@/services/podcaster.service';
import { resolveCoverUrl } from '@/services/api';

const podcastIcon = require('@/assets/icons/podcast.png');

interface PodcasterSelectorProps {
    podcasters: Podcaster[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAddNew: () => void;
}

export const PodcasterSelector: React.FC<PodcasterSelectorProps> = ({
    podcasters,
    selectedId,
    onSelect,
    onAddNew,
}) => {
    return (
        <View className="mb-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-2">
                <View>
                    <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg">
                        Virtual Podcaster
                    </Text>
                    <Text className="text-[#858585] dark:text-brand-dark-text-secondary font-inter text-sm">
                        Select your virtual podcaster for this episode
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={onAddNew}
                    className="w-6 h-6 rounded-full border border-brand-gold items-center justify-center"
                >
                    <Ionicons name="add" size={16} color="#BF9A54" />
                </TouchableOpacity>
            </View>

            {/* Podcaster List */}
            <View className="flex-row flex-wrap gap-4">
                {podcasters.map((podcaster) => {
                    const isSelected = selectedId === podcaster.id;
                    return (
                        <TouchableOpacity
                            key={podcaster.id}
                            onPress={() => onSelect(podcaster.id)}
                            className={`w-[30%] rounded-2xl p-4 py-5 items-center mb-3 justify-start ${
                                isSelected ? 'bg-[#F5F5F0] dark:bg-brand-dark-surface border-2 border-brand-gold/40' : 'bg-[#F5F5F0] dark:bg-brand-dark-surface'
                            }`}
                            style={
                                isSelected
                                    ? { transform: [{ scale: 1.03 }] }
                                    : { transform: [{ scale: 1 }] }
                            }
                        >
                            {/* Avatar */}
                            <View
                                className={`w-14 h-14 rounded-full overflow-hidden mb-2 ${
                                    isSelected ? 'border-2 border-brand-gold' : 'border border-black/10 dark:border-white/10'
                                }`}
                            >
                                {resolveCoverUrl(podcaster.profilePictureUrl) ? (
                                    <Image
                                        source={{ uri: resolveCoverUrl(podcaster.profilePictureUrl)! }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View className="w-full h-full bg-[#E8E3D6] items-center justify-center">
                                        <Image source={podcastIcon} style={{ width: 24, height: 24, tintColor: '#BF9A54' }} />
                                    </View>
                                )}
                            </View>

                            {/* Name */}
                            <Text
                                className={`font-inter text-center ${
                                    isSelected ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E] dark:text-brand-dark-text'
                                }`}
                                numberOfLines={2}
                            >
                                {podcaster.name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                {/* Empty state */}
                {podcasters.length === 0 && (
                    <TouchableOpacity
                        onPress={onAddNew}
                        className="w-[30%] rounded-2xl p-4 py-5 items-center mb-3 justify-start"
                    >
                        <View className="w-14 h-14 rounded-full bg-[#E8E3D6] items-center justify-center mb-2 border border-dashed border-brand-gold">
                            <Ionicons name="add" size={24} color="#BF9A54" />
                        </View>
                        <Text className="font-inter text-xs text-center text-[#858585] dark:text-brand-dark-text-secondary">
                            Create Podcaster
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};
