export type TTSProvider = 'openai' | 'google-genai';

export interface VoiceOption {
  value: string;
  label: string;
  description: string;
}

const GEMINI_VOICES: VoiceOption[] = [
  { value: 'Charon', label: 'Charon', description: 'Informative, steady' },
  { value: 'Aoede', label: 'Aoede', description: 'Breezy, light' },
  { value: 'Puck', label: 'Puck', description: 'Upbeat, cheerful' },
  { value: 'Kore', label: 'Kore', description: 'Firm, clear' },
  { value: 'Fenrir', label: 'Fenrir', description: 'Excitable, energetic' },
  { value: 'Orus', label: 'Orus', description: 'Firm, serious' },
  { value: 'Zephyr', label: 'Zephyr', description: 'Bright, positive' },
  { value: 'Sulafat', label: 'Sulafat', description: 'Warm, comforting' },
];

const OPENAI_VOICES: VoiceOption[] = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral, balanced' },
  { value: 'ash', label: 'Ash', description: 'Clear, confident' },
  { value: 'ballad', label: 'Ballad', description: 'Expressive, melodic' },
  { value: 'coral', label: 'Coral', description: 'Warm, friendly' },
  { value: 'echo', label: 'Echo', description: 'Smooth, calm' },
  { value: 'fable', label: 'Fable', description: 'Storyteller, expressive' },
  { value: 'nova', label: 'Nova', description: 'Energetic, bright' },
  { value: 'onyx', label: 'Onyx', description: 'Deep, cinematic' },
  { value: 'sage', label: 'Sage', description: 'Calm, thoughtful' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft, gentle' },
  { value: 'verse', label: 'Verse', description: 'Lyrical, poetic' },
];

const DEFAULT_VOICES: Record<TTSProvider, string> = {
  'google-genai': 'Sulafat',
  openai: 'coral',
};

/**
 * Configured TTS provider. Defaults to google-genai (production). Uses the NEXT_PUBLIC_ name
 * (same as the webapp) so the client component and the server route agree.
 */
export function getTTSProvider(): TTSProvider {
  return process.env.NEXT_PUBLIC_TTS_PROVIDER === 'openai' ? 'openai' : 'google-genai';
}

export function getAvailableVoices(provider?: TTSProvider): VoiceOption[] {
  return (provider ?? getTTSProvider()) === 'openai' ? OPENAI_VOICES : GEMINI_VOICES;
}

export function getDefaultVoice(provider?: TTSProvider): string {
  return DEFAULT_VOICES[provider ?? getTTSProvider()];
}

export function isValidVoice(voice: string, provider?: TTSProvider): boolean {
  return getAvailableVoices(provider).some((option) => option.value === voice);
}

export function describeVoice(voice: string, provider?: TTSProvider): VoiceOption | undefined {
  return getAvailableVoices(provider).find((option) => option.value === voice);
}

/**
 * Recommended voice for a story audience. Mirrors SGW voice-registry `resolveDefaultVoice`
 * and the webapp `getRecommendedVoice`; audience grouping mirrors SGW `extractTargetAge`.
 */
export function getRecommendedVoice(
  provider: TTSProvider = getTTSProvider(),
  targetAudience?: string | null,
): string {
  if (provider === 'openai') return 'coral';
  switch (targetAudience) {
    case 'children_0-2':
      return 'Sulafat'; // toddlers
    case 'children_3-6':
    case 'children_7-10':
    case 'children_11-14':
      return 'Puck'; // children
    case 'young_adult_15-17':
      return 'Zephyr'; // young adults / teens
    case 'adult_18+':
      return 'Charon'; // adults
    case 'all_ages':
    default:
      return 'Sulafat';
  }
}
