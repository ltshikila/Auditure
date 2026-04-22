import React from 'react';
import { View } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';
import { useIsDark } from '@/hooks/use-colors';

const FeedListItemSkeleton = () => {
    const isDark = useIsDark();
    return (
    <View style={{ flexDirection: 'row', padding: 12, marginHorizontal: 24, marginBottom: 12, backgroundColor: isDark ? '#1E2022' : '#F5F5F0', borderRadius: 12 }}>
        <SkeletonBox width={70} height={90} borderRadius={8} />
        <View style={{ flex: 1, marginLeft: 12 }}>
            <SkeletonBox width="80%" height={14} style={{ marginBottom: 6 }} />
            <SkeletonBox width="50%" height={12} style={{ marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <SkeletonBox width={40} height={10} />
                <SkeletonBox width={40} height={10} />
            </View>
        </View>
    </View>
    );
};

export const FeedListSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <View style={{ paddingTop: 16 }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <FeedListItemSkeleton key={i} />
                ))}
            </View>
        </SkeletonProvider>
    );
};
