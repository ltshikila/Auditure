import React from 'react';
import { View } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';

export const EpisodeDetailSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <View style={{ flex: 1, paddingHorizontal: 24 }}>
                {/* Cover image */}
                <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 20 }}>
                    <SkeletonBox width={154} height={230} borderRadius={12} />
                </View>

                {/* Title */}
                <SkeletonBox width="70%" height={22} style={{ marginBottom: 8 }} />

                {/* Podcaster name */}
                <SkeletonBox width="40%" height={14} style={{ marginBottom: 16 }} />

                {/* Stats row */}
                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
                    <SkeletonBox width={60} height={20} borderRadius={10} />
                    <SkeletonBox width={60} height={20} borderRadius={10} />
                    <SkeletonBox width={60} height={20} borderRadius={10} />
                </View>

                {/* Action buttons row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 }}>
                    <SkeletonBox width={40} height={40} circle />
                    <SkeletonBox width={40} height={40} circle />
                    <SkeletonBox width={40} height={40} circle />
                    <SkeletonBox width={40} height={40} circle />
                </View>

                {/* Tab bar */}
                <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E8E3D6', paddingBottom: 12 }}>
                    <SkeletonBox width={60} height={14} />
                    <SkeletonBox width={50} height={14} />
                    <SkeletonBox width={50} height={14} />
                    <SkeletonBox width={70} height={14} />
                </View>

                {/* Summary text lines */}
                <SkeletonBox width="95%" height={12} style={{ marginBottom: 10 }} />
                <SkeletonBox width="85%" height={12} style={{ marginBottom: 10 }} />
                <SkeletonBox width="90%" height={12} style={{ marginBottom: 10 }} />
                <SkeletonBox width="70%" height={12} style={{ marginBottom: 10 }} />
                <SkeletonBox width="80%" height={12} style={{ marginBottom: 10 }} />
                <SkeletonBox width="60%" height={12} />
            </View>
        </SkeletonProvider>
    );
};
