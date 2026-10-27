import { getAvailableVoices, getRecommendedVoice, isValidVoice } from '@/lib/voice-options';

describe('voice-options', () => {
  it('exposes 8 Gemini and 11 OpenAI voices', () => {
    expect(getAvailableVoices('google-genai')).toHaveLength(8);
    expect(getAvailableVoices('openai')).toHaveLength(11);
  });

  it('validates voices per provider', () => {
    expect(isValidVoice('Sulafat', 'google-genai')).toBe(true);
    expect(isValidVoice('coral', 'google-genai')).toBe(false);
    expect(isValidVoice('coral', 'openai')).toBe(true);
  });

  it('recommends voices by audience', () => {
    expect(getRecommendedVoice('google-genai', 'children_0-2')).toBe('Sulafat');
    expect(getRecommendedVoice('google-genai', 'children_7-10')).toBe('Puck');
    expect(getRecommendedVoice('google-genai', 'young_adult_15-17')).toBe('Zephyr');
    expect(getRecommendedVoice('google-genai', 'adult_18+')).toBe('Charon');
    expect(getRecommendedVoice('google-genai', null)).toBe('Sulafat');
    expect(getRecommendedVoice('openai', 'adult_18+')).toBe('coral');
  });
});
