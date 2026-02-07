import React from 'react';
import { View } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

const PodcasterGridCard = () => (
    <View style={{ width: '30%', aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center' }}>
        <SkeletonBox width={64} height={64} circle style={{ marginBottom: 8 }} />
        <SkeletonBox width={60} height={10} />
    </View>
);

export const StudioSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <View className="flex-row flex-wrap gap-4 px-5">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <PodcasterGridCard key={i} />
                ))}
            </View>
        </SkeletonProvider>
    );
};
