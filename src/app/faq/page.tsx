'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import FaqSectionsTab from './sections-tab';
import FaqEntriesTab from './entries-tab';

type TabType = 'sections' | 'entries';

export default function FaqPage() {
  const { loading } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<TabType>('entries');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">FAQ Management</h1>
          <p className="text-sm text-base-content/70 mt-1">
            Manage FAQ sections and entries for the Mythoria platform
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-boxed tabs-lg mb-8 bg-base-200/50 p-1.5 inline-flex">
        <a
          role="tab"
          className={`tab px-8 transition-all duration-200 ${
            activeTab === 'entries'
              ? 'tab-active bg-primary text-primary-content shadow-sm'
              : 'hover:bg-base-200'
          }`}
          onClick={() => setActiveTab('entries')}
        >
          FAQ Entries
        </a>
        <a
          role="tab"
          className={`tab px-8 transition-all duration-200 ${
            activeTab === 'sections'
              ? 'tab-active bg-primary text-primary-content shadow-sm'
              : 'hover:bg-base-200'
          }`}
          onClick={() => setActiveTab('sections')}
        >
          FAQ Sections
        </a>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'entries' && <FaqEntriesTab />}
        {activeTab === 'sections' && <FaqSectionsTab />}
      </div>
    </div>
  );
}
