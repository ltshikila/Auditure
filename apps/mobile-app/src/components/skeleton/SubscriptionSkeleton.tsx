import React from 'react';
import { View } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

export const SubscriptionSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <View style={{ padding: 20, paddingBottom: 100 }}>
                {/* Header */}
                <View style={{ marginBottom: 24 }}>
                    <SkeletonBox width={200} height={24} style={{ marginBottom: 8 }} />
                    <SkeletonBox width={280} height={14} />
                </View>

                {/* Current Plan Card */}
                <View className="bg-white rounded-2xl p-5 mb-6" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                    <SkeletonBox width={100} height={16} style={{ marginBottom: 12 }} />
                    <SkeletonBox width={70} height={26} borderRadius={13} style={{ marginBottom: 16 }} />
                    <SkeletonBox width="100%" height={8} borderRadius={4} style={{ marginBottom: 6 }} />
                    <View className="flex-row justify-between" style={{ marginBottom: 8 }}>
                        <SkeletonBox width={80} height={10} />
                        <SkeletonBox width={40} height={10} />
                    </View>
                    <SkeletonBox width="100%" height={8} borderRadius={4} style={{ marginBottom: 6 }} />
                    <View className="flex-row justify-between">
                        <SkeletonBox width={80} height={10} />
                        <SkeletonBox width={40} height={10} />
                    </View>
                </View>

                {/* Pricing Cards */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                    {/* Starter card */}
                    <View className="flex-1 bg-white rounded-2xl p-4" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                        <SkeletonBox width={60} height={20} style={{ marginBottom: 8 }} />
                        <SkeletonBox width={80} height={28} style={{ marginBottom: 4 }} />
                        <SkeletonBox width={50} height={10} style={{ marginBottom: 16 }} />
                        <SkeletonBox width="100%" height={12} style={{ marginBottom: 6 }} />
                        <SkeletonBox width="80%" height={12} style={{ marginBottom: 6 }} />
                        <SkeletonBox width="90%" height={12} style={{ marginBottom: 16 }} />
                        <SkeletonBox width="100%" height={40} borderRadius={20} />
                    </View>
                    {/* Pro card */}
                    <View className="flex-1 bg-white rounded-2xl p-4" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                        <SkeletonBox width={40} height={20} style={{ marginBottom: 8 }} />
                        <SkeletonBox width={80} height={28} style={{ marginBottom: 4 }} />
                        <SkeletonBox width={50} height={10} style={{ marginBottom: 16 }} />
                        <SkeletonBox width="100%" height={12} style={{ marginBottom: 6 }} />
                        <SkeletonBox width="80%" height={12} style={{ marginBottom: 6 }} />
                        <SkeletonBox width="90%" height={12} style={{ marginBottom: 16 }} />
                        <SkeletonBox width="100%" height={40} borderRadius={20} />
                    </View>
                </View>
            </View>
        </SkeletonProvider>
    );
};
