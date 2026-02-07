import React, { useState } from 'react';
import { ViewStyle, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, interpolate } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSkeletonAnimation } from './SkeletonProvider';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const BASE_COLOR = '#E8E3D6';
const HIGHLIGHT_COLOR = '#F5F0E5';

interface SkeletonBoxProps {
    width: number | `${number}%`;
    height: number;
    borderRadius?: number;
    circle?: boolean;
    style?: ViewStyle;
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
    width,
    height,
    borderRadius = 8,
    circle = false,
    style,
}) => {
    const progress = useSkeletonAnimation();
    const [layoutWidth, setLayoutWidth] = useState(0);

    const resolvedBorderRadius = circle ? height / 2 : borderRadius;

    const onLayout = (e: LayoutChangeEvent) => {
        setLayoutWidth(e.nativeEvent.layout.width);
    };

    const shimmerStyle = useAnimatedStyle(() => {
        const w = layoutWidth || (typeof width === 'number' ? width : 200);
        const translateX = interpolate(progress.value, [0, 1], [-w, w]);
        return {
            transform: [{ translateX }],
        };
    });

    return (
        <Animated.View
            onLayout={onLayout}
            style={[
                {
                    width,
                    height,
                    borderRadius: resolvedBorderRadius,
                    backgroundColor: BASE_COLOR,
                    overflow: 'hidden',
                },
                style,
            ]}
            accessibilityRole="none"
        >
            <AnimatedLinearGradient
                colors={[BASE_COLOR, HIGHLIGHT_COLOR, BASE_COLOR]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                    {
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: '100%',
                        left: 0,
                    },
                    shimmerStyle,
                ]}
            />
        </Animated.View>
    );
};
