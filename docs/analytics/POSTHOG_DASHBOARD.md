# Auditure PostHog Dashboard Spec

North Star and supporting insights for product/usage analytics. Build these as
PostHog Insights and pin them to a dashboard named "Auditure North Star".

## Before you build: two pipeline fixes

1. **Mobile events now flow.** `EXPO_PUBLIC_POSTHOG_KEY` was missing from `eas.json`,
   so production builds shipped with PostHog disabled and sent zero events. Fixed in
   `apps/mobile-app/eas.json` (production + preview). Mobile events only appear in
   builds created AFTER that change ships, so expect mobile data to start fresh.
2. **Use `$screen`, not `$pageview`.** This is a React Native app. Autocapture emits
   `$screen` (and `$autocapture` for touches), never `$pageview`. The default
   "Quick start" dashboard tiles (DAU/WAU/Retention/Growth accounting) query
   `$pageview` and will stay empty. Recreate them on `$screen`, or use the
   action/event-based insights below instead.

## Event catalog (what we actually emit)

Server (core-api, always captured):
- `signup_started`, `signup`
- `episode_created` (props: `source` = `existing_book` | `upload`, `voiceTier`, `episodeType`)
- `quota_blocked` (props: `voiceTier`, `source`) - user hit their tier limit
- `episode_liked` (props: `episodeId`, `podcasterId`, `ownContent`)
- `episode_rated` (props: `episodeId`, `rating`)
- `subscription_activated`, `comp_granted`, `comp_extended`, `comp_revoked`, `comp_converted_to_paid`

Worker (ai-worker, generation outcomes):
- `episode_generation_completed` (props: `durationSec`, `wordCount`, `voiceTier`, `scriptMethod`, `truncated`)
- `episode_generation_failed` (props: `reason` = `duration_mismatch` | `content_unavailable` | `error`, `errorType`, `voiceTier`)

Mobile (client, flows once the eas.json fix ships):
- Navigation: `$screen`, `$autocapture`
- Onboarding: `onboarding_opened`, `onboarding_step_viewed`, `onboarding_completed`, `onboarding_skipped`
- Podcaster creation: `podcaster_create_opened` -> `podcaster_create_submitted` -> `podcaster_create_succeeded` / `_failed`
- Episode creation: `episode_create_opened` -> `episode_create_submitted` -> `episode_create_succeeded` / `_failed`, `book_upload_started` / `_failed`
- Playback: `episode_play_started`, `episode_progress`, `episode_completed`, `episode_skipped`, `episode_paused`, `episode_seek`, `episode_play_failed`
- Paywall: `paywall_viewed`, `paywall_cta_tapped`, `paywall_plan_selected`, `checkout_started`, `checkout_returned`
- Subscription mgmt: `subscription_cancel_started/reason/completed/failed`, `subscription_reactivate_started/completed/failed`

## North Star

**Weekly Active Creators (WAC)** plus **Episodes Created per Week**. Auditure is a
creator platform, so the leading indicator of health is people making episodes, not
just listening.

| Insight | Type | Definition |
|---|---|---|
| Episodes created / week | Trends, weekly | `episode_created`, total count |
| Weekly Active Creators | Trends, weekly | `episode_created`, unique users |
| Episodes per creator | Formula | `episode_created total / episode_created unique users` |
| Generation success rate | Formula | `episode_generation_completed / (episode_generation_completed + episode_generation_failed)` |

## Section 1: Activation funnel

Funnel insight, 7-day conversion window, ordered steps:
1. `signup`
2. `podcaster_create_succeeded`
3. `episode_create_submitted`
4. `episode_generation_completed`
5. `episode_play_started`

This is the core "new user makes and hears their first episode" journey. Break down
by `$os` (iOS vs Android) once iOS launches.

## Section 2: Generation health (reliability + cost)

- **Success rate over time** - Trends, the formula above, weekly. Target > 90%.
- **Failures by reason** - Trends on `episode_generation_failed`, broken down by `reason`.
  Watch `duration_mismatch` and `content_unavailable` (product/UX problems) vs `error`
  (system problems).
- **Avg episode duration** - Trends on `episode_generation_completed`, property
  `durationSec`, average. Sanity-check against requested length.
- **Voice tier mix** - Trends on `episode_generation_completed`, breakdown by `voiceTier`
  (GEMINI vs STANDARD). GEMINI is the cost driver; track its share.
- **Truncation rate** - `episode_generation_completed` broken down by `truncated`. High
  truncation means users pick too much content.

## Section 3: Engagement

- **Plays / week** - Trends, `episode_play_started`, total and unique users.
- **Completion rate** - Formula `episode_completed / episode_play_started`.
- **Likes & ratings / week** - Trends on `episode_liked` and `episode_rated`.
- **Avg rating** - Trends on `episode_rated`, property `rating`, average.

## Section 4: Monetization

- **Upgrade-intent signal** - Trends on `quota_blocked`, unique users. These are users
  actively wanting more. Break down by `voiceTier`.
- **Paywall funnel** - Funnel: `paywall_viewed` -> `checkout_started` -> `subscription_activated`.
- **Quota -> paywall funnel** - Funnel: `quota_blocked` -> `paywall_viewed` -> `subscription_activated`.
  Measures how well we convert limit-hitters.
- **Cancellations** - Trends on `subscription_cancel_completed`, with `subscription_cancel_reason`
  breakdown.
- Note: RevenueCat owns authoritative MRR/churn/trial dashboards. Use PostHog for the
  behavioral funnel into and out of subscriptions; reconcile revenue numbers in RevenueCat.
  Optionally enable the RevenueCat -> PostHog integration to unify both.

## Section 5: Retention & acquisition

- **Weekly retention** - Retention insight, returning event = `episode_play_started`
  (or `$screen` for general app retention). This replaces the empty default retention tile.
- **Creator retention** - Retention insight on `episode_created`. Do people keep making episodes?
- **New users / week** - Trends on `signup`, weekly.
- **Growth accounting** - rebuild the default tile using `$screen` as the activity event.

## Suggested layout

Row 1: North Star (Episodes/week, WAC, Episodes per creator, Success rate)
Row 2: Activation funnel + Generation health
Row 3: Engagement + Monetization funnels
Row 4: Retention + New users
