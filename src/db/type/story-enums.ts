// Centralized enum definitions for story attributes
// These match the database schema enums and should be used across the application

export enum TargetAudience {
  CHILDREN_0_2 = 'children_0-2',
  CHILDREN_3_6 = 'children_3-6',
  CHILDREN_7_10 = 'children_7-10',
  CHILDREN_11_14 = 'children_11-14',
  YOUNG_ADULT_15_17 = 'young_adult_15-17',
  ADULT_18_PLUS = 'adult_18+',
  ALL_AGES = 'all_ages',
}

export enum NovelStyle {
  ADVENTURE = 'adventure',
  FANTASY = 'fantasy',
  MYSTERY = 'mystery',
  ROMANCE = 'romance',
  SCIENCE_FICTION = 'science_fiction',
  HISTORICAL = 'historical',
  CONTEMPORARY = 'contemporary',
  FAIRY_TALE = 'fairy_tale',
  COMEDY = 'comedy',
  DRAMA = 'drama',
  HORROR = 'horror',
  THRILLER = 'thriller',
  BIOGRAPHY = 'biography',
  EDUCATIONAL = 'educational',
  POETRY = 'poetry',
  SPORTS_ADVENTURE = 'sports_adventure',
}

export enum GraphicalStyle {
  CARTOON = 'cartoon',
  REALISTIC = 'realistic',
  WATERCOLOR = 'watercolor',
  DIGITAL_ART = 'digital_art',
  HAND_DRAWN = 'hand_drawn',
  MINIMALIST = 'minimalist',
  VINTAGE = 'vintage',
  COMIC_BOOK = 'comic_book',
  EURO_COMIC_BOOK = 'euro_comic_book',
  ANIME = 'anime',
  PIXAR_STYLE = 'pixar_style',
  DISNEY_STYLE = 'disney_style',
  SKETCH = 'sketch',
  OIL_PAINTING = 'oil_painting',
  COLORED_PENCIL = 'colored_pencil',
}

export enum LiteraryPersona {
  STORYTELLER = 'storyteller',
  ADVENTUROUS_NARRATOR = 'adventurous-narrator',
  FUN_REPORTER = 'fun-reporter',
  FRIENDLY_EDUCATOR = 'friendly-educator',
  INSTITUTIONAL_CHRONICLER = 'institutional-chronicler',
  PUB_BUDDY_NARRATOR = 'pub-buddy-narrator',
  CLASSIC_NOVELIST = 'classic-novelist',
  NOIR_INVESTIGATOR = 'noir-investigator',
  WHIMSICAL_POET = 'whimsical-poet',
  SCIFI_ANALYST = 'scifi-analyst',
  FOLKLORE_TRADITIONALIST = 'folklore-traditionalist',
}

export type LiteraryPersonaProfile = {
  pov: '1st' | '2nd' | '3rd-limited' | '3rd-omniscient' | 'objective';
  povAlternatives?: Array<'1st' | '2nd' | '3rd-limited' | '3rd-omniscient' | 'objective'>;
  tone: number;
  formality: number;
  rhythm: number;
  vocabulary: number;
  fictionality: number;
  dialogueDensity?: number;
  sensoriality?: number;
  subtextIrony?: number;
  techniques?: string[];
};

export const LiteraryPersonaMetadata: Record<LiteraryPersona, LiteraryPersonaProfile> = {
  [LiteraryPersona.STORYTELLER]: {
    pov: '1st',
    povAlternatives: ['3rd-limited'],
    tone: 2,
    formality: 2,
    rhythm: 2,
    vocabulary: 3,
    fictionality: 3,
    dialogueDensity: 3,
    sensoriality: 4,
    subtextIrony: 2,
    techniques: ['free-indirect-discourse'],
  },
  [LiteraryPersona.ADVENTUROUS_NARRATOR]: {
    pov: '2nd',
    povAlternatives: ['3rd-limited'],
    tone: 4,
    formality: 1,
    rhythm: 5,
    vocabulary: 3,
    fictionality: 5,
    dialogueDensity: 4,
    sensoriality: 4,
    subtextIrony: 3,
    techniques: ['4th-wall-break'],
  },
  [LiteraryPersona.FUN_REPORTER]: {
    pov: 'objective',
    povAlternatives: ['3rd-limited'],
    tone: 4,
    formality: 3,
    rhythm: 4,
    vocabulary: 3,
    fictionality: 2,
    dialogueDensity: 4,
    sensoriality: 3,
    subtextIrony: 4,
    techniques: ['4th-wall-break'],
  },
  [LiteraryPersona.FRIENDLY_EDUCATOR]: {
    pov: '2nd',
    povAlternatives: ['1st'],
    tone: 3,
    formality: 2,
    rhythm: 3,
    vocabulary: 2,
    fictionality: 2,
    dialogueDensity: 3,
    sensoriality: 4,
    subtextIrony: 1,
    techniques: [],
  },
  [LiteraryPersona.INSTITUTIONAL_CHRONICLER]: {
    pov: 'objective',
    povAlternatives: ['3rd-limited'],
    tone: 2,
    formality: 5,
    rhythm: 3,
    vocabulary: 4,
    fictionality: 1,
    dialogueDensity: 1,
    sensoriality: 2,
    subtextIrony: 1,
    techniques: [],
  },
  [LiteraryPersona.PUB_BUDDY_NARRATOR]: {
    pov: '1st',
    povAlternatives: ['3rd-limited'],
    tone: 5,
    formality: 1,
    rhythm: 4,
    vocabulary: 2,
    fictionality: 3,
    dialogueDensity: 5,
    sensoriality: 3,
    subtextIrony: 4,
    techniques: ['unreliable-narrator', '4th-wall-break'],
  },
  [LiteraryPersona.CLASSIC_NOVELIST]: {
    pov: '3rd-limited',
    povAlternatives: ['3rd-omniscient', '1st'],
    tone: 3,
    formality: 3,
    rhythm: 3,
    vocabulary: 3,
    fictionality: 3,
    dialogueDensity: 3,
    sensoriality: 3,
    subtextIrony: 2,
    techniques: ['show-dont-tell', 'free-indirect-discourse', 'scene-anchoring'],
  },
  [LiteraryPersona.NOIR_INVESTIGATOR]: {
    pov: '1st',
    povAlternatives: ['3rd-limited'],
    tone: 1,
    formality: 3,
    rhythm: 4,
    vocabulary: 3,
    fictionality: 4,
    dialogueDensity: 3,
    sensoriality: 5,
    subtextIrony: 5,
    techniques: ['cliffhangers', 'hardboiled-voiceover', 'unreliable-assumptions'],
  },
  [LiteraryPersona.WHIMSICAL_POET]: {
    pov: '3rd-omniscient',
    povAlternatives: ['1st'],
    tone: 5,
    formality: 4,
    rhythm: 1,
    vocabulary: 5,
    fictionality: 3,
    dialogueDensity: 2,
    sensoriality: 5,
    subtextIrony: 1,
    techniques: ['stream-of-consciousness', 'synesthetic-imagery', 'lyrical-refrains'],
  },
  [LiteraryPersona.SCIFI_ANALYST]: {
    pov: '1st',
    povAlternatives: ['objective'],
    tone: 2,
    formality: 4,
    rhythm: 3,
    vocabulary: 4,
    fictionality: 5,
    dialogueDensity: 3,
    sensoriality: 2,
    subtextIrony: 3,
    techniques: ['epistolary', 'systems-thinking', 'status-reports'],
  },
  [LiteraryPersona.FOLKLORE_TRADITIONALIST]: {
    pov: '3rd-omniscient',
    povAlternatives: ['3rd-limited'],
    tone: 3,
    formality: 4,
    rhythm: 2,
    vocabulary: 3,
    fictionality: 5,
    dialogueDensity: 2,
    sensoriality: 3,
    subtextIrony: 1,
    techniques: ['allegory', 'rule-of-three', 'oral-cadence'],
  },
};

// Human-readable labels for UI display
export const TargetAudienceLabels: Record<TargetAudience, string> = {
  [TargetAudience.CHILDREN_0_2]: 'Babies & Toddlers (0-2 years)',
  [TargetAudience.CHILDREN_3_6]: 'Preschoolers (3-6 years)',
  [TargetAudience.CHILDREN_7_10]: 'Early Elementary (7-10 years)',
  [TargetAudience.CHILDREN_11_14]: 'Middle Grade (11-14 years)',
  [TargetAudience.YOUNG_ADULT_15_17]: 'Young Adult (15-17 years)',
  [TargetAudience.ADULT_18_PLUS]: 'Adults (18+ years)',
  [TargetAudience.ALL_AGES]: 'All Ages',
};

export const NovelStyleLabels: Record<NovelStyle, string> = {
  [NovelStyle.ADVENTURE]: 'Adventure',
  [NovelStyle.FANTASY]: 'Fantasy',
  [NovelStyle.MYSTERY]: 'Mystery',
  [NovelStyle.ROMANCE]: 'Romance',
  [NovelStyle.SCIENCE_FICTION]: 'Science Fiction',
  [NovelStyle.HISTORICAL]: 'Historical',
  [NovelStyle.CONTEMPORARY]: 'Contemporary',
  [NovelStyle.FAIRY_TALE]: 'Fairy Tale',
  [NovelStyle.COMEDY]: 'Comedy',
  [NovelStyle.DRAMA]: 'Drama',
  [NovelStyle.HORROR]: 'Horror',
  [NovelStyle.THRILLER]: 'Thriller',
  [NovelStyle.BIOGRAPHY]: 'Biography',
  [NovelStyle.EDUCATIONAL]: 'Educational',
  [NovelStyle.POETRY]: 'Poetry',
  [NovelStyle.SPORTS_ADVENTURE]: 'Sports Adventure',
};

export const GraphicalStyleLabels: Record<GraphicalStyle, string> = {
  [GraphicalStyle.CARTOON]: 'Cartoon',
  [GraphicalStyle.REALISTIC]: 'Realistic',
  [GraphicalStyle.WATERCOLOR]: 'Watercolor',
  [GraphicalStyle.DIGITAL_ART]: 'Digital Art',
  [GraphicalStyle.HAND_DRAWN]: 'Hand Drawn',
  [GraphicalStyle.MINIMALIST]: 'Minimalist',
  [GraphicalStyle.VINTAGE]: 'Vintage',
  [GraphicalStyle.COMIC_BOOK]: 'Comic Book',
  [GraphicalStyle.EURO_COMIC_BOOK]: 'Humorous Adventure',
  [GraphicalStyle.ANIME]: 'Anime',
  [GraphicalStyle.PIXAR_STYLE]: 'Pixar Style',
  [GraphicalStyle.DISNEY_STYLE]: 'Disney Style',
  [GraphicalStyle.SKETCH]: 'Sketch',
  [GraphicalStyle.OIL_PAINTING]: 'Oil Painting',
  [GraphicalStyle.COLORED_PENCIL]: 'Colored Pencil',
};

// Helper functions to get all enum values as arrays
export const getAllTargetAudiences = (): TargetAudience[] => Object.values(TargetAudience);

export const getAllNovelStyles = (): NovelStyle[] => Object.values(NovelStyle);

export const getAllGraphicalStyles = (): GraphicalStyle[] => Object.values(GraphicalStyle);

export const getAllLiteraryPersonas = (): LiteraryPersona[] => Object.values(LiteraryPersona);

// Helper functions to map between enum values and labels
export const getTargetAudienceLabel = (value: TargetAudience): string =>
  TargetAudienceLabels[value];

export const getNovelStyleLabel = (value: NovelStyle): string => NovelStyleLabels[value];

export const getGraphicalStyleLabel = (value: GraphicalStyle): string =>
  GraphicalStyleLabels[value];

// Helper functions to find enum value from label (useful for backward compatibility)
export const findTargetAudienceByLabel = (label: string): TargetAudience | undefined => {
  return Object.entries(TargetAudienceLabels).find(([, l]) => l === label)?.[0] as TargetAudience;
};

export const findNovelStyleByLabel = (label: string): NovelStyle | undefined => {
  return Object.entries(NovelStyleLabels).find(([, l]) => l === label)?.[0] as NovelStyle;
};

export const findGraphicalStyleByLabel = (label: string): GraphicalStyle | undefined => {
  return Object.entries(GraphicalStyleLabels).find(([, l]) => l === label)?.[0] as GraphicalStyle;
};
