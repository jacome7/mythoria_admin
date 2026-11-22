export interface BiographerProject {
  id: string;
  title: string;
  subject: string;
  purpose: string;
  locale: string;
  status: string;
  revision: number;
  liveSeconds: number;
  allowanceSeconds: number;
  proposal: Record<string, unknown> | null;
  proposalRevision: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
export interface BiographerTurn {
  id: string;
  projectId: string;
  participantId: string;
  role: 'user' | 'assistant';
  text: string;
  originalText: string;
  revision: number;
  included: boolean;
  final: boolean;
  interrupted: boolean;
  createdAt: string | Date;
}
export interface BiographerSegment {
  id: string;
  turnId: string;
  sequence: number;
  contentType: string;
  durationMs: number;
  bytes: number;
  sha256: string;
}
export interface BiographerProjectDetail {
  project: BiographerProject;
  participant: {
    id: string;
    name: string;
    role: string;
    status?: string;
    followUp?: string | null;
  };
  turns: BiographerTurn[];
  segments: BiographerSegment[];
  assets: Array<{ id: string; caption: string; contentType: string; included: boolean }>;
}
