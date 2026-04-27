# VP Configuration Guide

> Maximum-quality configuration for Virtual Podcasters on Auditure. This guide documents how each personality dimension actually translates into LLM output, what does and doesn't influence the script, and how to configure VPs that read as distinct characters rather than stat-sheet variations of the same generic AI podcast host.

## How the system actually works

A VP has 16 fields in the database, but only **7 of them flow into the LLM prompt** that generates the script. The rest affect TTS voice selection, app metadata, or are not currently used.

### Fields that affect the SCRIPT (LLM prompt)

| Field | Type | What it does |
|---|---|---|
| `tone` | 1-10 | Speaking style energy |
| `communicationStyle` | 1-10 | Storytelling vs analytical |
| `humorLevel` | 1-10 | Serious to relentlessly funny |
| `conversationalDepth` | 1-10 | Surface to obsessively deep |
| `chaosFactor` | 1-10 | Structured to unhinged |
| `intellectualAngle` | string | Free-text lens (e.g. "Skeptical") |
| `expertiseTags` | string[] | Knowledge areas, genre-weighted |

### Fields that affect the AUDIO (TTS)

| Field | What it does |
|---|---|
| `voiceModel` | Style category for voice selection |
| `gender` | Filters voice candidates |
| `accent` | Free-text label (display only in current implementation) |
| `geminiVoiceName` | Direct Gemini voice selection. Wins over the others if set. |
| `speakingSpeed` | Maps to a Gemini voice with that speed rating |
| `vocalPitch` | Influences voice selection |

### Fields that are stored but DO NOT flow into script generation

`ageTone`, `sentenceStructure`, `emotionalExpression`, `viewpointBehavior`. Setting these does not change LLM output. Treat them as cosmetic until the prompt builder is extended to consume them.

## The 4-bucket reality

This is the most important thing to understand. The five 1-10 sliders are not continuous. The prompt builder maps them into **4 buckets** each. A `tone=7` and a `tone=8` produce identical LLM instructions. A `tone=4`, `tone=5`, and `tone=6` are also identical.

The buckets, taken directly from `prompt_builder.py`:

### TONE (speaking style)
- **1-3:** "calm, measured, and thoughtful"
- **4-6:** "balanced and conversational"
- **7-8:** "energetic, enthusiastic, and dynamic"
- **9-10:** "ELECTRIC, bursting with energy, infectious excitement, voice dripping with passion, practically jumping out of their seat"

### COMMUNICATION STYLE
- **1-3:** "storytelling and narrative-focused"
- **4-6:** "balanced between stories and analysis"
- **7-8:** "analytical and fact-driven"
- **9-10:** "rapid-fire analysis, rattles off facts, connects dots at lightning speed, builds argument chains like a courtroom lawyer on espresso"

### HUMOR
- **1-3:** "serious and professional"
- **4-6:** "occasional light humor"
- **7-8:** "comedic and entertaining"
- **9-10:** "relentlessly funny, roasts everything, drops one-liners constantly, turns serious points into comedy bits, makes the other speaker crack up"

### DEPTH
- **1-3:** "accessible and surface-level"
- **4-6:** "moderately detailed"
- **7-8:** "deep philosophical exploration"
- **9-10:** "obsessively deep, goes down rabbit holes, pulls in obscure references, won't let a single point go unexamined"

### CHAOS
- **1-3:** "structured and organized"
- **4-6:** "semi-structured with tangents"
- **7-8:** "spontaneous and free-flowing"
- **9-10:** "UNHINGED, chaotic, provocative, wildly unpredictable, goes on rants, picks fights, says things that make the other speaker go 'did you really just say that?!'"

### What this means in practice

The total prompt-visible combination space is 4 × 4 × 4 × 4 × 4 = **1024 unique configurations**. But two VPs that both sit in the middle bucket on every dimension produce the SAME prompt. To make a VP sound distinct, push at least 2-3 dimensions out of the middle into the extremes.

## The Signature Dimension Rule

Each VP should have **one dimension pushed to 9-10 or 1-3** that defines its character. This is the single biggest lever for differentiation.

Examples of strong signature dimensions:
- `chaos=10` for a chaotic debater (Chaos Theory pattern)
- `tone=1-3` for a genuinely calm guide
- `humor=10` for a comedy-first host
- `depth=10` for a deep-thinker explainer
- `communicationStyle=10` for a rapid-fire fact host

A VP with all 5 dimensions in the middle bucket (4-6) gets the LLM's default "podcast host" voice and is functionally indistinguishable from any other middle-bucket VP. This is the single biggest cause of the "all my VPs sound the same" problem.

## The Internal Coherence Rules

Some combinations break because the LLM gets contradictory instructions and defaults to its "average podcast host" baseline.

### Coherent combinations

| Concept | tone | comm | humor | depth | chaos | Notes |
|---|---|---|---|---|---|---|
| The Calm Guide (true) | 1-3 | 4-6 | 1-3 | 7-8 | 1-3 | Genuinely calm, thoughtful |
| The Chaos Agent | 9-10 | 1-3 | 9-10 | 4-6 | 9-10 | Pure unhinged energy |
| The Lecturer | 4-6 | 9-10 | 1-3 | 9-10 | 1-3 | Rapid-fire, factual, structured |
| The Storyteller | 7-8 | 1-3 | 4-6 | 4-6 | 4-6 | Narrative-driven, energetic |
| The Dry Wit | 1-3 | 7-8 | 9-10 | 7-8 | 1-3 | Calm delivery, devastating jokes, deep |
| The Excitable Friend | 9-10 | 1-3 | 7-8 | 1-3 | 7-8 | Fun, surface, all over the place |

### Incoherent combinations to avoid

- Calm Guide named VP with `humor=9, chaos=8` (current bug). The script will read as energetic regardless of the name.
- Anything with all 5 dimensions in 4-6. Generates the LLM default and any two such VPs sound identical.
- High `humor` (9-10) with `chaos=1-3` and `tone=1-3` works as "deadpan dry wit." But high `humor` with mid-everything-else just produces standard quippy delivery.

## Voice configuration

### Available Gemini voices

**Female (currently underused, 0 of 5 founder VPs):**

| Voice | Style | Speed | Pitch |
|---|---|---|---|
| Zephyr | Bright | 6 | 8 |
| Kore | Firm | 5 | 5 |
| Aoede | Breezy | 6 | 7 |
| Callirrhoe | Easy-going | 4 | 5 |
| Despina | Smooth | 4 | 5 |

**Male:**

| Voice | Style | Speed | Pitch |
|---|---|---|---|
| Puck | Upbeat | 7 | 7 |
| Charon | Informative | 5 | 3 |
| Fenrir | Excitable | 8 | 6 |
| Iapetus | Clear | 5 | 5 |
| Umbriel | Easy-going | 4 | 5 |
| Algenib | Gravelly | 4 | 2 |
| Achird | Friendly | 6 | 6 |

### Voice selection rules

1. **No two of your active VPs should share a Gemini voice.** Audible duplication kills the "5 distinct hosts" pitch even if scripts differ. Currently Charon is used twice (Chaos Theory + Tech Talk) and Achird is used twice (Calm Guide + Between The Lines). Fix.
2. **Match voice style to personality signature.** A high-chaos host wants Fenrir (Excitable) or Puck (Upbeat). A calm host wants Umbriel (Easy-going) or Algenib (Gravelly). A dry-wit host wants Charon (Informative).
3. **Set `geminiVoiceName` directly when possible.** It overrides the speed/pitch/voiceModel matching logic and gives you exact control. The other voice fields become hints only.
4. **Pitch ≠ pitch slider.** Vocal pitch is a Gemini voice property, not a runtime dial. Choose the voice with the pitch you want.

## DUO mode considerations

DUO episodes pair the VP (HOST) with an auto-generated GUEST archetype. The GUEST is built to **contrast** the HOST:

- HOST `tone≥7` (energetic) gets a calmer, more measured GUEST
- HOST `tone≤3` (calm) gets a more animated GUEST
- DEBATE theme gets a critical/contrarian GUEST regardless of tone
- LECTURE theme gets a curious-learner GUEST
- DISCUSSION theme gets a reflective-thinker or warm-builder GUEST

Implications:
- A VP played in DUO mode is functionally always a DUO. The "VP voice" the listener hears is half HOST, half auto-GUEST.
- For VP-as-talent marketing, prefer **MONOLOGUE** episodes when showcasing a single VP's distinct voice. The GUEST dilutes character identity.
- DUO is great for variety on the platform, but use it where contrast helps the format, not as the default.

## intellectualAngle: the underused lever

This is a free-text field passed through to the LLM as `Intellectual lens: {value}`. It frames how the VP analyzes content. The current 5 founder VPs use only 4 distinct angles: Critical, Empirical, Skeptical, Idealistic.

Better candidate values for differentiation:
- "Skeptical materialist"
- "Romantic idealist"
- "Pragmatic technologist"
- "Phenomenological"
- "Marxist literary critic"
- "Cynical realist"
- "Stoic"
- "Mythic / Jungian"
- "Sociological"
- "Behavioral economist"
- "Existentialist"

A specific angle ("phenomenological," "cynical realist") flows through to the script much harder than a generic one ("Critical").

## expertiseTags: how genre weighting works

The prompt builder weights `expertiseTags` against the book's genre. If they overlap, the VP leans into them. If they don't, the VP is told to leave them out. So picking expertise that matches the books you cover most amplifies VP voice; picking expertise that misses your common content does nothing.

For a book-Twitter-adjacent podcast covering mostly fiction, philosophy, and self-help, useful expertise tags:
- Literary criticism
- Cultural studies
- Philosophy
- Psychology (esp. for character analysis)
- History (esp. for adaptation context)
- Politics (for genre fiction with political subtext)

Avoid: "Business," "Finance," "Science" unless the VP is dedicated to that vertical. They tag as low-overlap on most books and add nothing.

## Per-VP audit and fixes

### 1. The Calm Guide (UK, MALE, Achird)
**Current:** tone=4, chaos=8, humor=9, depth=8, comm=3
**Problem:** Name promises calm, stats produce energetic chaos. Internal contradiction.
**Fix:** Decide which of two paths.
- **Keep the name, fix the stats:** tone=2, chaos=2, humor=3, depth=8, comm=4. True calm-guide voice.
- **Keep the stats, change the name:** Rename to something like "Late-Night Tangent" or "The Wide-Awake." High-energy ramble VP.
**Voice:** Currently Achird, also used by Between The Lines. Switch to Umbriel (Easy-going) if going calm route, or Puck if keeping high-energy.

### 2. What is What? (India, MALE, Umbriel)
**Current:** tone=3, comm=7, humor=8, depth=10, chaos=3, intellectualAngle=Empirical
**Strengths:** Coherent. Calm + analytical + deep + structured + funny works as "explainer who slips in jokes."
**Recommendations:** Keep. Add more episodes (only 1 currently) to make this a real VP, not a placeholder. Voice (Umbriel) is unique in your roster.

### 3. Tech Talk (US, MALE, Charon)
**Current:** tone=4, comm=5, humor=7, depth=6, chaos=5, no description
**Problem:** All five sliders sit in middle buckets. Will produce LLM default voice, indistinguishable from any other mid-bucket VP. Also no description, only 1 episode, dormant.
**Fix path A (revive):** Pick a signature dimension. For tech content: `comm=10` (rapid-fire fact host) or `depth=10` (deep technical explainer). Add description. Switch off Charon (already used by Chaos Theory).
**Fix path B (retire):** Hide from public, focus on the other 4. Better to market 4 sharp VPs than 5 with one dud.

### 4. Chaos Theory (UK, MALE, Charon)
**Current:** tone=8, comm=8, humor=10, depth=9, chaos=10, intellectualAngle=Skeptical
**Strengths:** The strongest VP in your roster. Signature `chaos=10` and `humor=10`, coherent name, clear concept ("only the most chaotic books"), most-played in plays-to-episode ratio.
**Recommendation:** Keep. This is your flagship. Voice: switch from Charon (shared with Tech Talk) to Fenrir (Excitable) or Puck (Upbeat) for audible match to chaos.

### 5. Between The Lines (US, MALE, Achird)
**Current:** tone=9, comm=2, humor=10, depth=6, chaos=8, no description
**Strengths:** Coherent storyteller-with-edge profile. Most episodes (25) suggests this is your workhorse VP.
**Problem:** No description. Voice (Achird) shared with Calm Guide.
**Fix:** Add description. Something like "The book lover who sees the subtext you missed. Loud opinions, loose structure, will absolutely roast a bad ending." Switch voice to Iapetus (Clear) or Puck (Upbeat). intellectualAngle "Idealistic" is fine but consider "Romantic idealist" or "Mythic" for sharper flavor.

## Recommended new VPs to add

Two gaps in the current roster:

### Female VP #1: A literary depth host
- Name: "Margins" or "The Underline" or "Footnote"
- gender: FEMALE, voice: Aoede (Breezy) or Despina (Smooth)
- tone=4, comm=6, humor=4, depth=10, chaos=2, comm=4
- intellectualAngle: "Phenomenological" or "Romantic idealist"
- expertiseTags: ["Literature", "Philosophy", "Psychology"]
- Description: "What the book is actually saying when you stop and listen."

### Female VP #2: A high-energy critic
- Name: "Hot Take" or "The Reviewer" or "Sharp Edges"
- gender: FEMALE, voice: Zephyr (Bright) or Kore (Firm)
- tone=9, comm=8, humor=8, depth=5, chaos=7
- intellectualAngle: "Cynical realist"
- expertiseTags: ["Cultural studies", "Literary criticism"]
- Description: "The first-week review you wish your friend would write. No mercy, no spoilers, no patience for boring books."

These two cover the missing 60% of audiobook audience (female-leaning) and provide audible diversity (different voices, different gender, different intellectual angles).

## Quick reference: the maximum-quality config checklist

For any new VP, before saving, verify:

1. **Name and stats agree.** A "Calm" anything has tone≤3 and chaos≤3. A "Chaos" anything has chaos≥9.
2. **One signature dimension at 9-10 or 1-3.** No all-mid-bucket VPs.
3. **At least 3 of 5 sliders out of middle bucket (4-6).** Otherwise the VP collapses to LLM default.
4. **Voice not shared with another active VP.** Pick a unique Gemini voice.
5. **Description written.** No empty descriptions on public VPs.
6. **intellectualAngle is specific** (not "Critical" or "Skeptical" alone). Add a qualifier.
7. **expertiseTags match the books you cover most often.** Off-genre expertise gets ignored by the prompt.
8. **For DUO showcase content, prefer MONOLOGUE first.** GUEST archetype dilutes VP identity.
9. **Internal coherence holds.** No "Calm" + high humor/chaos combos.

## Future product work to widen the differentiation surface

These are not configuration fixes; they are prompt-builder improvements that would make VPs genuinely more distinct.

1. **Add VP-specific opener templates.** Currently every VP opens with "Welcome / Alright, buckle up / diving headfirst." Bake the signature dimension into a per-VP opener style: a Calm Guide should NOT use "buckle up."
2. **Translate `sentenceStructure` and `emotionalExpression` into prompt instructions.** Currently stored, currently ignored.
3. **Translate `viewpointBehavior` into the GUEST archetype generation.** A high-viewpoint VP should clash harder with the GUEST.
4. **Map intellectualAngle to specific known frameworks** in the prompt (e.g., "Phenomenological → emphasize lived experience and subjective interpretation").
5. **Add a "verbal tic" field** per VP. A signature phrase or callback that anchors the character. ("...and that's the whole game" or "Now here's where I lose people.")
