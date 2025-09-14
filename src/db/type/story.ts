import {
  TargetAudience,
  NovelStyle,
  GraphicalStyle,
} from "@/types/story-enums";

export interface StoryData {
  storyId: string;
  title: string;
  place: string | null;
  targetAudience: TargetAudience | null;
  novelStyle: NovelStyle | null;
  graphicalStyle: GraphicalStyle | null;
  plotDescription: string | null;
  additionalRequests: string | null;
  imageGenerationInstructions: string | null;
  chapterCount?: number | null;
  storyLanguage?: string | null;
}

export interface Story {
  storyId: string;
  title: string;
  status: "draft" | "writing" | "published";
  storyGenerationStatus?:
    | "queued"
    | "running"
    | "failed"
    | "completed"
    | "cancelled"
    | null;
  storyGenerationCompletedPercentage?: number;
  isPublic?: boolean;
  slug?: string;
  createdAt: string;
  updatedAt: string;
}

export type SortField = "title" | "createdAt" | "updatedAt" | "status";
export type SortDirection = "asc" | "desc";
