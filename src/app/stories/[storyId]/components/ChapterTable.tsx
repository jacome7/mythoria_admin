'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatAdminDateTime } from '@/lib/date-utils';

interface Chapter {
  chapterNumber: number;
  title?: string;
  createdAt?: string;
}

interface ChapterTableProps {
  storyId: string;
}

export function ChapterTable({ storyId }: ChapterTableProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChapters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/stories/${storyId}/chapters`);
      if (res.ok) {
        const data = await res.json();
        setChapters(data.chapters || []);
      } else {
        console.error('Failed to fetch chapters');
      }
    } catch (error) {
      console.error('Error fetching chapters:', error);
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  if (loading) {
    return (
      <div className="flex justify-center my-6">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (chapters.length === 0) {
    return <p className="text-center">No chapters found</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {chapters.map(ch => (
            <tr key={ch.chapterNumber}>
              <td>{ch.chapterNumber}</td>
              <td>{ch.title || 'Untitled'}</td>
              <td>{ch.createdAt ? formatAdminDateTime(ch.createdAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

