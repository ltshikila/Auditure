import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemePreference } from '@/contexts/ThemeContext';

interface Option {
    value: ThemePreference;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: Option[] = [
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export const ThemeToggle: React.FC = () => {
    const { preference, setPreference } = useTheme();

    return (
        <View className="py-4">
            <View className="flex-row items-center mb-3">
                <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name="contrast-outline" size={16} color="#BF9A54" />
                </View>
                <Text className="font-inter text-brand-black dark:text-brand-dark-text">
                    Theme
                </Text>
            </View>
            <View className="flex-row bg-brand-input dark:bg-brand-dark-input rounded-full p-1">
                {OPTIONS.map(opt => {
                    const active = preference === opt.value;
                    return (
                        <TouchableOpacity
                            key={opt.value}
                            onPress={() => setPreference(opt.value)}
                            className={`flex-1 flex-row items-center justify-center py-2 rounded-full ${active ? 'bg-brand-gold' : ''}`}
                            activeOpacity={0.7}>
                            <Ionicons
                                name={opt.icon}
                                size={14}
                                color={active ? '#FFFFFF' : '#BF9A54'}
                            />
                            <Text
                                className={`font-inter-medium text-xs ml-1 ${active ? 'text-white' : 'text-brand-black dark:text-brand-dark-text'}`}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};
