import SurveyList from '@/components/surveys/SurveyList';
import { guardSurveyPage } from '@/components/surveys/page-guard';

export const dynamic = 'force-dynamic';

export default async function SurveysPage() {
  const guard = await guardSurveyPage('survey:view', '/surveys');
  if (guard.denied) return guard.denied;
  return (
    <div className="container mx-auto p-6">
      <SurveyList />
    </div>
  );
}
