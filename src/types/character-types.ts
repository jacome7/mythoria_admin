// Character Type Definitions
export interface CharacterTypeGroup {
  label: string;
  key: string;
  options: CharacterTypeOption[];
}

export interface CharacterTypeOption {
  value: string;
  label: string;
}

// Character type groups with snake_case values
export const CHARACTER_TYPE_GROUPS: CharacterTypeGroup[] = [
  {
    label: 'Human',
    key: 'human',
    options: [
      { value: 'boy', label: 'Boy' },
      { value: 'girl', label: 'Girl' },
      { value: 'man', label: 'Man' },
      { value: 'woman', label: 'Woman' },
      { value: 'person', label: 'Person' },
    ],
  },
  {
    label: 'Animals',
    key: 'animals',
    options: [
      { value: 'dog', label: 'Dog' },
      { value: 'cat', label: 'Cat' },
      { value: 'bird', label: 'Bird' },
      { value: 'other_animal', label: 'Other Animal' },
    ],
  },
  {
    label: 'Fantasy',
    key: 'fantasy',
    options: [
      { value: 'dragon', label: 'Dragon' },
      { value: 'elf_fairy_mythical', label: 'Elf / Fairy / Mythical Humanoid' },
      { value: 'robot_cyborg', label: 'Robot / Cyborg' },
      { value: 'alien_extraterrestrial', label: 'Alien / Extraterrestrial' },
      { value: 'other_creature', label: 'Other Creature' },
    ],
  },
  {
    label: 'Other',
    key: 'other',
    options: [{ value: 'other', label: 'Other' }],
  },
];

// Flatten all options for validation and utilities
export const ALL_CHARACTER_TYPE_OPTIONS = CHARACTER_TYPE_GROUPS.flatMap((group) => group.options);

// Get all valid character type values
export const VALID_CHARACTER_TYPES = ALL_CHARACTER_TYPE_OPTIONS.map((option) => option.value);

// Helper function to find group for a given character type
export const findCharacterTypeGroup = (type: string): CharacterTypeGroup | undefined => {
  return CHARACTER_TYPE_GROUPS.find((group) =>
    group.options.some((option) => option.value === type),
  );
};

// Helper function to get display label for a character type
export const getCharacterTypeLabel = (type: string): string => {
  const option = ALL_CHARACTER_TYPE_OPTIONS.find((opt) => opt.value === type);
  return option?.label || type;
};

// Legacy enum mapping for migration purposes
export const LEGACY_CHARACTER_TYPE_MAPPING: Record<string, string> = {
  Boy: 'boy',
  Girl: 'girl',
  Man: 'man',
  Woman: 'woman',
  Baby: 'boy', // Map Baby to boy as requested
  Person: 'person',
  Dog: 'dog',
  Cat: 'cat',
  Bird: 'bird',
  Dragon: 'dragon',
  Elf: 'elf_fairy_mythical',
  Robot: 'robot_cyborg',
  Alien: 'alien_extraterrestrial',
  Other: 'other',
};
