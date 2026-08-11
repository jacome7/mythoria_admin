import { fireEvent, render, screen } from '@testing-library/react';
import StoryDetailPage from '@/app/stories/[storyId]/page';
import { StoryDetail, useStoryDetail } from '@/app/stories/[storyId]/hooks/useStoryDetail';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useParams } from 'next/navigation';

jest.mock('@/lib/hooks/useAdminAuth', () => ({
  useAdminAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}));

jest.mock('@/app/stories/[storyId]/hooks/useStoryDetail', () => ({
  useStoryDetail: jest.fn(),
}));

jest.mock('@/app/stories/[storyId]/components/StoryHeader', () => ({
  StoryHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/app/stories/[storyId]/components/StoryActions', () => ({
  StoryActions: () => <div>Management actions</div>,
}));

jest.mock('@/app/stories/[storyId]/components/ChapterTable', () => ({
  ChapterTable: () => <div>Chapter table</div>,
}));

jest.mock('@/components/audio-player', () => ({
  useAudioPlayer: () => ({}),
  AudioChapterList: () => <div>Audio chapters</div>,
  hasAudiobook: () => false,
  getAudioChapters: () => [],
}));

const mockUseAdminAuth = jest.mocked(useAdminAuth);
const mockUseParams = jest.mocked(useParams);
const mockUseStoryDetail = jest.mocked(useStoryDetail);

const story: StoryDetail = {
  storyId: 'story-123',
  title: 'The Clockwork Garden',
  author: {
    authorId: 'author-123',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
  },
  status: 'published',
  chapterCount: 3,
  createdAt: '2026-08-11T10:00:00.000Z',
  updatedAt: '2026-08-11T11:00:00.000Z',
  isPublic: false,
  isFeatured: false,
  interiorPdfUri: null,
  coverPdfUri: null,
  audiobookStatus: null,
  audiobookUri: null,
  hasAudio: false,
  plotDescription: null,
  synopsis: null,
  place: null,
  additionalRequests: null,
  targetAudience: null,
  novelStyle: null,
  graphicalStyle: null,
  featureImageUri: null,
};

describe('StoryDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ storyId: story.storyId });
    mockUseAdminAuth.mockReturnValue({
      loading: false,
      session: { user: { email: 'admin@mythoria.pt', name: 'Admin' } },
    } as never);
    mockUseStoryDetail.mockReturnValue({
      story,
      isLoading: false,
      setStory: jest.fn(),
      fetchStory: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('links the author name and ID to the author details page', () => {
    render(<StoryDetailPage />);

    expect(screen.getByRole('link', { name: story.author.displayName })).toHaveAttribute(
      'href',
      `/users/${story.author.authorId}`,
    );
    expect(screen.getByRole('link', { name: story.author.authorId })).toHaveAttribute(
      'href',
      `/users/${story.author.authorId}`,
    );
  });

  it('omits unavailable PDF rows', () => {
    render(<StoryDetailPage />);

    expect(screen.queryByText('Interior PDF:')).not.toBeInTheDocument();
    expect(screen.queryByText('Cover PDF:')).not.toBeInTheDocument();
    expect(screen.queryByText('Not available')).not.toBeInTheDocument();
  });

  it('starts Audio Narration collapsed and expands it on request', () => {
    render(<StoryDetailPage />);

    const disclosure = screen.getByRole('button', { name: 'Expand Audio Narration' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Voice')).not.toBeInTheDocument();

    fireEvent.click(disclosure);

    expect(screen.getByRole('button', { name: 'Collapse Audio Narration' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Voice')).toBeInTheDocument();
  });
});
