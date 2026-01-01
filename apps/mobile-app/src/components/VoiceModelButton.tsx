import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface VoiceModelButtonProps {
    label: string;
    isSelected: boolean;
    onPress: () => void;
}

export const VoiceModelButton: React.FC<VoiceModelButtonProps> = ({
    label,
    isSelected,
    onPress,
}) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="w-[30%] rounded-2xl p-4 py-6 items-center mb-3 aspect-[0.9] justify-center bg-[#F5F5F0]"
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
                className={`w-14 h-14 rounded-full mb-2 ${
                    isSelected ? 'bg-brand-gold' : 'bg-[#E7E0CB]'
                }`}
            />
            <Text
                className={`font-inter ${
                    isSelected ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E]'
                }`}>
                {label}
            </Text>
        </TouchableOpacity>
    );
};
