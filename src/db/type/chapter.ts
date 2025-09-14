export interface ApiChapter {
  id: string;
  chapterNumber: number;
  title: string;
  imageUri: string | null;
  imageThumbnailUri: string | null;
  htmlContent: string;
  audioUri: string | null;
  version: number;
  hasNextVersion: boolean;
  hasPreviousVersion: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter extends Omit<ApiChapter, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}
