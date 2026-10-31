'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { surveyStudyClient, unwrapList } from '@/lib/surveys/study-client';
import type { SurveyStudy, SurveyVersionSummary } from '@/lib/surveys/study-types';
import StudyCreateForm from '@/components/surveys/studies/StudyCreateForm';
import StudyStatusBadge from '@/components/surveys/studies/StudyStatusBadge';

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '-';
}

export default function SurveyStudiesPage() {
  const { session, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [studies, setStudies] = useState<SurveyStudy[]>([]);
  const [surveys, setSurveys] = useState<SurveyVersionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [studyList, catalog] = await Promise.all([
        surveyStudyClient.list(),
        surveyStudyClient.catalog().catch(() => []),
      ]);
      setStudies(studyList);
      setSurveys(unwrapList<SurveyVersionSummary>(catalog, 'surveys'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load studies');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && session) {
      setIsLoading(true);
      load();
    }
  }, [authLoading, session, load]);

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Survey studies</h1>
          <p className="text-sm text-base-content/60">
            Customer research studies: cohorts, audience snapshots and survey campaigns.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm btn-ghost gap-1" onClick={load}>
            <FiRefreshCw /> Refresh
          </button>
          <button className="btn btn-sm btn-primary gap-1" onClick={() => setShowCreate(true)}>
            <FiPlus /> New study
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {showCreate && (
        <StudyCreateForm
          surveys={surveys}
          onCancel={() => setShowCreate(false)}
          onCreated={(detail) => {
            setShowCreate(false);
            router.push(`/surveys/studies/${detail.study.studyId}`);
          }}
        />
      )}

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body overflow-x-auto">
          {studies.length === 0 ? (
            <p className="text-center py-8 text-base-content/60">No studies yet.</p>
          ) : (
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Study</th>
                  <th>Opens</th>
                  <th>Closes</th>
                  <th>Holdout</th>
                  <th>Cohorts</th>
                </tr>
              </thead>
              <tbody>
                {studies.map((study) => (
                  <tr key={study.studyId} className="hover">
                    <td>
                      <StudyStatusBadge status={study.status} />
                    </td>
                    <td>
                      <Link
                        href={`/surveys/studies/${study.studyId}`}
                        className="link link-hover font-medium"
                      >
                        {study.title}
                      </Link>
                      <div className="text-xs text-base-content/60">{study.studyKey}</div>
                    </td>
                    <td className="text-sm">{formatDate(study.opensAt)}</td>
                    <td className="text-sm">{formatDate(study.closesAt)}</td>
                    <td className="text-sm">{study.holdoutPercent ?? 0}%</td>
                    <td className="text-sm">
                      {(study.cohorts ?? []).map((cohort) => cohort.cohortKey).join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
