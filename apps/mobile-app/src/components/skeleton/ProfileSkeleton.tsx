import React from 'react';
import { View } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

const SettingRowSkeleton = () => (
    <View className="flex-row items-center justify-between py-4 border-b border-black/5 dark:border-white/10">
        <View className="flex-row items-center flex-1">
            <SkeletonBox width={32} height={32} circle style={{ marginRight: 12 }} />
            <SkeletonBox width={140} height={14} />
        </View>
        <SkeletonBox width={44} height={24} borderRadius={12} />
    </View>
);

export const ProfileSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <View style={{ paddingHorizontal: 20, paddingBottom: 25 }}>
                {/* Personal Information Card */}
                <View className="bg-white dark:bg-brand-dark-surface rounded-2xl p-5 mb-6" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                    <SkeletonBox width={160} height={18} style={{ marginBottom: 16 }} />
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <SkeletonBox width={80} height={80} circle style={{ marginBottom: 12 }} />
                        <SkeletonBox width={180} height={12} />
                    </View>
                    {/* Name rows */}
                    <View className="flex-row justify-between mb-3">
                        <SkeletonBox width={80} height={12} />
                        <SkeletonBox width={120} height={12} />
                    </View>
                    <View className="flex-row justify-between mb-3">
                        <SkeletonBox width={80} height={12} />
                        <SkeletonBox width={120} height={12} />
                    </View>
                    <View className="flex-row justify-between">
                        <SkeletonBox width={100} height={12} />
                        <SkeletonBox width={100} height={12} />
                    </View>
                </View>

                {/* Subscription Card */}
                <View className="bg-white dark:bg-brand-dark-surface rounded-2xl p-5 mb-6" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                    <SkeletonBox width={120} height={18} style={{ marginBottom: 12 }} />
                    <SkeletonBox width={60} height={24} borderRadius={12} style={{ marginBottom: 16 }} />
                    <SkeletonBox width="100%" height={8} borderRadius={4} style={{ marginBottom: 8 }} />
                    <SkeletonBox width="100%" height={8} borderRadius={4} style={{ marginBottom: 16 }} />
                    <SkeletonBox width="100%" height={44} borderRadius={22} />
                </View>

                {/* Settings Card */}
                <View className="bg-white dark:bg-brand-dark-surface rounded-2xl p-5 mb-6" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                    <SkeletonBox width={120} height={18} style={{ marginBottom: 8 }} />
                    <SettingRowSkeleton />
                    <SettingRowSkeleton />
                    <SettingRowSkeleton />
                </View>

                {/* Account Card */}
                <View className="bg-white dark:bg-brand-dark-surface rounded-2xl p-5" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                    <SkeletonBox width={100} height={18} style={{ marginBottom: 16 }} />
                    <SkeletonBox width="100%" height={44} borderRadius={22} style={{ marginBottom: 12 }} />
                    <SkeletonBox width="100%" height={44} borderRadius={22} />
                </View>
            </View>
        </SkeletonProvider>
    );
};
