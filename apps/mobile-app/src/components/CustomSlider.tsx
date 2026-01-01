import React from 'react';
import { View, Text } from 'react-native';
import Slider from '@react-native-community/slider';

interface CustomSliderProps {
    label: string;
    value: number;
    onValueChange: (value: number) => void;
    leftLabel: string;
    rightLabel: string;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    showValue?: boolean;
}

export const CustomSlider: React.FC<CustomSliderProps> = ({
    label,
    value,
    onValueChange,
    leftLabel,
    rightLabel,
    minimumValue = 1,
    maximumValue = 10,
    step = 1,
    showValue = true,
}) => {
    return (
        <View className="mb-6">
            {/* Label and Value */}
            {label && (
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg">{label}</Text>
                    {showValue && (
                        <View className="bg-brand-gold rounded-full px-4 py-1.5">
                            <Text className="text-white font-inter-medium text-base">{value}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Slider Track */}
            <View className="px-1">
                <Slider
                    value={value}
                    onValueChange={onValueChange}
                    minimumValue={minimumValue}
                    maximumValue={maximumValue}
                    step={step}
                    minimumTrackTintColor="#BF9A54"
                    maximumTrackTintColor="#E8E3D6"
                    thumbTintColor="#BF9A54"
                    style={{ width: '100%', height: 40 }}
                />
            </View>

            {/* Left and Right Labels */}
            <View className="flex-row justify-between px-2 mt-1">
                <Text className="text-[#858585] font-inter text-sm">{leftLabel}</Text>
                <Text className="text-[#858585] font-inter text-sm">{rightLabel}</Text>
            </View>
        </View>
    );
};
