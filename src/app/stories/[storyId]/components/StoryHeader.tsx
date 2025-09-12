'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface StoryHeaderProps {
  title: string;
  children?: ReactNode;
}

export function StoryHeader({ title, children }: StoryHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <div className="breadcrumbs text-sm">
          <ul>
            <li><Link href="/stories">Stories</Link></li>
            <li>Story Details</li>
          </ul>
        </div>
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </div>
  );
}

