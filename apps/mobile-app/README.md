# Narratica Mobile App

The client-facing mobile application built with **React Native** and **Expo**. It provides a seamless cross-platform experience for iOS and Android, handling user authentication, book uploads, virtual podcaster management, episode generation, and audio playback.

## Features

### Authentication (FR-1, FR-2, FR-3)

- Email/password login and registration
- OAuth integration (Google Sign-In, Apple Sign-In)
- Optional Two-Factor Authentication (2FA) via SMS or authenticator app
- User profile management with settings and preferences

### Virtual Podcaster Management (FR-4 to FR-8)

- Create and configure AI virtual podcasters
- Customize podcaster attributes:
    - Name and avatar
    - Personality and speaking style
    - TTS voice selection with accent, tone, and style
    - Speech parameters (pace, pitch, emphasis)
- Browse predefined personality templates
- Follow favorite podcasters

### Book Ingestion (FR-9 to FR-12)

- Upload PDF and EPUB files from device
- Input URLs for content extraction
- Optional integration with Google Drive and Dropbox
- Preview extracted text before processing

### Content Selection & Episode Generation (FR-13 to FR-19)

- Select full books, specific chapters, or page ranges
- Combine multiple sections into a single episode
- Choose episode type:
    - Monologue (single host)
    - Dual-host conversation
    - Group discussion
- Real-time generation status updates
- Push notifications when episodes complete

### Episode Feed & Discovery (FR-20 to FR-25)

- Scrollable feed of generated episodes
- In-app audio player with playback controls
- Search by title, author, keywords, or podcaster name
- Trending and recommended episodes
- Episode bookmarking for later

### Audio Playback

- **Background Audio**: Continue playback when app is in background
- **Persistent Mini-Player**: Always-visible player at bottom of screen
- **Full Player Screen**: Full-screen controls with seek, skip, playback rate
- **Resume Playback**: Position saved to server, resume where you left off
- **Notification Controls**: Control playback from phone notification/lock screen
- **Streaming**: HTTP range request support for efficient seeking

### Social Features (FR-22, FR-23)

- Like episodes
- Comment on episodes
- Follow podcasters
- Share episodes with friends

### Content Management (FR-26 to FR-28)

- View history of uploaded books and episodes
- Edit and regenerate existing episodes
- Download audio files for offline listening

## Setup & Installation

Dependencies are managed via the root `npm install`. Ensure you are in the `apps/mobile-app` directory for app-specific commands.

```bash
cd apps/mobile-app
```

## Running the App

We use Expo for development to ensure cross-platform compatibility.

### Start the Metro Bundler

```bash
npm start
```

```powershell
  cd apps/mobile-app
  npx expo start --clear
```

-Or from the root folder

```powershell
npm run start --workspace=mobile-app
```

- The `--clear` flag resets the Metro cache.
- Test with:
    - **Expo Go**: Scan the QR code on an iOS/Android device.
    - **Emulator**: Press `a` (Android Studio) or `i` (Xcode, macOS only).
- If connection issues occur, use:
    ```powershell
    npx expo start --tunnel
    ```

### Platform-Specific Commands

```bash
# Android only
npm run android

# iOS only (requires macOS)
npm run ios
```

## Testing & Linting

### Linting

Uses ESLint with strict TypeScript rules to maintain code quality.

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Unit Tests

Using Jest and React Native Testing Library:

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

## Building for Production

To create standalone builds (APK/IPA) for distribution:

### Prerequisites

1. **Install EAS CLI:**

```bash
npm install -g eas-cli
```

2. **Configure EAS:**

```bash
eas login
eas build:configure
```

### Build Commands

```bash
# Android APK
eas build --profile production --platform android

# iOS IPA (requires Apple Developer account)
eas build --profile production --platform ios

# Build for both platforms
eas build --profile production --platform all
```

## Project Structure

```text
mobile-app/
├── src/
│   ├── app/                 # Expo Router screens (file-based routing)
│   │   ├── (tabs)/         # Tab navigation screens
│   │   ├── episodes/       # Episode screens (info, play, transcript)
│   │   │   └── [episode]/  # Dynamic episode routes
│   │   └── _layout.tsx     # Root layout with providers
│   ├── components/          # Reusable UI components
│   │   ├── auth/           # Login, signup forms
│   │   ├── podcasters/     # Podcaster cards, config forms
│   │   ├── episodes/       # Episode cards, player
│   │   ├── MiniPlayer.tsx  # Persistent mini-player
│   │   └── common/         # Buttons, inputs, modals
│   ├── contexts/            # React Context providers
│   │   ├── AuthContext.tsx
│   │   └── PlaybackContext.tsx  # Audio playback state
│   ├── services/            # API calls and business logic
│   │   ├── auth.service.ts
│   │   ├── books.service.ts
│   │   ├── episodes.service.ts
│   │   ├── playback.service.ts  # Streaming & progress APIs
│   │   └── podcasters.service.ts
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useAudioPlayer.ts
│   │   └── useEpisodes.ts
│   ├── store/               # State management (Context API or Redux)
│   ├── utils/               # Helper functions
│   ├── types/               # TypeScript type definitions
│   └── constants/           # App constants and configuration
├── assets/                  # Images, fonts, icons
├── app.json                 # Expo configuration (with audio background mode)
├── eas.json                 # EAS Build configuration
├── tsconfig.json            # TypeScript configuration
└── package.json
```

## Configuration

### Environment Variables

Create a `.env` file in the app root:

```bash
# API Configuration
API_BASE_URL=http://localhost:3000
WS_BASE_URL=ws://localhost:3000

# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_CLIENT_ID=your-apple-client-id

# Feature Flags
ENABLE_2FA=true
ENABLE_CLOUD_IMPORT=true
```

### Expo Configuration (`app.json`)

Key settings for customization:

- App name and slug
- Icon and splash screen
- iOS bundle identifier
- Android package name
- Required permissions (camera, storage, microphone)

## API Integration

The app communicates with the Core API for all backend operations:

- **Authentication:** JWT-based with refresh tokens
- **File Upload:** Multipart form data for PDF/EPUB
- **Episode Generation:** Polling-based status with Redis progress tracking
- **Audio Streaming:** HTTP range requests for efficient seeking
- **Playback Progress:** Saved to Redis, synced every 10 seconds

### API Service Example

```typescript
// services/episodes.service.ts
export const generateEpisode = async (payload: EpisodeGenerationRequest) => {
    const response = await api.post('/episodes', payload);
    return response.data;
};
```

## UI/UX Guidelines

- **60fps Performance:** Optimize animations and list rendering (NFR-1)
- **Simple User Flow:** Upload → Configure → Generate (NFR-14)
- **Responsive Design:** Support various screen sizes and orientations
- **Accessibility:** Implement screen reader support and sufficient contrast ratios
- **Loading States:** Show progress indicators during async operations

## Platform-Specific Features

### iOS

- Apple Sign-In integration
- Native audio session handling
- Background audio playback
- Universal links

### Android

- Google Sign-In integration
- Background service for downloads
- Deep linking
- Notification channels

## Push Notifications

Episode generation completion notifications:

```typescript
// Setup Expo notifications
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});
```

## Performance Monitoring

- **Error Tracking:** Sentry integration for crash reporting
- **Analytics:** Track user engagement and feature usage
- **Performance Metrics:** Monitor app launch time and screen transitions

## Development Notes

- The app requires an active internet connection for most features
- Audio files are streamed from cloud storage for optimal performance
- Offline playback support planned for future releases
- OAuth requires platform-specific configuration in Expo app.json
- 2FA setup requires backend SMS/authenticator service integration

## Troubleshooting

### Common Issues

**Metro bundler not starting:**

```bash
npm start -- --reset-cache
```

**iOS simulator not found:**

```bash
# Open Xcode and install required simulators
```

**Android emulator connection issues:**

```bash
adb reverse tcp:3000 tcp:3000
```

- **Expo Go Connection**:
    - Ensure device and computer are on the same Wi-Fi or use `--tunnel`.
- **Node.js Version**:
    - Verify: `node --version`. Use `nvm use 18` if incorrect.
- **Slow Metro**:
    - The provided `metro.config.js` optimizes monorepo performance.

**Build failures:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```
