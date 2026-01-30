/**
 * Auditure Design System
 *
 * Primary brand colors and typography used throughout the app.
 * These should match the Tailwind config in tailwind.config.js
 */

import { Platform } from 'react-native';

// Brand Colors
export const BrandColors = {
    red: '#920002',      // Primary action buttons, active states
    gold: '#BF9A54',     // Accents, toggles, links, secondary actions
    beige: '#FBF8F2',    // Main background
    input: '#F1EEE3',    // Input field backgrounds
    black: '#2F2F2F',    // Primary text, headings
};

// Neutral Colors
export const NeutralColors = {
    white: '#FFFFFF',
    gray100: '#F5F5F0',  // Card backgrounds
    gray200: '#E8E3D6',  // Borders, dividers
    gray300: '#E7E0CB',  // Toggle backgrounds
    gray400: '#E0E0E0',  // Light borders
    gray500: '#A0A0A0',  // Placeholder text
    gray600: '#858585',  // Secondary text
    gray700: '#6C7278',  // Subtitle text
    gray800: '#1A1C1E',  // Dark text alternative
    black: '#1F1F1F',    // Deepest black
};

// Semantic Colors
export const SemanticColors = {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
};

// Theme colors for light/dark mode (React Navigation compatible)
export const Colors = {
    light: {
        // Core
        text: BrandColors.black,
        background: BrandColors.beige,
        tint: BrandColors.red,

        // UI Elements
        primary: BrandColors.red,
        secondary: BrandColors.gold,
        card: NeutralColors.gray100,
        border: NeutralColors.gray200,
        input: BrandColors.input,

        // Text variants
        textSecondary: NeutralColors.gray600,
        textMuted: NeutralColors.gray500,
        placeholder: NeutralColors.gray500,

        // Navigation
        icon: NeutralColors.gray600,
        tabIconDefault: NeutralColors.gray600,
        tabIconSelected: BrandColors.black,
        tabBarBackground: BrandColors.beige,
    },
    dark: {
        // Dark mode (currently mirrors light - can be customized)
        text: '#ECEDEE',
        background: '#151718',
        tint: BrandColors.gold,

        primary: BrandColors.red,
        secondary: BrandColors.gold,
        card: '#1E2022',
        border: '#2E3235',
        input: '#252729',

        textSecondary: '#9BA1A6',
        textMuted: '#687076',
        placeholder: '#687076',

        icon: '#9BA1A6',
        tabIconDefault: '#9BA1A6',
        tabIconSelected: '#FFFFFF',
        tabBarBackground: '#151718',
    },
};

// Typography - Font Families
export const Fonts = {
    // Inter - Body text
    inter: {
        regular: 'Inter_400Regular',
        medium: 'Inter_500Medium',
        bold: 'Inter_700Bold',
    },
    // Plus Jakarta Sans - Headings
    jakarta: {
        regular: 'PlusJakartaSans_400Regular',
        medium: 'PlusJakartaSans_500Medium',
        bold: 'PlusJakartaSans_700Bold',
    },
    // DM Serif Display - Brand/Logo
    dmSerif: {
        regular: 'DMSerifDisplay_400Regular',
    },
    // System fonts fallback
    system: Platform.select({
        ios: {
            sans: 'system-ui',
            serif: 'ui-serif',
            mono: 'ui-monospace',
        },
        android: {
            sans: 'Roboto',
            serif: 'serif',
            mono: 'monospace',
        },
        default: {
            sans: 'System',
            serif: 'serif',
            mono: 'monospace',
        },
    }),
};

// Font size scale
export const FontSizes = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
};

// Spacing scale (matches Tailwind defaults)
export const Spacing = {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
};

// Border radius
export const BorderRadius = {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 24,
    full: 9999,
};

// Export for Tailwind class reference
export const TailwindClasses = {
    colors: {
        'brand-red': BrandColors.red,
        'brand-gold': BrandColors.gold,
        'brand-beige': BrandColors.beige,
        'brand-input': BrandColors.input,
        'brand-black': BrandColors.black,
    },
    fonts: {
        'font-inter': Fonts.inter.regular,
        'font-inter-medium': Fonts.inter.medium,
        'font-inter-bold': Fonts.inter.bold,
        'font-jakarta': Fonts.jakarta.regular,
        'font-jakarta-medium': Fonts.jakarta.medium,
        'font-jakarta-bold': Fonts.jakarta.bold,
        'font-dm-serif': Fonts.dmSerif.regular,
    },
};
