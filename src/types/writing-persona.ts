export const WRITING_PERSONA_POV_VALUES = [
  '1st',
  '2nd',
  '3rd-limited',
  '3rd-omniscient',
  'objective',
] as const;

export type WritingPersonaPov = (typeof WRITING_PERSONA_POV_VALUES)[number];

export const WRITING_PERSONA_TECHNIQUE_VALUES = [
  'free-indirect-discourse',
  'unreliable-narrator',
  '4th-wall-break',
  'show-dont-tell',
  'scene-anchoring',
  'lyrical-refrains',
  'oral-cadence',
] as const;

export type WritingPersonaTechnique = (typeof WRITING_PERSONA_TECHNIQUE_VALUES)[number];

export type WritingPersonaSettings = {
  pov: WritingPersonaPov;
  tone: number;
  formality: number;
  rhythm: number;
  vocabulary: number;
  fictionality: number;
  dialogueDensity: number;
  sensoriality: number;
  subtextIrony: number;
  techniques: WritingPersonaTechnique[];
  specialRequirements: string;
};

export type SavedWritingPersona = WritingPersonaSettings & {
  codename: string;
  name: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_WRITING_PERSONA_SETTINGS: WritingPersonaSettings = {
  pov: '3rd-limited',
  tone: 3,
  formality: 3,
  rhythm: 3,
  vocabulary: 3,
  fictionality: 3,
  dialogueDensity: 3,
  sensoriality: 3,
  subtextIrony: 2,
  techniques: [],
  specialRequirements: '',
};

export const WRITING_PERSONA_MAX_SAVED = 3;
export const WRITING_PERSONA_SPECIAL_REQUIREMENTS_MAX_LENGTH = 600;
