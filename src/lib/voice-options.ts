export interface VoiceOption {
  value: string;
  label: string;
  description: string;
}

const DEFAULT_VOICES: VoiceOption[] = [
  { value: 'coral', label: 'Coral', description: 'Warm, friendly narrator with gentle pacing.' },
  {
    value: 'nova',
    label: 'Nova',
    description: 'Energetic storyteller that keeps younger readers hooked.',
  },
  { value: 'onyx', label: 'Onyx', description: 'Deeper cinematic tone suited for dramatic arcs.' },
  {
    value: 'sage',
    label: 'Sage',
    description: 'Balanced, professor-like delivery for calm adventures.',
  },
  {
    value: 'verse',
    label: 'Verse',
    description: 'Lyrical cadence that pairs well with poetic stories.',
  },
];

export function getAvailableVoices(): VoiceOption[] {
  return DEFAULT_VOICES;
}

export function getDefaultVoice(): string {
  return DEFAULT_VOICES[0]?.value ?? 'coral';
}

export function isValidVoice(voice: string): boolean {
  return DEFAULT_VOICES.some((option) => option.value === voice);
}

export function describeVoice(voice: string): VoiceOption | undefined {
  return DEFAULT_VOICES.find((option) => option.value === voice);
}
