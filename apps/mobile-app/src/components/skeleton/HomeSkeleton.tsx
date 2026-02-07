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

const FeaturedCardSkeleton = () => (
    <View style={{ width: 220, marginRight: 16 }}>
        <SkeletonBox width={220} height={300} borderRadius={16} />
    </View>
);

const PodcasterCardSkeleton = () => (
    <View style={{ width: 110, marginRight: 16, alignItems: 'center' }}>
        <SkeletonBox width={80} height={80} circle style={{ marginBottom: 8 }} />
        <SkeletonBox width={70} height={12} />
    </View>
);

export const HomeSkeleton: React.FC<{ activeTab?: string }> = ({ activeTab = 'episodes' }) => {
    return (
        <SkeletonProvider>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="pt-4">
                    {activeTab === 'podcasters' ? (
                        <>
                            <SectionHeaderSkeleton />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                                {[1, 2, 3, 4].map(i => <PodcasterCardSkeleton key={i} />)}
                            </ScrollView>
                            <View style={{ height: 24 }} />
                            <SectionHeaderSkeleton />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                                {[1, 2, 3, 4].map(i => <PodcasterCardSkeleton key={i} />)}
                            </ScrollView>
                            <View style={{ height: 24 }} />
                            <SectionHeaderSkeleton />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                                {[1, 2, 3, 4].map(i => <PodcasterCardSkeleton key={i} />)}
                            </ScrollView>
                        </>
                    ) : (
                        <>
                            {/* Featured section */}
                            <SectionHeaderSkeleton />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                                {[1, 2].map(i => <FeaturedCardSkeleton key={i} />)}
                            </ScrollView>
                            <View style={{ height: 24 }} />

                            {/* Regular sections */}
                            <SectionHeaderSkeleton />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                                {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                            </ScrollView>
                            <View style={{ height: 24 }} />

                            <SectionHeaderSkeleton />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                                {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
                            </ScrollView>
                        </>
                    )}
                </View>
                <View className="h-24" />
            </ScrollView>
        </SkeletonProvider>
    );
};
