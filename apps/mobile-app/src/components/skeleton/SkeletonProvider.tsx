import React, { createContext, useContext } from 'react';
import { useSharedValue, withRepeat, withTiming, Easing, SharedValue } from 'react-native-reanimated';

const SkeletonContext = createContext<SharedValue<number> | null>(null);

export function useSkeletonAnimation(): SharedValue<number> {
    const shared = useContext(SkeletonContext);
    if (!shared) {
        throw new Error('useSkeletonAnimation must be used within a SkeletonProvider');
    }
    return shared;
}

export const SkeletonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const progress = useSharedValue(0);

    React.useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
    }, []);

    return (
        <SkeletonContext.Provider value={progress}>
            {children}
        </SkeletonContext.Provider>
    );
};
