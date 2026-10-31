import { notFound } from 'next/navigation';
import StudyInsightsView from '@/components/surveys/StudyInsightsView';
import { guardSurveyPage } from '@/components/surveys/page-guard';
import { isUuid } from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ studyId: string }>;
}

export default async function StudyInsightsPage({ params }: PageProps) {
  const { studyId } = await params;
  if (!isUuid(studyId)) notFound();
  const guard = await guardSurveyPage('survey:view', `/surveys/insights/${studyId}`);
  if (guard.denied) return guard.denied;
  return (
    <div className="container mx-auto p-6">
      <StudyInsightsView studyId={studyId} />
    </div>
  );
}
