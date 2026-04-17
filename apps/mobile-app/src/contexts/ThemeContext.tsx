import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'auditure_theme_preference';

interface ThemeContextValue {
    preference: ThemePreference;
    resolved: ResolvedTheme;
    setPreference: (pref: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const { setColorScheme } = useNativeWindColorScheme();
    const [preference, setPreferenceState] = useState<ThemePreference>('system');
    const [systemScheme, setSystemScheme] = useState<ResolvedTheme>(
        (Appearance.getColorScheme() as ResolvedTheme | null) ?? 'light',
    );

    // Listen to OS-level scheme changes
    useEffect(() => {
        const sub = Appearance.addChangeListener(({ colorScheme }) => {
            setSystemScheme((colorScheme as ResolvedTheme | null) ?? 'light');
        });
        return () => sub.remove();
    }, []);

    // Load persisted preference on mount
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved === 'light' || saved === 'dark' || saved === 'system') {
                    setPreferenceState(saved);
                }
            } catch (e) {
                console.error('Failed to load theme preference', e);
            }
        })();
    }, []);

    const resolved: ResolvedTheme = preference === 'system' ? systemScheme : preference;

    // Sync resolved theme to NativeWind
    useEffect(() => {
        setColorScheme(resolved);
    }, [resolved, setColorScheme]);

    const setPreference = async (pref: ThemePreference) => {
        setPreferenceState(pref);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, pref);
        } catch (e) {
            console.error('Failed to save theme preference', e);
        }
    };

    const value = useMemo(
        () => ({ preference, resolved, setPreference }),
        [preference, resolved],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
