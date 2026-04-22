import React from 'react';
import { View } from 'react-native';
import { SkeletonProvider } from './SkeletonProvider';
import { SkeletonBox } from './SkeletonBox';
import { useIsDark } from '@/hooks/use-colors';

const NotificationItemSkeleton = () => {
    const isDark = useIsDark();
    return (
    <View style={{ flexDirection: 'row', padding: 16, marginHorizontal: 16, marginBottom: 12, backgroundColor: isDark ? '#1E2022' : '#F5F5F0', borderRadius: 16 }}>
        <SkeletonBox width={48} height={48} borderRadius={12} />
        <View style={{ flex: 1, marginLeft: 16 }}>
            <SkeletonBox width="70%" height={14} style={{ marginBottom: 6 }} />
            <SkeletonBox width="90%" height={12} style={{ marginBottom: 4 }} />
            <SkeletonBox width="50%" height={12} />
        </View>
    </View>
    );
};

export const NotificationsSkeleton: React.FC = () => {
    return (
        <SkeletonProvider>
            <View style={{ paddingTop: 8 }}>
                {[1, 2, 3, 4, 5].map(i => (
                    <NotificationItemSkeleton key={i} />
                ))}
            </View>
        </SkeletonProvider>
    );
};
