import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';

/**
 * Returns the active color palette (light or dark) based on the user's
 * resolved theme preference. Use this for dynamic color props like
 * Ionicons `color`, ActivityIndicator `color`, etc.
 */
export function useColors() {
    const { resolved } = useTheme();
    return Colors[resolved];
}

export function useIsDark() {
    const { resolved } = useTheme();
    return resolved === 'dark';
}
