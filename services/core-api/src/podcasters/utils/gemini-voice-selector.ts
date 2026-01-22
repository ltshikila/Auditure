/**
 * Gemini TTS Voice Selector
 *
 * Maps podcaster voice settings to a specific Gemini voice name.
 * This utility computes and returns a deterministic voice selection
 * based on gender, speaking speed, vocal pitch, and voice model.
 *
 * The voice is computed once on podcaster creation/update and stored
 * in the database for consistent TTS generation.
 */

export interface GeminiVoiceInfo {
  gender: 'MALE' | 'FEMALE';
  style: string;
  speed: number; // 1-10
  pitch: number; // 1-10
}

/**
 * Complete list of 30 Gemini TTS voices with characteristics.
 * Reference: https://ai.google.dev/gemini-api/docs/speech-generation
 *
 * Each voice is mapped with perceived speed, pitch, and gender
 * to match frontend podcaster settings (1-10 scale).
 */
export const GEMINI_VOICES: Record<string, GeminiVoiceInfo> = {
  // FEMALE voices
  Zephyr: { gender: 'FEMALE', style: 'Bright', speed: 6, pitch: 8 },
  Kore: { gender: 'FEMALE', style: 'Firm', speed: 5, pitch: 5 },
  Aoede: { gender: 'FEMALE', style: 'Breezy', speed: 6, pitch: 7 },
  Leda: { gender: 'FEMALE', style: 'Youthful', speed: 5, pitch: 9 },
  Callirrhoe: { gender: 'FEMALE', style: 'Easy-going', speed: 4, pitch: 5 },
  Autonoe: { gender: 'FEMALE', style: 'Bright', speed: 6, pitch: 8 },
  Despina: { gender: 'FEMALE', style: 'Smooth', speed: 4, pitch: 5 },
  Erinome: { gender: 'FEMALE', style: 'Clear', speed: 5, pitch: 6 },
  Laomedeia: { gender: 'FEMALE', style: 'Upbeat', speed: 7, pitch: 7 },
  Achernar: { gender: 'FEMALE', style: 'Soft', speed: 2, pitch: 4 },
  Gacrux: { gender: 'FEMALE', style: 'Mature', speed: 4, pitch: 2 },
  Pulcherrima: { gender: 'FEMALE', style: 'Forward', speed: 6, pitch: 6 },
  Vindemiatrix: { gender: 'FEMALE', style: 'Gentle', speed: 3, pitch: 4 },
  Sulafat: { gender: 'FEMALE', style: 'Warm', speed: 4, pitch: 3 },

  // MALE voices
  Puck: { gender: 'MALE', style: 'Upbeat', speed: 7, pitch: 7 },
  Charon: { gender: 'MALE', style: 'Informative', speed: 5, pitch: 3 },
  Fenrir: { gender: 'MALE', style: 'Excitable', speed: 8, pitch: 6 },
  Orus: { gender: 'MALE', style: 'Firm', speed: 5, pitch: 4 },
  Enceladus: { gender: 'MALE', style: 'Breathy', speed: 4, pitch: 4 },
  Iapetus: { gender: 'MALE', style: 'Clear', speed: 5, pitch: 5 },
  Umbriel: { gender: 'MALE', style: 'Easy-going', speed: 4, pitch: 5 },
  Algieba: { gender: 'MALE', style: 'Smooth', speed: 4, pitch: 5 },
  Algenib: { gender: 'MALE', style: 'Gravelly', speed: 4, pitch: 2 },
  Rasalgethi: { gender: 'MALE', style: 'Informative', speed: 5, pitch: 4 },
  Alnilam: { gender: 'MALE', style: 'Firm', speed: 5, pitch: 4 },
  Schedar: { gender: 'MALE', style: 'Even', speed: 5, pitch: 5 },
  Achird: { gender: 'MALE', style: 'Friendly', speed: 6, pitch: 6 },
  Zubenelgenubi: { gender: 'MALE', style: 'Casual', speed: 5, pitch: 5 },
  Sadachbia: { gender: 'MALE', style: 'Lively', speed: 7, pitch: 6 },
  Sadaltager: { gender: 'MALE', style: 'Knowledgeable', speed: 5, pitch: 4 },
};

/**
 * Voice model to preferred Gemini voice styles mapping.
 * Each voice model maps to a list of preferred styles (in order of preference).
 */
export const VOICE_MODEL_TO_STYLES: Record<string, string[]> = {
  CONVERSATIONAL: ['Easy-going', 'Friendly', 'Casual', 'Warm', 'Breezy'],
  ENERGETIC: ['Bright', 'Upbeat', 'Excitable', 'Lively', 'Forward'],
  CALM: ['Smooth', 'Gentle', 'Soft', 'Even', 'Mature'],
  SARCASTIC: ['Firm', 'Gravelly', 'Clear', 'Forward'],
  ACADEMIC: ['Informative', 'Knowledgeable', 'Clear', 'Firm', 'Even'],
  CUSTOM: [], // No style preference, use speed/pitch only
};

export interface PodcasterVoiceSettings {
  gender: 'MALE' | 'FEMALE';
  voiceModel: string;
  speakingSpeed: number; // 1-10
  vocalPitch: number; // 1-10
}

/**
 * Select the best Gemini voice for the given podcaster settings.
 *
 * Algorithm:
 * 1. Filter voices by gender
 * 2. Get preferred styles for the voice model
 * 3. Calculate score for each voice using:
 *    - Euclidean distance for speed/pitch match
 *    - Style bonus if voice style matches preferred styles
 * 4. Return voice with the lowest score
 *
 * @param settings Podcaster voice settings
 * @returns The Gemini voice name (e.g., "Kore", "Charon")
 */
export function selectGeminiVoice(settings: PodcasterVoiceSettings): string {
  const { gender, voiceModel, speakingSpeed, vocalPitch } = settings;

  // Filter by gender
  let candidates = Object.entries(GEMINI_VOICES).filter(
    ([, info]) => info.gender === gender,
  );

  // If no voices for gender (shouldn't happen), use all voices
  if (candidates.length === 0) {
    candidates = Object.entries(GEMINI_VOICES);
  }

  // Clamp input values to 1-10 range
  const speed = Math.max(1, Math.min(10, speakingSpeed));
  const pitch = Math.max(1, Math.min(10, vocalPitch));

  // Get preferred styles for this voice model
  const preferredStyles =
    VOICE_MODEL_TO_STYLES[voiceModel.toUpperCase()] || [];

  // Calculate score for each voice (lower is better)
  const voiceScore = (voiceInfo: GeminiVoiceInfo): number => {
    // Base: Euclidean distance for speed/pitch
    const speedDiff = Math.abs(voiceInfo.speed - speed);
    const pitchDiff = Math.abs(voiceInfo.pitch - pitch);
    const baseDistance = Math.sqrt(speedDiff ** 2 + pitchDiff ** 2);

    // Style bonus: reduce score if voice style matches preferred styles
    let styleBonus = 0;
    if (preferredStyles.includes(voiceInfo.style)) {
      // Higher bonus for earlier (more preferred) styles
      const styleRank = preferredStyles.indexOf(voiceInfo.style);
      // First preferred style gets -3.0 bonus, decreasing for later styles
      styleBonus = -3.0 + styleRank * 0.5;
    }

    return baseDistance + styleBonus;
  };

  // Find voice with lowest score
  let bestVoice = candidates[0];
  let bestScore = voiceScore(candidates[0][1]);

  for (const [name, info] of candidates) {
    const score = voiceScore(info);
    if (score < bestScore) {
      bestScore = score;
      bestVoice = [name, info];
    }
  }

  return bestVoice[0];
}

/**
 * Get information about a Gemini voice.
 *
 * @param voiceName The Gemini voice name
 * @returns Voice info or undefined if not found
 */
export function getGeminiVoiceInfo(
  voiceName: string,
): GeminiVoiceInfo | undefined {
  return GEMINI_VOICES[voiceName];
}

/**
 * Get all available Gemini voice names.
 *
 * @returns Array of voice names
 */
export function getAvailableVoices(): string[] {
  return Object.keys(GEMINI_VOICES);
}

/**
 * Get voices filtered by gender.
 *
 * @param gender MALE or FEMALE
 * @returns Array of voice names for that gender
 */
export function getVoicesByGender(gender: 'MALE' | 'FEMALE'): string[] {
  return Object.entries(GEMINI_VOICES)
    .filter(([, info]) => info.gender === gender)
    .map(([name]) => name);
}
