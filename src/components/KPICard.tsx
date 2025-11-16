'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  href: string;
  description?: string;
  isLoading?: boolean;
}

export default function KPICard({
  title,
  value,
  icon,
  href,
  description,
  isLoading = false,
}: KPICardProps) {
  const cardClasses = [
    'card bg-base-100 transition-all duration-200',
    isLoading
      ? 'border border-dashed border-primary/30 shadow-inner'
      : 'shadow-md hover:shadow-lg hover:bg-base-200',
  ].join(' ');

  return (
    <Link href={href} className="block">
      <div className={cardClasses}>
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`text-primary text-xl md:text-2xl ${isLoading ? 'opacity-40' : ''}`}>
                {icon}
              </div>
              <div>
                <h3 className="card-title text-base md:text-lg">{title}</h3>
                {description ? (
                  isLoading ? (
                    <div className="mt-1 h-3 w-24 rounded bg-base-200/70" aria-hidden="true" />
                  ) : (
                    <p className="text-xs md:text-sm text-base-content/70">{description}</p>
                  )
                ) : null}
              </div>
            </div>
            <div className="text-right">
              {isLoading ? (
                <div className="flex flex-col items-end gap-2" aria-live="polite">
                  <div className="h-7 w-20 rounded bg-base-200/80 shadow-inner" />
                  <div className="h-2.5 w-12 rounded bg-base-200/60" />
                </div>
              ) : (
                <div className="text-2xl md:text-3xl font-bold text-primary">{value}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
