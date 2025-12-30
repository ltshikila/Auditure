# Podcasters/Studio Service Implementation

## Overview
The Podcasters service (also known as the Studio service) is the foundation for podcast generation in BookCast. It manages virtual podcaster configurations that define how podcast episodes are generated. Each podcaster has a unique personality, voice, and intellectual approach that influences all episodes created with it.

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

  // Voice Configuration (values 1-10)
  voiceModel              VoiceModel
  gender                  Gender
  accent                  String
  speakingSpeed           Int       @default(5)
  vocalPitch              Int       @default(5)
  vocabularyComplexity    Int       @default(5)
  ageTone                 Int       @default(5)

  // Core Personality Model (values 1-10)
  tone                    Int       @default(5)    // Calm to Energetic
  communicationStyle      Int       @default(5)    // Storytelling to Analytical
  humorLevel              Int       @default(5)    // Dry to Comedic
  conversationalDepth     Int       @default(5)    // Surface-Level to Deep Thinking

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
- **VoiceModel**: CUSTOM, REALISTIC, ENERGETIC, CALM, SARCASTIC, ACADEMIC
- **Gender**: MALE, FEMALE

### Valid Expertise Tags
Philosophy, Psychology, Finance, History, Literature, Politics, Self-help, Science, Business, Art & Culture

### Valid Intellectual Angles
Skeptical, Open-minded, Critical, Accepting, Questioning, Trusting

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
  "voiceModel": "CUSTOM" | "REALISTIC" | "ENERGETIC" | "CALM" | "SARCASTIC" | "ACADEMIC",
  "gender": "MALE" | "FEMALE",
  "accent": "string",
  "speakingSpeed": 1-10,
  "vocalPitch": 1-10,
  "vocabularyComplexity": 1-10,
  "ageTone": 1-10,
  "tone": 1-10,
  "communicationStyle": 1-10,
  "humorLevel": 1-10,
  "conversationalDepth": 1-10,
  "expertiseTags": ["Philosophy", "Psychology"],  // 1-3 tags
  "intellectualAngle": "Skeptical",
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
- voiceModel: CUSTOM | REALISTIC | etc.

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
- Must be one of: Skeptical, Open-minded, Critical, Accepting, Questioning, Trusting
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

## Migration

The migration file is ready at:
```
prisma/migrations/20251230000000_add_podcasters_table/migration.sql
```

Apply it when the database is running:
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
    voiceModel: "CALM",
    gender: "MALE",
    accent: "United States",
    speakingSpeed: 5,
    vocalPitch: 5,
    vocabularyComplexity: 7,
    ageTone: 6,
    tone: 4,
    communicationStyle: 6,
    humorLevel: 3,
    conversationalDepth: 8,
    expertiseTags: ["Philosophy", "History"],
    intellectualAngle: "Skeptical",
    viewpointBehavior: 7,
    isPublic: true,
  }),
});
```

## Future Enhancements

1. **AI Voice Generation**: Integrate with TTS services using voice configuration
2. **Podcaster Templates**: Pre-configured podcasters for quick start
3. **Collaboration**: Allow sharing and remixing public podcasters
4. **Analytics Dashboard**: Track performance metrics per podcaster
5. **Recommendations**: Suggest podcasters based on user preferences
6. **Voice Samples**: Generate sample clips to preview voice settings
