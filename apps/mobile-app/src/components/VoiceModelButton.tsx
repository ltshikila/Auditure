import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceModelButtonProps {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    isSelected: boolean;
    onPress: () => void;
}

export const VoiceModelButton: React.FC<VoiceModelButtonProps> = ({
    label,
    icon,
    isSelected,
    onPress,
}) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="w-[30%] rounded-2xl p-4 py-6 items-center mb-3 aspect-[0.9] justify-center bg-[#F5F5F0] dark:bg-brand-dark-surface"
            style={
                isSelected
                    ? {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          elevation: 14,
                      }
                    : {
                          shadowColor: 'transparent',
                          elevation: 0,
                      }
            }>
            <View
                className={`w-14 h-14 rounded-full mb-2 items-center justify-center ${
                    isSelected ? 'bg-brand-gold' : 'bg-[#E7E0CB]'
                }`}
            >
                <Ionicons
                    name={icon}
                    size={28}
                    color={isSelected ? '#FFFFFF' : '#8C8577'}
                />
            </View>
            <Text
                className={`font-inter text-center ${
                    isSelected ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E] dark:text-brand-dark-text'
                }`}>
                {label}
            </Text>
        </TouchableOpacity>
    );
};
