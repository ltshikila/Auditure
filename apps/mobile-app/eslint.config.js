// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

// Manually import plugins that aren't exposed by Expo's config
const tseslint = require('typescript-eslint');
const reactNativePlugin = require('eslint-plugin-react-native');

module.exports = defineConfig([
    // 1. Base Expo Configuration
    // Spread ensures we inherit all base setups
    ...(Array.isArray(expoConfig) ? expoConfig : [expoConfig]),

    // 2. Custom Rules for Auditure MVVM Architecture
    {
        files: ['**/*.{ts,tsx,js,jsx}'],

        // DEFINE PLUGINS:
        // 1. @typescript-eslint: Needed because Expo doesn't expose it to this block.
        // 2. react-native: Needed because Expo hides it from this block.
        // 3. react-hooks: OMITTED. Expo exposes this, so defining it here would crash.
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            'react-native': reactNativePlugin,
        },

        rules: {
            // --- Hook Rules (Provided by Expo's implicit plugin) ---
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',

            // --- React Native Rules (Provided by our manual plugin above) ---
            'react-native/no-inline-styles': 'warn',

            // --- TypeScript Rules (Provided by our manual plugin above) ---
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

            // --- General Maintainability ---
            'no-console': 'warn',
        },
    },

    // 3. Prettier Config (Always last)
    prettierConfig,

    // 4. Global Ignores
    {
        ignores: ['dist/*', 'node_modules/*', 'web-build/*'],
    },
]);
