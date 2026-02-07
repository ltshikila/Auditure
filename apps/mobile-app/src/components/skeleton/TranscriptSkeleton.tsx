import React from 'react';
import { View } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

export const TranscriptSkeleton: React.FC = () => {
    const lineWidths = ['80%', '95%', '60%', '90%', '75%', '85%', '50%', '92%', '70%', '88%'] as const;

    return (
        <SkeletonProvider>
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
                {lineWidths.map((width, i) => (
                    <SkeletonBox key={i} width={width} height={16} style={{ marginBottom: 14 }} />
                ))}
            </View>
        </SkeletonProvider>
    );
};
