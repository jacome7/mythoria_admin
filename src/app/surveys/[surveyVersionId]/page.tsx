import { notFound } from 'next/navigation';
import SurveyResultsView from '@/components/surveys/SurveyResultsView';
import { guardSurveyPage } from '@/components/surveys/page-guard';
import { isUuid } from '@/lib/surveys/api';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ surveyVersionId: string }>;
  searchParams: Promise<{ studyId?: string; cohort?: string }>;
}

export default async function SurveyResultsPage({ params, searchParams }: PageProps) {
  const { surveyVersionId } = await params;
  if (!isUuid(surveyVersionId)) notFound();
  const query = await searchParams;
  const guard = await guardSurveyPage('survey:view', `/surveys/${surveyVersionId}`);
  if (guard.denied) return guard.denied;
  return (
    <div className="container mx-auto p-6">
      <SurveyResultsView
        surveyVersionId={surveyVersionId}
        initialStudyId={isUuid(query.studyId) ? query.studyId : undefined}
        initialCohort={typeof query.cohort === 'string' ? query.cohort : undefined}
        canAnalyze={guard.actor.permissions.includes('survey:analyze')}
      />
    </div>
  );
}
