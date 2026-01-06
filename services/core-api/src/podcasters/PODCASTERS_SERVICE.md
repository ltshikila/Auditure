# Podcasters/Studio Service Implementation

## Overview
The Podcasters service (also known as the Studio service) is the foundation for podcast generation in Narratica. It manages virtual podcaster configurations that define how podcast episodes are generated. Each podcaster has a unique personality, voice, and intellectual approach that influences all episodes created with it.

## Database Schema

### Podcaster Model
Located in `prisma/schema.prisma`

```prisma
model Podcaster {
  id                      String    @id @default(uuid())
  userId                  String

  // Core Identity
  name                    String
  description             String?
  profilePictureUrl       String?

  // Voice Configuration (values 1-10)
  voiceModel              VoiceModel
  gender                  Gender
  accent                  String
  speakingSpeed           Int       @default(5)
  vocalPitch              Int       @default(5)
  ageTone                 Int       @default(5)
  sentenceStructure       Int       @default(5)    // Concise to Elaborate
  emotionalExpression     Int       @default(5)    // Monotone to Expressive

  // Core Personality Model (values 1-10)
  tone                    Int       @default(5)    // Calm to Energetic
  communicationStyle      Int       @default(5)    // Storytelling to Analytical
  humorLevel              Int       @default(5)    // Dry to Comedic
  conversationalDepth     Int       @default(5)    // Surface-Level to Deep Thinking
  chaosFactor             Int       @default(5)    // Steady to Volatile

  // Knowledge & Worldview
  expertiseTags           String[]               // 1-3 tags
  intellectualAngle       String
  viewpointBehavior       Int       @default(5)  // Agreeable to Challenging

  // Metadata
  isPublic                Boolean   @default(false)
  playCount               Int       @default(0)
  likeCount               Int       @default(0)
  shareCount              Int       @default(0)

  // Timestamps
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  // Relations
  user                    User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Enums
- **VoiceModel**: CUSTOM, CONVERSATIONAL, ENERGETIC, CALM, SARCASTIC, ACADEMIC
- **Gender**: MALE, FEMALE

### Valid Expertise Tags
Philosophy, Psychology, Finance, History, Literature, Politics, Self-help, Science, Business, Art & Culture

### Valid Intellectual Angles
Skeptical, Accepting, Critical, Pragmatic, Idealistic, Empirical

### Supported Accents (9 options)
United States, United Kingdom, Australia, Canada, Ireland, Scotland, India, New Zealand, South Africa

## API Endpoints

### Authentication Required

#### Create Podcaster
```
POST /podcasters
Authorization: Bearer {token}

Body:
{
  "name": "string",
  "description": "string (optional)",
  "profilePictureUrl": "string (optional)",
  "voiceModel": "CUSTOM" | "CONVERSATIONAL" | "ENERGETIC" | "CALM" | "SARCASTIC" | "ACADEMIC",
  "gender": "MALE" | "FEMALE",
  "accent": "string (one of 9 supported accents)",
  "speakingSpeed": 1-10,
  "vocalPitch": 1-10,
  "ageTone": 1-10,
  "sentenceStructure": 1-10,      // Concise to Elaborate
  "emotionalExpression": 1-10,    // Monotone to Expressive
  "tone": 1-10,
  "communicationStyle": 1-10,
  "humorLevel": 1-10,
  "conversationalDepth": 1-10,
  "chaosFactor": 1-10,            // Steady to Volatile
  "expertiseTags": ["Philosophy", "Psychology"],  // 1-3 tags
  "intellectualAngle": "Skeptical",  // One of 6 valid angles
  "viewpointBehavior": 1-10,
  "isPublic": boolean (optional, default: false)
}
```

#### Get My Podcasters
```
GET /podcasters/my
Authorization: Bearer {token}

Returns: Array of user's podcasters (both public and private)
```

#### Update Podcaster
```
PATCH /podcasters/:id
Authorization: Bearer {token}

Body: Partial<CreatePodcasterDto>
```

#### Delete Podcaster
```
DELETE /podcasters/:id
Authorization: Bearer {token}

Returns: 204 No Content
```

#### Like Podcaster
```
POST /podcasters/:id/like
Authorization: Bearer {token}

Returns: 204 No Content
```

#### Unlike Podcaster
```
DELETE /podcasters/:id/like
Authorization: Bearer {token}

Returns: 204 No Content
```

### Public Endpoints

#### Get Public Podcasters (Paginated, Filtered, Sorted)
```
GET /podcasters/public?sortBy=POPULAR&page=1&limit=20&search=philosophy&expertiseTags=Philosophy,History&gender=MALE&voiceModel=CALM

Query Parameters:
- sortBy: RECENT (default) | POPULAR | MOST_LIKED
- page: number (default: 1)
- limit: number (default: 20)
- search: string (searches name and description)
- expertiseTags: comma-separated tags
- gender: MALE | FEMALE
- voiceModel: CUSTOM | CONVERSATIONAL | ENERGETIC | CALM | SARCASTIC | ACADEMIC

Returns:
{
  "podcasters": PodcasterResponseDto[],
  "total": number,
  "page": number,
  "totalPages": number
}
```

#### Get Trending Podcasters
```
GET /podcasters/trending?limit=10

Returns: Array of trending podcasters (most plays in last 30 days)
```

#### Get Podcasters by Expertise
```
GET /podcasters/expertise/:tag?limit=20

Example: /podcasters/expertise/Philosophy?limit=20

Returns: Array of podcasters with the specified expertise tag
```

#### Get Single Podcaster
```
GET /podcasters/:id

Returns: PodcasterResponseDto
Note: Private podcasters only accessible to owner
```

#### Increment Play Count
```
POST /podcasters/:id/play

Returns: 204 No Content
```

#### Share Podcaster
```
POST /podcasters/:id/share

Returns: 204 No Content
```

## Service Methods

### PodcastersService

#### Core CRUD Operations
- `create(userId, createPodcasterDto)` - Create new podcaster with validation
- `findAllByUser(userId)` - Get all podcasters for a user
- `findOne(id, userId?)` - Get single podcaster (checks permissions)
- `update(id, userId, updatePodcasterDto)` - Update with ownership check
- `remove(id, userId)` - Delete with ownership check

#### Discovery & Feed Integration
- `findPublic(query)` - Paginated, filtered, sorted public podcasters
- `findTrending(limit)` - Most popular in last 30 days
- `findByExpertise(tag, limit)` - Filter by expertise tag

#### Analytics & Engagement
- `incrementPlayCount(id)` - Track plays
- `incrementLikeCount(id)` - Track likes
- `decrementLikeCount(id)` - Handle unlikes
- `incrementShareCount(id)` - Track shares

## Integration Points

### Episode Service
The podcaster configuration influences episode generation:
- Voice characteristics (model, gender, accent, speed, pitch)
- Personality traits (tone, style, humor, depth)
- Intellectual approach (expertise, angle, viewpoint)

When creating an episode, reference the podcaster by ID to apply these settings.

### Feed Service
The feed service can use these endpoints:
- `findTrending()` - For "Trending Podcasters" section
- `findByExpertise(tag)` - For genre-based discovery
- `findPublic(query)` - For search and filters

Example feed queries:
```typescript
// Get trending podcasters for homepage
const trending = await podcastersService.findTrending(10);

// Get philosophy podcasters
const philosophy = await podcastersService.findByExpertise('Philosophy', 20);

// Search with filters
const results = await podcastersService.findPublic({
  search: 'history',
  sortBy: PodcasterSortBy.POPULAR,
  page: 1,
  limit: 20,
});
```

## Validation Rules

### Expertise Tags
- Must be 1-3 tags
- Must be from the valid list
- Validated in both create and update operations

### Slider Values
- All slider values must be integers between 1-10
- Validated using class-validator decorators

### Intellectual Angle
- Must be one of: Skeptical, Accepting, Critical, Pragmatic, Idealistic, Empirical
- Validated in both create and update operations

### Voice Model & Gender
- Must be valid enum values
- Type-safe through TypeScript enums

## File Structure

```
src/podcasters/
├── dto/
│   ├── create-podcaster.dto.ts       # Request DTO with validation
│   ├── update-podcaster.dto.ts       # Partial update DTO
│   ├── podcaster-response.dto.ts     # Response shape
│   └── query-podcasters.dto.ts       # Query parameters for filtering
├── podcasters.controller.ts           # REST endpoints
├── podcasters.service.ts              # Business logic
└── podcasters.module.ts               # Module configuration
```

## Migrations

### Initial Podcasters Table
```
prisma/migrations/20251230000000_add_podcasters_table/migration.sql
```

### Profile Picture Support
```
prisma/migrations/20260101174801_add_profile_picture_to_podcasters/migration.sql
```
- Added `profilePictureUrl` field

### Field Optimization for LLM/TTS
```
prisma/migrations/20260101193039_update_podcaster_fields_and_chaos_factor/migration.sql
```
- Updated VoiceModel enum: REALISTIC → CONVERSATIONAL
- Removed `vocabularyComplexity` (redundant with other fields)
- Added `sentenceStructure` (1-10, Concise to Elaborate)
- Added `emotionalExpression` (1-10, Monotone to Expressive)
- Added `chaosFactor` (1-10, Steady to Volatile)

Apply migrations when the database is running:
```bash
npx prisma migrate deploy
```

Or for development:
```bash
npx prisma migrate dev
```

## Testing

Example requests using the mobile app form data:

```typescript
// Create a podcaster from the mobile form
const podcaster = await fetch('/podcasters', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: "Philosophy Enthusiast",
    description: "A thoughtful podcaster exploring deep philosophical questions",
    profilePictureUrl: "https://example.com/profile.jpg",
    voiceModel: "CALM",
    gender: "MALE",
    accent: "United States",
    speakingSpeed: 5,
    vocalPitch: 5,
    ageTone: 6,
    sentenceStructure: 7,        // More elaborate sentences
    emotionalExpression: 3,      // More monotone/calm
    tone: 4,
    communicationStyle: 6,
    humorLevel: 3,
    conversationalDepth: 8,
    chaosFactor: 2,              // Very steady, controlled
    expertiseTags: ["Philosophy", "History"],
    intellectualAngle: "Skeptical",
    viewpointBehavior: 7,
    isPublic: true,
  }),
});
```

## Voice Model Templates

The mobile app includes smart autofill templates for each voice model. When a user selects a voice model, related fields are automatically populated with appropriate values:

### CONVERSATIONAL
- speakingSpeed: 5, emotionalExpression: 7, tone: 6, humorLevel: 6
- sentenceStructure: 4, communicationStyle: 3, chaosFactor: 6
- **Best for:** Casual, friendly podcast tone with storytelling focus

### ENERGETIC
- speakingSpeed: 8, tone: 9, humorLevel: 7, emotionalExpression: 9
- sentenceStructure: 3, chaosFactor: 8
- **Best for:** High-energy, enthusiastic content with punchy delivery

### CALM
- speakingSpeed: 3, tone: 2, humorLevel: 4, emotionalExpression: 3
- sentenceStructure: 7, chaosFactor: 2
- **Best for:** Measured, thoughtful analysis with elaborate explanations

### SARCASTIC
- speakingSpeed: 6, tone: 6, humorLevel: 9, emotionalExpression: 7
- sentenceStructure: 4, chaosFactor: 7
- **Best for:** Witty commentary with sharp emotional swings

### ACADEMIC
- speakingSpeed: 4, tone: 3, humorLevel: 2, emotionalExpression: 2
- sentenceStructure: 8, communicationStyle: 7, chaosFactor: 1
- **Best for:** Scholarly, analytical content with formal delivery

### CUSTOM
- No autofill - all fields default to 5
- **Best for:** Complete manual control over all personality traits

## Field Reference

### Core Identity (Step 1: 9 fields)
1. **Virtual Podcaster Name** - Display name for the podcaster
2. **Profile Picture** - Optional image URL
3. **Voice Model** - Template that autofills personality traits
4. **Gender** - MALE or FEMALE (affects TTS voice selection)
5. **Accent** - One of 9 supported regional accents
6. **Speaking Speed** (1-10) - Slow ↔ Fast
7. **Vocal Pitch** (1-10) - Low ↔ High
8. **Age Tone** (1-10) - Youthful ↔ Senior
9. **Sentence Structure** (1-10) - Concise ↔ Elaborate (LLM script generation)
10. **Emotional Expression** (1-10) - Monotone ↔ Expressive (TTS prosody)

### Core Personality Model (Step 2: 5 fields)
1. **Tone** (1-10) - Calm ↔ Energetic
2. **Communication Style** (1-10) - Storytelling ↔ Analytical
3. **Humor Level** (1-10) - Dry ↔ Comedic
4. **Conversational Depth** (1-10) - Surface-Level ↔ Deep Thinking
5. **Chaos Factor** (1-10) - Steady ↔ Volatile (emotional intensity/volatility)

### Knowledge & Worldview (Step 3: 3 fields)
1. **Expertise Tags** - Select 1-3 from 10 available tags
2. **Intellectual Angle** - One of 6 approaches (Skeptical, Accepting, Critical, Pragmatic, Idealistic, Empirical)
3. **Viewpoint Behavior** (1-10) - Agreeable ↔ Challenging

**Total: 17 configurable fields**

## Future Enhancements

1. **AI Voice Generation**: Integrate with TTS services using voice configuration
2. **Cloud Storage Integration**: Upload profile pictures to S3/Cloudinary
3. **Collaboration**: Allow sharing and remixing public podcasters
4. **Analytics Dashboard**: Track performance metrics per podcaster
5. **Recommendations**: Suggest podcasters based on user preferences
6. **Voice Samples**: Generate sample clips to preview voice settings
7. **Advanced Templates**: More specialized voice model templates for specific genres
