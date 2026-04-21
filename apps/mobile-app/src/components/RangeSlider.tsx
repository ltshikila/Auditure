import React, { useState, useCallback } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
} from 'react-native-reanimated';

interface RangeSliderProps {
    label: string;
    minValue: number;
    maxValue: number;
    initialMin: number;
    initialMax: number;
    step?: number;
    onValuesChange: (min: number, max: number) => void;
    formatLabel?: (value: number) => string;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
    label,
    minValue,
    maxValue,
    initialMin,
    initialMax,
    step = 1,
    onValuesChange,
    formatLabel = (v) => `${v}min`,
}) => {
    const [sliderWidth, setSliderWidth] = useState(0);
    const [currentMin, setCurrentMin] = useState(initialMin);
    const [currentMax, setCurrentMax] = useState(initialMax);

    const THUMB_SIZE = 24;
    const range = maxValue - minValue;

    const minPosition = useSharedValue(
        ((initialMin - minValue) / range) * (sliderWidth - THUMB_SIZE)
    );
    const maxPosition = useSharedValue(
        ((initialMax - minValue) / range) * (sliderWidth - THUMB_SIZE)
    );

    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const { width } = event.nativeEvent.layout;
        setSliderWidth(width);

        // Update positions when width is known
        minPosition.value = ((initialMin - minValue) / range) * (width - THUMB_SIZE);
        maxPosition.value = ((initialMax - minValue) / range) * (width - THUMB_SIZE);
    }, [initialMin, initialMax, minValue, range]);

    const positionToValue = useCallback((position: number): number => {
        const rawValue = minValue + (position / (sliderWidth - THUMB_SIZE)) * range;
        const steppedValue = Math.round(rawValue / step) * step;
        return Math.max(minValue, Math.min(maxValue, steppedValue));
    }, [minValue, maxValue, sliderWidth, range, step]);

    const updateValues = useCallback((newMin: number, newMax: number) => {
        setCurrentMin(newMin);
        setCurrentMax(newMax);
        onValuesChange(newMin, newMax);
    }, [onValuesChange]);

    const minGesture = Gesture.Pan()
        .onUpdate((event) => {
            const newPosition = Math.max(
                0,
                Math.min(event.absoluteX - THUMB_SIZE / 2, maxPosition.value - THUMB_SIZE)
            );
            minPosition.value = newPosition;
            const newValue = positionToValue(newPosition);
            runOnJS(updateValues)(newValue, currentMax);
        });

    const maxGesture = Gesture.Pan()
        .onUpdate((event) => {
            const newPosition = Math.max(
                minPosition.value + THUMB_SIZE,
                Math.min(event.absoluteX - THUMB_SIZE / 2, sliderWidth - THUMB_SIZE)
            );
            maxPosition.value = newPosition;
            const newValue = positionToValue(newPosition);
            runOnJS(updateValues)(currentMin, newValue);
        });

    const minThumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: minPosition.value }],
    }));

    const maxThumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: maxPosition.value }],
    }));

    const trackFillStyle = useAnimatedStyle(() => ({
        left: minPosition.value + THUMB_SIZE / 2,
        right: sliderWidth - maxPosition.value - THUMB_SIZE / 2,
    }));

    // Generate tick marks
    const tickCount = Math.floor((maxValue - minValue) / 15) + 1;
    const ticks = Array.from({ length: tickCount }, (_, i) => minValue + i * 15);

    return (
        <View className="mb-6">
            {/* Label */}
            <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-3">{label}</Text>

            {/* Value badges */}
            <View className="flex-row justify-between mb-2">
                <View className="bg-brand-gold rounded-md px-3 py-1">
                    <Text className="text-white font-inter-medium text-sm">{currentMin}</Text>
                </View>
                <View className="bg-brand-gold rounded-md px-3 py-1">
                    <Text className="text-white font-inter-medium text-sm">{currentMax}</Text>
                </View>
            </View>

            {/* Slider track */}
            <View
                className="h-1.5 bg-[#E5E7EB] dark:bg-brand-dark-border rounded-full relative"
                onLayout={onLayout}
                style={{ marginHorizontal: THUMB_SIZE / 2 }}
            >
                {/* Active track fill */}
                <Animated.View
                    className="absolute h-full bg-brand-gold rounded-full"
                    style={trackFillStyle}
                />

                {/* Min Thumb */}
                <GestureDetector gesture={minGesture}>
                    <Animated.View
                        className="absolute w-6 h-6 bg-white dark:bg-brand-dark-surface rounded-full border-2 border-brand-gold shadow-sm"
                        style={[
                            { top: -9, marginLeft: -THUMB_SIZE / 2 },
                            minThumbStyle,
                        ]}
                    />
                </GestureDetector>

                {/* Max Thumb */}
                <GestureDetector gesture={maxGesture}>
                    <Animated.View
                        className="absolute w-6 h-6 bg-white dark:bg-brand-dark-surface rounded-full border-2 border-brand-gold shadow-sm"
                        style={[
                            { top: -9, marginLeft: -THUMB_SIZE / 2 },
                            maxThumbStyle,
                        ]}
                    />
                </GestureDetector>
            </View>

            {/* Tick marks and labels */}
            <View className="flex-row justify-between mt-2 px-0" style={{ marginHorizontal: THUMB_SIZE / 2 }}>
                {ticks.map((tick) => (
                    <View key={tick} className="items-center">
                        <View className="w-px h-2 bg-[#858585]" />
                        <Text className="text-[#858585] dark:text-brand-dark-text-secondary font-inter text-xs mt-1">
                            {formatLabel(tick)}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
};
