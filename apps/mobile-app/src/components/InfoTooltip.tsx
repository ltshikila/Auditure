import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InfoTooltipProps {
    text: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => {
    return (
        <View className="bg-[#BF9A54]/20 rounded-xl px-4 py-3 flex-row items-start mb-4">
            <View className="bg-brand-gold/30 rounded-full w-6 h-6 items-center justify-center mr-3 mt-0.5">
                <Ionicons name="help" size={14} color="#BF9A54" />
            </View>
            <Text className="text-[#8B7355] font-inter text-sm flex-1 leading-5">
                {text}
            </Text>
        </View>
    );
};
