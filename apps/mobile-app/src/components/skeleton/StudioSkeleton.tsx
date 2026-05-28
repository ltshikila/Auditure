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
            <View className="px-5">
                {/* Section Header */}
                <View className="flex-row justify-between items-center mb-3">
                    <SkeletonBox width={150} height={18} />
                    <SkeletonBox width={24} height={24} circle />
                </View>
                {/* Grid */}
                <View className="flex-row flex-wrap gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <PodcasterGridCard key={i} />
                    ))}
                </View>
            </View>
        </SkeletonProvider>
    );
};
