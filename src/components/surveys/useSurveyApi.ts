'use client';

import { useEffect, useState } from 'react';

export interface SurveyApiState<T> {
  data: T | null;
  error: string | null;
  /** HTTP status of a failed request (401/403 etc.). */
  status: number | null;
  loading: boolean;
}

/** Fetches JSON from a survey analytics endpoint. Pass `null` to skip (e.g. tab not active). */
export function useSurveyApi<T>(url: string | null): SurveyApiState<T> {
  const [state, setState] = useState<SurveyApiState<T>>({
    data: null,
    error: null,
    status: null,
    loading: url !== null,
  });

  useEffect(() => {
    if (url === null) {
      setState({ data: null, error: null, status: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null, status: null }));
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setState({
            data: null,
            error:
              typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`,
            status: response.status,
            loading: false,
          });
          return;
        }
        setState({ data: body as T, error: null, status: null, loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          error: error instanceof Error ? error.message : 'Request failed',
          status: null,
          loading: false,
        });
      });
    return () => controller.abort();
  }, [url]);

  return state;
}

export function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
