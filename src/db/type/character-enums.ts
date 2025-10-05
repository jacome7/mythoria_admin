// Centralized character enums to maintain consistency across the application
// This is the single source of truth for character types and roles

// Character type is now free-text, but we keep these for age mapping purposes
export const CHARACTER_TYPE_CATEGORIES = {
  human: ['boy', 'girl', 'man', 'woman', 'person'],
  animal: ['dog', 'cat', 'bird', 'other_animal'],
  fantasy: [
    'dragon',
    'elf_fairy_mythical',
    'robot_cyborg',
    'alien_extraterrestrial',
    'other_creature',
  ],
  other: ['other'],
} as const;

// Flat array of all character types for GenAI schema
export const CHARACTER_TYPES = [
  // Human types
  'boy',
  'girl',
  'man',
  'woman',
  'person',
  // Animal types
  'dog',
  'cat',
  'bird',
  'other_animal',
  // Fantasy types
  'dragon',
  'elf_fairy_mythical',
  'robot_cyborg',
  'alien_extraterrestrial',
  'other_creature',
  // Other
  'other',
] as const;

export const CHARACTER_ROLES = [
  'protagonist',
  'antagonist',
  'supporting',
  'mentor',
  'comic_relief',
  'love_interest',
  'sidekick',
  'narrator',
  'other',
] as const;

// Character ages - combined enum for both human and non-human characters
export const CHARACTER_AGES = [
  // Human ages
  'infant',
  'toddler',
  'preschool',
  'school_age',
  'teenage',
  'emerging_adult',
  'seasoned_adult',
  'midlife_mentor',
  'elder',
  // Non-human ages
  'youngling',
  'adult',
  'senior',
] as const;

// Character traits organized by category
export const CHARACTER_TRAITS = [
  // Positive traits
  'adaptable',
  'brave',
  'compassionate',
  'courageous',
  'curious',
  'decisive',
  'empathetic',
  'generous',
  'honest',
  'imaginative',
  'loyal',
  'optimistic',
  'patient',
  'practical',
  'pragmatic',
  'resourceful',
  'self-disciplined',
  'sincere',
  'witty',
  'kind',
  'conscientious',
  'energetic',
  // Negative traits
  'arrogant',
  'callous',
  'cowardly',
  'cynical',
  'deceitful',
  'impulsive',
  'jealous',
  'lazy',
  'manipulative',
  'moody',
  'reckless',
  'selfish',
  'vengeful',
  // Neutral/complex traits
  'aloof',
  'blunt',
  'cautious',
  'methodical',
] as const;

// Trait categories for UI organization
export const POSITIVE_TRAITS: CharacterTrait[] = [
  'adaptable',
  'brave',
  'compassionate',
  'courageous',
  'curious',
  'decisive',
  'empathetic',
  'generous',
  'honest',
  'imaginative',
  'loyal',
  'optimistic',
  'patient',
  'practical',
  'pragmatic',
  'resourceful',
  'self-disciplined',
  'sincere',
  'witty',
  'kind',
  'conscientious',
  'energetic',
];

export const NEGATIVE_TRAITS: CharacterTrait[] = [
  'arrogant',
  'callous',
  'cowardly',
  'cynical',
  'deceitful',
  'impulsive',
  'jealous',
  'lazy',
  'manipulative',
  'moody',
  'reckless',
  'selfish',
  'vengeful',
];

export const NEUTRAL_TRAITS: CharacterTrait[] = ['aloof', 'blunt', 'cautious', 'methodical'];

// Trait descriptions for UI tooltips
export const CHARACTER_TRAIT_DESCRIPTIONS: Record<CharacterTrait, string> = {
  // Positive traits
  adaptable: 'Adjusts easily to new situations.',
  brave: 'Faces challenges without fear.',
  compassionate: 'Feels deep empathy and care for others.',
  courageous: 'Shows bravery in the face of danger or difficulty.',
  curious: 'Seeks out knowledge and new experiences.',
  decisive: 'Makes choices quickly and confidently.',
  empathetic: "Understands and shares others' emotions.",
  generous: 'Willingly gives time or resources.',
  honest: 'Values truthfulness and integrity.',
  imaginative: 'Creates vivid, original ideas.',
  loyal: 'Stands by others through thick and thin.',
  optimistic: 'Maintains a hopeful outlook.',
  patient: 'Waits calmly and endures delays.',
  practical: 'Focused on realistic, workable solutions.',
  pragmatic: 'Takes a practical approach to problems and situations.',
  resourceful: 'Cleverly overcomes obstacles.',
  'self-disciplined': 'Controls impulses and stays focused.',
  sincere: 'Speaks and acts with genuine intention.',
  witty: 'Uses humor in a clever way.',
  kind: 'Acts with warmth and friendliness.',
  conscientious: 'Organized, responsible, and diligent.',
  energetic: 'Brings energy and enthusiasm to life.',
  // Negative traits
  arrogant: 'Overestimates self-worth and belittles others.',
  callous: 'Shows a lack of sensitivity or concern.',
  cowardly: 'Avoids danger or responsibility.',
  cynical: "Distrusts people's motives.",
  deceitful: 'Often lies or misleads others.',
  impulsive: 'Acts without considering consequences.',
  jealous: "Resents another's success or possessions.",
  lazy: 'Avoids effort or hard work.',
  manipulative: 'Influences others for personal gain.',
  moody: 'Has frequent emotional ups and downs.',
  reckless: 'Disregards caution or safety.',
  selfish: "Prioritizes own needs above others'.",
  vengeful: 'Holds grudges and seeks revenge.',
  // Neutral/complex traits
  aloof: 'Keeps an emotional distance from others.',
  blunt: 'Speaks in a direct, even harsh, manner.',
  cautious: 'Avoids risk and thinks things through.',
  methodical: 'Approaches tasks systematically.',
};

// TypeScript types derived from the arrays
export type CharacterType = string; // Now allows any string for extensibility
export type CharacterRole = (typeof CHARACTER_ROLES)[number];
export type CharacterAge = (typeof CHARACTER_AGES)[number];
export type CharacterTrait = (typeof CHARACTER_TRAITS)[number];

// Helper arrays for type classification
export const HUMAN_CHARACTER_TYPES = ['boy', 'girl', 'man', 'woman', 'person'];
export const NON_HUMAN_CHARACTER_TYPES = [
  'dog',
  'cat',
  'bird',
  'other_animal',
  'dragon',
  'elf_fairy_mythical',
  'robot_cyborg',
  'alien_extraterrestrial',
  'other_creature',
  'other',
];

// Human age options
export const HUMAN_AGES: CharacterAge[] = [
  'infant',
  'toddler',
  'preschool',
  'school_age',
  'teenage',
  'emerging_adult',
  'seasoned_adult',
  'midlife_mentor',
  'elder',
];

// Non-human age options
export const NON_HUMAN_AGES: CharacterAge[] = ['youngling', 'adult', 'senior'];

// Validation functions
export function isHumanCharacterType(type: string): boolean {
  return HUMAN_CHARACTER_TYPES.includes(type.toLowerCase());
}

export function isNonHumanCharacterType(type: string): boolean {
  return NON_HUMAN_CHARACTER_TYPES.includes(type.toLowerCase());
}

export function isValidCharacterRole(role: string): role is CharacterRole {
  return CHARACTER_ROLES.includes(role as CharacterRole);
}

export function isValidCharacterAge(age: string): age is CharacterAge {
  return CHARACTER_AGES.includes(age as CharacterAge);
}

export function isValidCharacterTrait(trait: string): trait is CharacterTrait {
  return CHARACTER_TRAITS.includes(trait as CharacterTrait);
}

// Character type normalization function
export function normalizeCharacterType(inputType: string | undefined): string {
  if (!inputType) return 'other';

  const trimmedType = inputType.trim().toLowerCase();

  // Legacy mapping for existing data
  const typeMap: Record<string, string> = {
    boy: 'boy',
    girl: 'girl',
    man: 'man',
    woman: 'woman',
    person: 'person',
    baby: 'boy', // Map legacy Baby to boy
    other: 'other',

    // Keep the rest of the mapping as is but convert to lowercase
    dog: 'dog',
    cat: 'cat',
    bird: 'bird',
    dragon: 'dragon',
    elf: 'elf_fairy_mythical',
    fairy: 'elf_fairy_mythical',
    robot: 'robot_cyborg',
    alien: 'alien_extraterrestrial',
    animal: 'other_animal',
    creature: 'other_creature',
  };

  const normalizedType = typeMap[trimmedType];
  if (normalizedType) {
    return normalizedType;
  }

  // If no match found, return the input as-is (allows free text)
  return inputType;
}

// Get appropriate age options based on character type
export function getAgeOptionsForCharacterType(type: CharacterType): CharacterAge[] {
  return isHumanCharacterType(type) ? HUMAN_AGES : NON_HUMAN_AGES;
}

// Helper functions for UI options - now deprecated, using GroupedCharacterTypeSelect instead
export function getCharacterTypeOptions() {
  // Return empty array since we're now using the grouped select
  return [];
}

export function getCharacterRoleOptions(t: (key: string) => string) {
  return CHARACTER_ROLES.map((role) => ({
    value: role,
    label: t(`roles.${role}`),
  }));
}

export function getCharacterAgeOptions(t: (key: string) => string, characterType?: CharacterType) {
  const ageOptions = characterType ? getAgeOptionsForCharacterType(characterType) : CHARACTER_AGES;
  return ageOptions.map((age) => ({
    value: age,
    label: t(`ages.${age}`),
    description: t(`ages.${age}_description`),
  }));
}

export function getCharacterTraitOptions(
  searchTerm: string = '',
  t?: (key: string) => string,
): {
  positive: Array<{ value: CharacterTrait; label: string; description: string }>;
  negative: Array<{ value: CharacterTrait; label: string; description: string }>;
  neutral: Array<{ value: CharacterTrait; label: string; description: string }>;
} {
  const normalizedSearch = searchTerm.toLowerCase();

  const getTraitLabel = (trait: CharacterTrait): string => {
    if (t) {
      const traitKey = `traits.${trait}`;
      const translated = t(traitKey);
      // If no translation found, fall back to formatted version
      if (translated === traitKey) {
        return trait.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      }
      return translated;
    }
    return trait.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const filterTraits = (traits: CharacterTrait[]) =>
    traits
      .filter((trait) => {
        const label = getTraitLabel(trait);
        const description = CHARACTER_TRAIT_DESCRIPTIONS[trait];
        return (
          trait.includes(normalizedSearch) ||
          label.toLowerCase().includes(normalizedSearch) ||
          description.toLowerCase().includes(normalizedSearch)
        );
      })
      .map((trait) => ({
        value: trait,
        label: getTraitLabel(trait),
        description: CHARACTER_TRAIT_DESCRIPTIONS[trait],
      }));

  return {
    positive: filterTraits(POSITIVE_TRAITS),
    negative: filterTraits(NEGATIVE_TRAITS),
    neutral: filterTraits(NEUTRAL_TRAITS),
  };
}

export function getTraitCategory(trait: CharacterTrait): 'positive' | 'negative' | 'neutral' {
  if (POSITIVE_TRAITS.includes(trait)) return 'positive';
  if (NEGATIVE_TRAITS.includes(trait)) return 'negative';
  return 'neutral';
}
