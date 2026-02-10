import React, { useRef, useState, useMemo } from 'react';
import { View, Text, PanResponder } from 'react-native';

const THUMB_SIZE = 18;
const TRACK_PADDING = THUMB_SIZE / 2;

interface SliderTrackProps {
    value: number;
    onValueChange: (value: number) => void;
    onSlidingStart?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
}

export const SliderTrack: React.FC<SliderTrackProps> = ({
    value,
    onValueChange,
    onSlidingStart,
    onSlidingComplete,
    minimumValue = 1,
    maximumValue = 10,
    step = 1,
}) => {
    const [trackWidth, setTrackWidth] = useState(0);
    const trackRef = useRef<View>(null);
    const trackPageX = useRef(0);
    const trackWidthRef = useRef(0);

    // Use refs so PanResponder always has latest callbacks without recreation
    const cbRef = useRef({ onValueChange, onSlidingStart, onSlidingComplete });
    cbRef.current = { onValueChange, onSlidingStart, onSlidingComplete };

    const propsRef = useRef({ minimumValue, maximumValue, step });
    propsRef.current = { minimumValue, maximumValue, step };

    const computeValue = (pageX: number): number => {
        const { minimumValue: min, maximumValue: max, step: s } = propsRef.current;
        const relX = Math.max(0, Math.min(pageX - trackPageX.current, trackWidthRef.current));
        const frac = trackWidthRef.current > 0 ? relX / trackWidthRef.current : 0;
        const raw = min + frac * (max - min);
        return Math.max(min, Math.min(max, Math.round(raw / s) * s));
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: (evt) => {
                    const val = computeValue(evt.nativeEvent.pageX);
                    cbRef.current.onValueChange(val);
                    cbRef.current.onSlidingStart?.(val);
                },
                onPanResponderMove: (evt) => {
                    const val = computeValue(evt.nativeEvent.pageX);
                    cbRef.current.onValueChange(val);
                },
                onPanResponderRelease: (evt) => {
                    const val = computeValue(evt.nativeEvent.pageX);
                    cbRef.current.onSlidingComplete?.(val);
                },
            }),
        [],
    );

    const range = maximumValue - minimumValue;
    const fraction = range > 0 ? Math.max(0, Math.min(1, (value - minimumValue) / range)) : 0;

    return (
        <View
            style={{ height: 40, justifyContent: 'center', paddingHorizontal: TRACK_PADDING }}
            {...panResponder.panHandlers}
        >
            <View
                ref={trackRef}
                style={{ height: 4, backgroundColor: '#E8E3D6', borderRadius: 2 }}
                onLayout={() => {
                    trackRef.current?.measureInWindow((x, _y, width) => {
                        trackPageX.current = x;
                        trackWidthRef.current = width;
                        setTrackWidth(width);
                    });
                }}
            >
                <View
                    style={{
                        height: '100%',
                        backgroundColor: '#BF9A54',
                        borderRadius: 2,
                        width: `${fraction * 100}%`,
                    }}
                />
            </View>
            {trackWidth > 0 && (
                <View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        left: TRACK_PADDING + fraction * trackWidth - THUMB_SIZE / 2,
                        width: THUMB_SIZE,
                        height: THUMB_SIZE,
                        borderRadius: THUMB_SIZE / 2,
                        backgroundColor: '#BF9A54',
                    }}
                />
            )}
        </View>
    );
};

interface CustomSliderProps {
    label: string;
    value: number;
    onValueChange: (value: number) => void;
    onSlidingStart?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
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
    onSlidingStart,
    onSlidingComplete,
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
            {label ? (
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg">{label}</Text>
                    {showValue && (
                        <View className="bg-brand-gold rounded-full px-4 py-1.5">
                            <Text className="text-white font-inter-medium text-base">{value}</Text>
                        </View>
                    )}
                </View>
            ) : null}

            <SliderTrack
                value={value}
                onValueChange={onValueChange}
                onSlidingStart={onSlidingStart}
                onSlidingComplete={onSlidingComplete}
                minimumValue={minimumValue}
                maximumValue={maximumValue}
                step={step}
            />

            {/* Left and Right Labels */}
            <View className="flex-row justify-between px-2 mt-1">
                <Text className="text-[#858585] font-inter text-sm">{leftLabel}</Text>
                <Text className="text-[#858585] font-inter text-sm">{rightLabel}</Text>
            </View>
        </View>
    );
};
