import React from 'react';
import { View } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

export const PodcastManageSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <View style={{ padding: 24 }}>
                {/* Profile picture */}
                <View style={{ alignItems: 'center', marginBottom: 32 }}>
                    <SkeletonBox width={120} height={120} circle />
                </View>

                {/* Name field */}
                <SkeletonBox width={120} height={14} style={{ marginBottom: 8 }} />
                <SkeletonBox width="100%" height={48} borderRadius={12} style={{ marginBottom: 24 }} />

                {/* Description field */}
                <SkeletonBox width={100} height={14} style={{ marginBottom: 8 }} />
                <SkeletonBox width="100%" height={80} borderRadius={12} style={{ marginBottom: 24 }} />

                {/* Voice model */}
                <SkeletonBox width={90} height={14} style={{ marginBottom: 8 }} />
                <SkeletonBox width="100%" height={48} borderRadius={12} style={{ marginBottom: 24 }} />

                {/* Toggle row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <SkeletonBox width={100} height={14} />
                    <SkeletonBox width={44} height={24} borderRadius={12} />
                </View>

                {/* Save button */}
                <SkeletonBox width="100%" height={48} borderRadius={24} />
            </View>
        </SkeletonProvider>
    );
};
