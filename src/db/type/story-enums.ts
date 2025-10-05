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
  ANIME = 'anime',
  PIXAR_STYLE = 'pixar_style',
  DISNEY_STYLE = 'disney_style',
  SKETCH = 'sketch',
  OIL_PAINTING = 'oil_painting',
  COLORED_PENCIL = 'colored_pencil',
}

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
