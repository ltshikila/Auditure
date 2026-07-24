# Auditure Mobile App

The client-facing mobile application built with **React Native** and **Expo**. It provides a seamless cross-platform experience for iOS and Android, handling user authentication, book uploads, virtual podcaster management, episode generation, and audio playback.

---

## Understanding the Architecture

### Why Expo (Not Plain React Native)?

Expo is a framework built on top of React Native. Here's why we use it:

| Aspect | Plain React Native | Expo |
|--------|-------------------|------|
| **Setup complexity** | Configure Xcode, Android Studio, native modules | `npx create-expo-app` and run |
| **Native code** | Full access, you manage it | Managed (Expo handles native) |
| **OTA updates** | Implement yourself (CodePush, etc.) | Built-in with `expo-updates` |
| **Build servers** | Set up CI/CD with native SDKs | EAS Build (cloud-based) |
| **Push notifications** | Configure FCM/APNs yourself | `expo-notifications` handles both |

**We chose Expo because:**
1. **Faster development** - No native build setup for most features
2. **OTA updates** - Push JS updates without App Store review
3. **EAS Build** - Cloud builds without maintaining Mac/Windows machines
4. **Expo SDK** - Pre-built modules for camera, notifications, auth, etc.

**Trade-off:** Some native modules require "ejecting" or using Expo's config plugins. For our use case (audio playback, notifications), Expo's managed workflow works.

### Expo Router: File-Based Routing

Expo Router uses **file-system based routing** like Next.js. The folder structure IS the route structure:

```
app/
├── index.tsx           → /              (home)
├── (auth)/             → Group (doesn't affect URL)
│   ├── Auth.tsx        → /Auth          (login screen)
│   └── _layout.tsx     → Auth layout wrapper
├── (tabs)/             → Group with tab navigation
│   ├── _layout.tsx     → Tab bar definition
│   ├── home.tsx        → /home          (first tab)
│   ├── library.tsx     → /library       (second tab)
│   └── create.tsx      → /create        (third tab)
├── episodes/
│   └── [id].tsx        → /episodes/123  (dynamic route)
├── feed/
│   ├── _layout.tsx     → Feed layout
│   └── see-all.tsx     → /feed/see-all
└── _layout.tsx         → Root layout (wraps everything)
```

**Key concepts:**

1. **`_layout.tsx`** - Wraps child routes. Used for navigation containers, providers, headers.

2. **`(groupName)/`** - Parentheses create a "group". Groups share a layout but DON'T add to the URL path. `/home` not `/(tabs)/home`.

3. **`[param].tsx`** - Square brackets create dynamic routes. `[id].tsx` matches `/episodes/123` and provides `id = "123"` via `useLocalSearchParams()`.

4. **`+not-found.tsx`** - Plus sign prefix for special routes like 404 pages.

### State Management: Context API vs Redux

We use React Context instead of Redux. Understanding when each is appropriate:

```
REDUX                                  CONTEXT API
─────                                  ───────────
┌─────────────────────┐               ┌─────────────────────┐
│ Single global store │               │ Multiple contexts   │
│   (one source)      │               │   (auth, playback)  │
└──────────┬──────────┘               └──────────┬──────────┘
           │                                     │
    ┌──────┴──────┐                    ┌────────┴────────┐
    ▼             ▼                    ▼                 ▼
 Reducers    Middleware            AuthContext    PlaybackContext
 (actions)   (thunks, sagas)       (simple)       (simple)
```

| Aspect | Redux | Context API |
|--------|-------|-------------|
| **Boilerplate** | High (actions, reducers, selectors) | Low (just provider + hook) |
| **DevTools** | Excellent (time travel debugging) | Limited |
| **Re-renders** | Optimized with selectors | Every consumer re-renders |
| **Learning curve** | Steep | Gentle |
| **Bundle size** | ~10KB gzipped | 0KB (built-in) |

**We chose Context API because:**
1. **Simple global state** - We only have auth + playback
2. **No complex state logic** - No undo/redo, no derived state
3. **Team familiarity** - Context is standard React
4. **Performance is fine** - Our contexts don't update frequently

**When to consider Redux/Zustand:**
- Many components update same state frequently
- Complex state derivations (memoized selectors)
- Need time-travel debugging
- State logic is complex (undo/redo, optimistic updates)

### PlaybackContext: Why Global Audio State?

Audio playback MUST persist across screen navigation:

```
User flow:
1. Tap episode on Home screen → starts playing
2. Navigate to Library → music keeps playing
3. Navigate to Settings → music keeps playing
4. Open full player from MiniPlayer → same audio continues

Without global context:
- Each screen would have its own audio instance
- Navigation would stop playback
- No way to show MiniPlayer across screens

With PlaybackContext:
- Single audio instance shared everywhere
- MiniPlayer reads from context (knows what's playing)
- Any screen can control playback (play/pause/seek)
```

**What PlaybackContext manages:**
- Current episode (id, title, artwork)
- Playback state (playing, paused, buffering)
- Position and duration
- Queue (if implemented)
- Audio player instance (expo-av)

## Features

### Authentication

- Email/password registration and login
- OTP email verification (via the Core API + Resend)
- JWT access tokens with automatic refresh (rotation)
- User profile management with settings and preferences

> Social login (Google/Apple) and 2FA are not implemented.

### Virtual Podcaster Management

- Create and configure virtual podcasters
- Customize podcaster attributes:
    - Name and avatar
    - Personality traits (tone, communication, humor, depth, chaos) on a 1-10 scale
    - Voice: gender, accent, speaking speed, vocal pitch, voice model
    - A permanently assigned Gemini voice for consistency across episodes
- Browse and follow public podcasters; rate them (1-5 stars)

### Book Ingestion

- Upload PDF and EPUB files from the device (32MB limit)
- Automatic text extraction and chapter detection (runs server-side)
- Cover images fetched automatically (Google Books + file fallback)

### Content Selection & Episode Generation

- Select the full book, specific chapters, or page ranges
- Choose episode type:
    - Monologue (single host)
    - Duo conversation (two hosts)
    - Themes: lecture, discussion, debate
- Real-time generation progress
- Push notification when the episode is ready

### Episode Feed & Discovery

- Curated feed across Episodes, Books, and Podcasters tabs
- In-app audio player with playback controls
- Unified search by title, author, keywords, or podcaster name
- Trending, top-rated, and latest sections

### Subscriptions

- Free, Starter, and Pro tiers via Google Play Billing (RevenueCat SDK)
- Purchases and management handled in-app by `react-native-purchases`
- Usage/quota surfaced from the Core API `/subscriptions/status`

### Audio Playback

- **Background Audio**: Continue playback when app is in background
- **Persistent Mini-Player**: Always-visible player at bottom of screen
- **Full Player Screen**: Full-screen controls with seek, skip, playback rate
- **Resume Playback**: Position saved to server, resume where you left off
- **Notification Controls**: Control playback from phone notification/lock screen
- **Streaming**: HTTP range request support for efficient seeking

### Social Features

- Like episodes
- Comment on episodes (with replies)
- Follow podcasters and rate them
- Share episodes

### Content Management

- View history of uploaded books and episodes
- Regenerate an existing episode with editor's notes (steering)

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

Public config is exposed through `EXPO_PUBLIC_*` variables. These must live in `eas.json` for production builds (not only `.env`), or prod builds ship without analytics/crash reporting.

```bash
# API
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000

# Analytics (PostHog) — RN emits $screen, not $pageview
EXPO_PUBLIC_POSTHOG_API_KEY=phc_xxx
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Crash reporting (Sentry)
EXPO_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

> RevenueCat is configured with the platform SDK key. Never place RevenueCat `test_*` keys in the production EAS profile — they intentionally crash release builds.

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

- Native audio session handling
- Background audio playback
- Universal links (waitlist; iOS not yet shipped)

### Android

- Google Play Billing (via RevenueCat)
- Background audio playback
- Deep linking (`auditure://`)
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

- **Error Tracking:** Sentry (`@sentry/react-native`) for crash reporting
- **Analytics:** PostHog (`posthog-react-native`). React Native emits `$screen` events, not `$pageview`.
- Both require their `EXPO_PUBLIC_*` keys in `eas.json` for production builds.

## Development Notes

- The app requires an active internet connection for most features
- Audio is streamed from the Core API with HTTP range requests (efficient seeking)
- Offline playback is not yet implemented
- Subscriptions are handled by the RevenueCat SDK; the backend stays in sync via webhooks

## Common Mistakes to Avoid

```typescript
// BAD: Fetching data without cleanup
useEffect(() => {
  fetch('/api/episodes').then(res => setEpisodes(res));
}, []);
// If component unmounts before fetch completes: memory leak + setState warning

// GOOD: Cleanup with AbortController
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/episodes', { signal: controller.signal })
    .then(res => setEpisodes(res))
    .catch(err => {
      if (err.name !== 'AbortError') throw err;
    });
  return () => controller.abort();
}, []);

// BAD: Hardcoded API URLs
const response = await fetch('http://localhost:3000/api/episodes');
// Won't work on real devices!

// GOOD: Use environment-based config
import { API_BASE_URL } from '@/constants/config';
const response = await fetch(`${API_BASE_URL}/api/episodes`);

// BAD: Not handling token expiry
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
});
// Token might be expired!

// GOOD: Use getAccessToken() which handles refresh
const token = await getAccessToken(); // Automatically refreshes if needed
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
});

// BAD: Inline styles everywhere
<View style={{ flex: 1, padding: 16, backgroundColor: '#FEFCF7' }}>

// GOOD: Use Nativewind/Tailwind classes
<View className="flex-1 p-4 bg-brand-beige">

// BAD: Navigation with string concatenation
router.push('/episodes/' + episode.id);

// GOOD: Use template literals or params
router.push(`/episodes/${episode.id}`);
// Or with typed params:
router.push({ pathname: '/episodes/[id]', params: { id: episode.id } });
```

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
