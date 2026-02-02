import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Podcaster } from '@/services/podcaster.service';

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
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg">
                        Virtual Podcaster
                    </Text>
                    <Text className="text-[#858585] font-inter text-sm">
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
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 8 }}
            >
                {podcasters.map((podcaster) => {
                    const isSelected = selectedId === podcaster.id;
                    return (
                        <TouchableOpacity
                            key={podcaster.id}
                            onPress={() => onSelect(podcaster.id)}
                            className={`items-center mr-4 rounded-xl p-2 ${
                                isSelected ? 'bg-[#F5F5F0]' : ''
                            }`}
                            style={[
                                { width: 94 },
                                isSelected && {
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                    elevation: 4,
                                },
                            ]}
                        >
                            {/* Avatar */}
                            <View
                                className={`w-16 h-16 rounded-full overflow-hidden mb-2 ${
                                    isSelected ? 'border-2 border-brand-gold' : 'border border-[#E8E3D6]'
                                }`}
                            >
                                {podcaster.profilePictureUrl ? (
                                    <Image
                                        source={{ uri: podcaster.profilePictureUrl }}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View className="w-full h-full bg-brand-input items-center justify-center">
                                        <Ionicons name="person" size={24} color="#BF9A54" />
                                    </View>
                                )}
                            </View>

                            {/* Name */}
                            <Text
                                className={`font-inter text-xs text-center ${
                                    isSelected ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E]'
                                }`}
                                numberOfLines={2}
                            >
                                {podcaster.name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                {/* Empty state or placeholder */}
                {podcasters.length === 0 && (
                    <TouchableOpacity
                        onPress={onAddNew}
                        className="items-center"
                        style={{ width: 90 }}
                    >
                        <View className="w-16 h-16 rounded-full bg-[#E8E3D6] items-center justify-center mb-2 border border-dashed border-brand-gold">
                            <Ionicons name="add" size={24} color="#BF9A54" />
                        </View>
                        <Text className="font-inter text-xs text-center text-[#858585]">
                            Create Podcaster
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
};
