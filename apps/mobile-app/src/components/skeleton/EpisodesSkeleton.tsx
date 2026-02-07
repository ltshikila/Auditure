import React from 'react';
import { View, ScrollView } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

const SectionHeaderSkeleton = () => (
    <View className="flex-row items-center justify-between mb-3 px-6">
        <SkeletonBox width={150} height={18} />
        <SkeletonBox width={55} height={14} />
    </View>
);

const CardSkeleton = () => (
    <View style={{ width: 110, marginRight: 16 }}>
        <SkeletonBox width={110} height={160} borderRadius={8} style={{ marginBottom: 8 }} />
        <SkeletonBox width={100} height={12} style={{ marginBottom: 4 }} />
        <SkeletonBox width={70} height={10} />
    </View>
);

export const EpisodesSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* My Episodes section */}
                <View className="mb-6">
                    <SectionHeaderSkeleton />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                        {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                    </ScrollView>
                </View>

                {/* Liked Episodes section */}
                <View className="mb-6">
                    <SectionHeaderSkeleton />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                        {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                    </ScrollView>
                </View>

                {/* Started section */}
                <View className="mb-6">
                    <SectionHeaderSkeleton />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                        {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
                    </ScrollView>
                </View>

                <View className="h-24" />
            </ScrollView>
        </SkeletonProvider>
    );
};
