# VP Configuration Guide

> Maximum-quality configuration for Virtual Podcasters on Auditure. This guide documents how each personality dimension actually translates into LLM output, what does and doesn't influence the script, and how to configure VPs that read as distinct characters rather than stat-sheet variations of the same generic AI podcast host.

## How the system actually works

A VP has 16 fields in the database. **10 of them flow into the LLM prompt** that generates the script. The rest affect TTS voice selection, app metadata, or are not currently used.

### Fields that affect the SCRIPT (LLM prompt)

| Field | Type | What it does |
|---|---|---|
| `tone` | 1-10 | Calm to Energetic |
| `communicationStyle` | 1-10 | Storytelling to Analytical |
| `humorLevel` | 1-10 | Dry to Comedic |
| `conversationalDepth` | 1-10 | Surface-Level to Deep Thinking |
| `chaosFactor` | 1-10 | Steady to Volatile |
| `sentenceStructure` | 1-10 | Concise to Elaborate |
| `emotionalExpression` | 1-10 | Monotone to Expressive |
| `viewpointBehavior` | 1-10 | Agreeable to Challenging |
| `intellectualAngle` | string | Free-text lens (e.g. "Skeptical") |
| `expertiseTags` | string[] | Knowledge areas, genre-weighted |

### Fields that affect the AUDIO (TTS)

| Field | What it does |
|---|---|
| `voiceModel` | Style category for voice selection |
| `gender` | Filters voice candidates |
| `accent` | Maps to language code (en-US, en-GB, en-AU, en-IN) for Gemini voice |
| `geminiVoiceName` | Stored Gemini voice, computed on save from gender/voiceModel/speed/pitch |
| `speakingSpeed` | Drives WPM target AND biases Gemini voice selection |
| `vocalPitch` | Biases Gemini voice selection (Euclidean distance) and SSML pitch on Google/Edge TTS |

### Fields that are stored but DO NOT flow anywhere

`ageTone`. Setting this does not change LLM output or voice selection. Treat as cosmetic. Wiring it into Gemini voice selection is tracked in [issue #14](https://github.com/ltshikila/Auditure/issues/14).

## The 10-step spectrum

Each 1-10 slider produces a **distinct** LLM instruction at every value. A `tone=7` is similar but not identical to a `tone=8`. A `tone=5` and a `tone=6` differ subtly. The system was rewritten from a 4-bucket lookup to a per-value gradient, so adjacent values shift the personality block by roughly 10%.

The canonical strings live in `prompt_builder.py` (`TONE_MAP`, `COMMUNICATION_MAP`, `HUMOR_MAP`, `DEPTH_MAP`, `CHAOS_MAP`, `SENTENCE_STRUCTURE_MAP`, `EMOTIONAL_EXPRESSION_MAP`, `VIEWPOINT_BEHAVIOR_MAP`). Below are the endpoints and midpoint for each, so you can see the spread.

### TONE (Calm to Energetic)
- **1:** "utterly serene, near-meditative, voice barely above a whisper"
- **5:** "balanced and present, steady conversational energy, neither sleepy nor hyped"
- **10:** "INCANDESCENT: practically vibrating, every sentence near-shouted, runs on pure adrenaline"

### COMMUNICATION STYLE (Storytelling to Analytical)
- **1:** "pure storyteller, everything is a scene with characters and beats, no abstract analysis"
- **5:** "balanced, moves naturally between stories and breakdowns, neither dominates"
- **10:** "pure analytical machine: thesis-evidence-conclusion only, dense logic chains, zero narrative"

### HUMOR (Dry to Comedic)
- **1:** "stone serious, zero jokes, treats everything with gravity"
- **5:** "occasional humor, punctuates serious moments with the odd quip"
- **10:** "FULL stand-up mode: every line is a bit, breaks the other speaker, the book is mostly a prop"

### DEPTH (Surface-Level to Deep Thinking)
- **1:** "TL;DR mode, gives the headline, moves on, never digs"
- **5:** "moderately detailed, explores implications without going down rabbit holes"
- **10:** "BOTTOMLESS: every point spawns three more, 'but wait, there's ANOTHER layer to this', cannot let go"

### CHAOS (Steady to Volatile)
- **1:** "ironclad structure, sticks to the outline, no detours, methodical pacing"
- **5:** "semi-structured with tangents, has a plan but doesn't worship it, follows interest"
- **10:** "UNHINGED: chaotic, goes on rants, picks fights, says things that make the other speaker go 'did you really just say that?!'"

### SENTENCE STRUCTURE (Concise to Elaborate)
- **1:** "machine-gun terse, 3-6 word sentences, fragments allowed, zero filler"
- **5:** "balanced mix of short and medium sentences, some compound structure"
- **10:** "baroquely complex, sprawling sentences, cascading clauses, near-Faulknerian density"

### EMOTIONAL EXPRESSION (Monotone to Expressive)
- **1:** "flat affect, perfectly even register, no emotional coloring at all"
- **5:** "naturally expressive, lets emotion show when warranted, never performative"
- **10:** "OPERATIC: every sentence carries a feeling, gasps, near-tears, near-shouts, full emotional rollercoaster"

### VIEWPOINT BEHAVIOR (Agreeable to Challenging)
- **1:** "fully agreeable, endorses the book's claims as given, no pushback"
- **5:** "balanced, takes claims seriously, raises mild objections where natural"
- **10:** "COMBATIVE: dismantles claims line by line, treats the book as something to be defeated"

### What this means in practice

The combinatorial space across the 8 numeric sliders is 10⁸ ≈ 100M distinct prompt blocks before you add `intellectualAngle` and `expertiseTags`. Two VPs that both sit at exactly 5 across the board still get an identical prompt, but a one-step nudge on any slider changes it. The previous 4-bucket model collapsed `5/6` and `7/8` into the same instruction; that's no longer true.

The new failure mode isn't "same prompt as another mid-bucket VP." It's "all sliders near 5, so the personality block reads as muted across the board." A flat-5 VP still produces a coherent but unmemorable host. Pushing at least 2-3 sliders meaningfully off-center is still the right move; the difference is that off-center now means **anywhere outside 4-6**, not just **9-10 or 1-3**.

## The Signature Dimension Rule

Each VP should have **one dimension pushed to 9-10 or 1-2** that defines its character. This is still the single biggest lever for differentiation, even with the new gradient model. A `humor=8` host is "bit-heavy" but a `humor=10` host enters "full stand-up mode," and the latter is what listeners remember.

Examples of strong signature dimensions:
- `chaosFactor=10` for a chaotic debater (Chaos Theory pattern)
- `tone=1-2` for a genuinely calm guide
- `humorLevel=10` for a comedy-first host
- `conversationalDepth=10` for a deep-thinker explainer
- `communicationStyle=10` for a rapid-fire fact host
- `viewpointBehavior=9-10` for a contrarian / hostile-reviewer host
- `emotionalExpression=10` for a theatrical, emotionally-loud host
- `sentenceStructure=10` for a literary / lyrical host

A VP with all 8 sliders sitting near 5 produces a personality block that reads as muted across the board. The script will be coherent but the host will not have a recognizable shape. This is the single biggest cause of the "all my VPs sound the same" problem, even after the per-value rewrite.

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
- Anything with all 8 sliders parked at 4-6. The personality block reads coherent-but-muted. The two VPs won't be _identical_ anymore (per-value gradient), but neither will be memorable.
- High `humor` (9-10) with `chaos=1-3` and `tone=1-3` works as "deadpan dry wit." But high `humor` with mid-everything-else just produces standard quippy delivery.
- High `viewpointBehavior` (9-10) on a Calm/Agreeable-named VP. Combative-by-default contradicts the framing.
- `emotionalExpression=10` with `tone=1-2`. Operatic delivery on a near-whispering host reads as inconsistent rather than dramatic.

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

1. **No two active VPs should share the same `(geminiVoiceName, accent)` pair.** Voice alone can repeat across VPs as long as the accents differ — the accent layer (en-US, en-GB, en-AU, en-IN) makes the same Gemini voice audibly distinct enough that listeners read them as different hosts. So Charon-US + Charon-UK is fine; Charon-US + Charon-US is not.
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

## intellectualAngle: keep it general on purpose

This is a free-text field passed through to the LLM as `Intellectual lens: {value}`. It frames how the VP analyzes content. The current 5 founder VPs use only 4 distinct angles: Critical, Empirical, Skeptical, Idealistic.

**Keep angles general by design.** A VP has to be able to handle any book a user throws at it. A narrow framing like "Pragmatic technologist" or "Marxist literary critic" works beautifully on books in that lane, but fails when someone runs a Harry Potter episode through the same VP — the prompt would force a tech-pragmatic or class-conflict reading onto fantasy and the script would feel forced.

The current general angles already cover the useful axes:
- **Critical** (interrogates claims, surfaces tensions)
- **Skeptical** (defaults to doubt, demands evidence)
- **Empirical** (anchors in observable facts and outcomes)
- **Idealistic** (anchors in values, possibility, what should be)

Other safe-because-general additions if you want more variety:
- "Curious"
- "Pragmatic"
- "Romantic"
- "Cynical"
- "Reflective"
- "Synthesizing"

The principle: the angle should describe a **stance**, not a **discipline or worldview**. Stances generalize across genres; disciplines don't.

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
**Voice:** Currently Achird-UK. Between The Lines also uses Achird, but on US accent, so the audible difference is fine. If you go calm-route, consider switching to Umbriel (Easy-going) UK for stronger style match; if keeping high-energy, Puck-UK.

### 2. What is What? (India, MALE, Umbriel)
**Current:** tone=3, comm=7, humor=8, depth=10, chaos=3, intellectualAngle=Empirical
**Strengths:** Coherent. Calm + analytical + deep + structured + funny works as "explainer who slips in jokes."
**Recommendations:** Keep. Add more episodes (only 1 currently) to make this a real VP, not a placeholder. Voice (Umbriel) is unique in your roster.

### 3. Tech Talk (US, MALE, Charon)
**Current:** tone=4, comm=5, humor=7, depth=6, chaos=5, no description
**Problem:** All five core sliders cluster near 5. Personality block will read coherent but muted, with no anchor dimension. Also no description, only 1 episode, dormant.
**Fix path A (revive):** Pick a signature dimension. For tech content: `comm=10` (rapid-fire fact host) or `depth=10` (deep technical explainer). Set `sentenceStructure=3-4` (concise, punchy) to reinforce a tech-explainer feel. Add description. Charon-US is fine to keep since Chaos Theory's Charon is on UK accent — different audible voice.
**Fix path B (retire):** Hide from public, focus on the other 4. Better to market 4 sharp VPs than 5 with one dud.

### 4. Chaos Theory (UK, MALE, Charon)
**Current:** tone=8, comm=8, humor=10, depth=9, chaos=10, intellectualAngle=Skeptical
**Strengths:** The strongest VP in your roster. Signature `chaos=10` and `humor=10`, coherent name, clear concept ("only the most chaotic books"), most-played in plays-to-episode ratio.
**Recommendation:** Keep. This is your flagship. Voice (Charon-UK) is fine — Tech Talk's Charon is US accent, so audibly distinct. Optional upgrade for stronger style-match to chaos: switch to Fenrir-UK (Excitable) or Puck-UK (Upbeat).

### 5. Between The Lines (US, MALE, Achird)
**Current:** tone=9, comm=2, humor=10, depth=6, chaos=8, no description
**Strengths:** Coherent storyteller-with-edge profile. Most episodes (25) suggests this is your workhorse VP.
**Problem:** No description.
**Fix:** Add description. Something like "The book lover who sees the subtext you missed. Loud opinions, loose structure, will absolutely roast a bad ending." Voice (Achird-US) is fine — Calm Guide's Achird is UK accent, audibly distinct. intellectualAngle "Idealistic" is well-chosen as a general stance.

## Recommended new VPs to add

Two gaps in the current roster:

### Female VP #1: A literary depth host
- Name: "Margins" or "The Underline" or "Footnote"
- gender: FEMALE, voice: Aoede (Breezy) or Despina (Smooth)
- tone=4, comm=6, humor=4, depth=10, chaos=2
- intellectualAngle: "Reflective" (general — keeps the VP coverage broad across genres)
- expertiseTags: ["Literature", "Philosophy", "Psychology"]
- Description: "What the book is actually saying when you stop and listen."

### Female VP #2: A high-energy critic
- Name: "Hot Take" or "The Reviewer" or "Sharp Edges"
- gender: FEMALE, voice: Zephyr (Bright) or Kore (Firm)
- tone=9, comm=8, humor=8, depth=5, chaos=7, viewpointBehavior=8
- intellectualAngle: "Cynical" (general stance, not a discipline)
- expertiseTags: ["Cultural studies", "Literary criticism"]
- Description: "The first-week review you wish your friend would write. No mercy, no spoilers, no patience for boring books."

These two cover the missing 60% of audiobook audience (female-leaning) and provide audible diversity (different voices, different gender, different intellectual angles).

## Quick reference: the maximum-quality config checklist

For any new VP, before saving, verify:

1. **Name and stats agree.** A "Calm" anything has `tone≤3` and `chaosFactor≤3`. A "Chaos" anything has `chaosFactor≥9`. A "Combative Critic" has `viewpointBehavior≥8`.
2. **One signature dimension at 9-10 or 1-2.** Anchors the character.
3. **At least 3 of 8 sliders meaningfully off-center** (outside 4-6). Otherwise the personality block reads muted, even though the prompt itself is unique.
4. **Unique `(geminiVoiceName, accent)` pair.** Voice can repeat across VPs as long as accents differ.
5. **Description written.** No empty descriptions on public VPs.
6. **intellectualAngle is a general stance, not a discipline.** "Critical," "Skeptical," "Empirical," "Idealistic," "Curious," "Pragmatic" all generalize across any book the user might run. "Marxist literary critic" or "Pragmatic technologist" do not — they break on off-genre books.
7. **expertiseTags match the books you cover most often.** Off-genre expertise gets ignored by the prompt.
8. **For DUO showcase content, prefer MONOLOGUE first.** GUEST archetype dilutes VP identity.
9. **Internal coherence holds.** No "Calm" + high humor/chaos combos. No high-emotionalExpression on a near-whispering host. No high-viewpointBehavior on an Agreeable-named VP.

## Future product work to widen the differentiation surface

These are not configuration fixes; they are prompt-builder improvements that would make VPs genuinely more distinct.

1. **Add VP-specific opener templates.** Currently every VP opens with "Welcome / Alright, buckle up / diving headfirst." Bake the signature dimension into a per-VP opener style: a Calm Guide should NOT use "buckle up."
2. **Translate `viewpointBehavior` into the GUEST archetype generation.** Currently `viewpointBehavior` shapes the HOST's stance toward the book in MONOLOGUE and DUO scripts. The GUEST archetype generator does not yet read it, so a high-viewpointBehavior HOST does not automatically get a more clashing GUEST. Wire it through `generate_cohost_archetype`.
3. **Wire `ageTone` into Gemini voice selection.** Currently stored but unused. Tracked in [issue #14](https://github.com/ltshikila/Auditure/issues/14).
4. **Map intellectualAngle to specific known frameworks** in the prompt (e.g., "Phenomenological → emphasize lived experience and subjective interpretation").
5. **Add a "verbal tic" field** per VP. A signature phrase or callback that anchors the character. ("...and that's the whole game" or "Now here's where I lose people.")

### Recently shipped

- **Per-value 1-10 mapping for all numeric sliders.** Previously the prompt builder bucketed values into 4 ranges (1-3, 4-6, 7-8, 9-10). Now every value 1-10 produces a distinct LLM instruction with a ~10% gradient between adjacent values. See `prompt_builder.py` `*_MAP` constants.
- **`sentenceStructure`, `emotionalExpression`, `viewpointBehavior` wired into the prompt.** Previously stored-but-ignored; now flow through `build_personality_description` and reach the LLM as "Sentence shape:", "Emotional delivery:", and "Stance toward the book:" lines in the personality block.
