import {
  DEPRECATED_CHARACTER_TRAITS,
  getCharacterTraitOptions,
  getTraitCategory,
  isValidCharacterTrait,
} from './character-enums';

const t = (key: string) => key;

describe('character trait options', () => {
  it('keeps deprecated traits valid for existing characters without offering them as selectable options', () => {
    const options = getCharacterTraitOptions('', t);
    const selectableTraits = [
      ...options.positive.map((trait) => trait.value),
      ...options.negative.map((trait) => trait.value),
      ...options.neutral.map((trait) => trait.value),
    ];

    for (const trait of DEPRECATED_CHARACTER_TRAITS) {
      expect(isValidCharacterTrait(trait)).toBe(true);
      expect(selectableTraits).not.toContain(trait);
    }
  });

  it('preserves original categories for deprecated traits', () => {
    expect(getTraitCategory('courageous')).toBe('positive');
    expect(getTraitCategory('callous')).toBe('negative');
    expect(getTraitCategory('methodical')).toBe('neutral');
  });
});
