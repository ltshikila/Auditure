import React from 'react';
import { View, ScrollView } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

export const PodcastDetailSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
                    {/* Name + description */}
                    <SkeletonBox width="60%" height={24} style={{ marginBottom: 8 }} />
                    <SkeletonBox width="90%" height={12} style={{ marginBottom: 4 }} />
                    <SkeletonBox width="70%" height={12} style={{ marginBottom: 24 }} />

                    {/* Profile picture */}
                    <View style={{ alignItems: 'center', marginBottom: 24 }}>
                        <SkeletonBox width={128} height={128} circle style={{ marginBottom: 12 }} />
                        <SkeletonBox width={100} height={24} borderRadius={12} />
                    </View>

                    {/* Stats row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 32 }}>
                        <View style={{ alignItems: 'center' }}>
                            <SkeletonBox width={40} height={24} style={{ marginBottom: 4 }} />
                            <SkeletonBox width={50} height={10} />
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <SkeletonBox width={40} height={24} style={{ marginBottom: 4 }} />
                            <SkeletonBox width={50} height={10} />
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <SkeletonBox width={40} height={24} style={{ marginBottom: 4 }} />
                            <SkeletonBox width={50} height={10} />
                        </View>
                    </View>
                </View>

                {/* Episodes section */}
                <View className="flex-row items-center justify-between mb-3 px-6">
                    <SkeletonBox width={120} height={18} />
                    <SkeletonBox width={55} height={14} />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
                    {[1, 2, 3].map(i => (
                        <View key={i} style={{ width: 110, marginRight: 16 }}>
                            <SkeletonBox width={110} height={160} borderRadius={8} style={{ marginBottom: 8 }} />
                            <SkeletonBox width={100} height={12} style={{ marginBottom: 4 }} />
                            <SkeletonBox width={70} height={10} />
                        </View>
                    ))}
                </ScrollView>

                <View className="h-24" />
            </ScrollView>
        </SkeletonProvider>
    );
};
