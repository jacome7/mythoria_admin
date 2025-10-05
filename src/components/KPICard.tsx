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
  return (
    <Link href={href} className="block">
      <div className="card bg-base-100 shadow-md hover:shadow-lg transition-shadow duration-200 hover:bg-base-200">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-primary text-xl md:text-2xl">{icon}</div>
              <div>
                <h3 className="card-title text-base md:text-lg">{title}</h3>
                {description && (
                  <p className="text-xs md:text-sm text-base-content/70">{description}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              {isLoading ? (
                <div className="loading loading-spinner loading-md"></div>
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
