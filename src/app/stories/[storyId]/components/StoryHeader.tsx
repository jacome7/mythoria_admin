'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface StoryHeaderProps {
  title: string;
  children?: ReactNode;
}

export function StoryHeader({ title, children }: StoryHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="breadcrumbs text-sm">
          <ul>
            <li>
              <Link href="/stories">Stories</Link>
            </li>
            <li>Story Details</li>
          </ul>
        </div>
        <h1 className="break-words text-3xl font-bold">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div>}
    </div>
  );
}
