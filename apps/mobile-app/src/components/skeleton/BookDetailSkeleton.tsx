import React from 'react';
import { View, ScrollView } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

export const BookDetailSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Book cover */}
                <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 20 }}>
                    <SkeletonBox width={154} height={230} borderRadius={12} />
                </View>

                {/* Title + Author */}
                <View style={{ paddingHorizontal: 24 }}>
                    <SkeletonBox width="55%" height={24} style={{ marginBottom: 8 }} />
                    <SkeletonBox width="35%" height={16} style={{ marginBottom: 20 }} />
                </View>

                {/* Stats row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 24, marginBottom: 32 }}>
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

                {/* Episode section 1 */}
                <View className="flex-row items-center justify-between mb-3 px-6">
                    <SkeletonBox width={120} height={18} />
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

                {/* Episode section 2 */}
                <View style={{ marginTop: 24 }}>
                    <View className="flex-row items-center justify-between mb-3 px-6">
                        <SkeletonBox width={140} height={18} />
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
                </View>

                <View className="h-24" />
            </ScrollView>
        </SkeletonProvider>
    );
};
