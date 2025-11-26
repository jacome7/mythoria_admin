'use client';

import { useEffect, useState, useCallback } from 'react';
import { FaEdit, FaTrash, FaPlus, FaGlobe, FaCheck, FaTimes } from 'react-icons/fa';

interface FaqSection {
  id: string;
  sectionKey: string;
  defaultLabel: string;
}

interface FaqEntry {
  id: string;
  sectionId: string;
  faqKey: string;
  locale: string;
  title: string;
  contentMdx: string;
  questionSortOrder: number;
  isPublished: boolean;
  section: FaqSection | null;
}

interface PaginationData {
  page: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

type SortField = 'questionSortOrder' | 'section' | 'locale' | 'title' | 'faqKey';
type SortOrder = 'asc' | 'desc';

const LOCALES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'pt-PT', label: 'Portuguese (PT)' },
  { code: 'es-ES', label: 'Spanish (ES)' },
  { code: 'fr-FR', label: 'French (FR)' },
  { code: 'de-DE', label: 'German (DE)' },
];

export default function FaqEntriesTab() {
  const [entries, setEntries] = useState<FaqEntry[]>([]);
  const [sections, setSections] = useState<FaqSection[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [localeFilter, setLocaleFilter] = useState('all');
  const [publishedFilter, setPublishedFilter] = useState('all');
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('questionSortOrder');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FaqEntry | null>(null);
  const [formData, setFormData] = useState({
    sectionId: '',
    faqKey: '',
    locale: 'en-US',
    title: '',
    contentMdx: '',
    questionSortOrder: 0,
    isPublished: false,
  });
  const [formErrors, setFormErrors] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const fetchSections = useCallback(async () => {
    try {
      const response = await fetch('/api/faq/sections?limit=1000');
      if (response.ok) {
        const data = await response.json();
        setSections(data.data);
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  }, []);

  const fetchEntries = useCallback(
    async (page: number) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '50',
          ...(searchTerm && { search: searchTerm }),
          ...(sectionFilter !== 'all' && { sectionId: sectionFilter }),
          ...(localeFilter !== 'all' && { locale: localeFilter }),
          ...(publishedFilter !== 'all' && { isPublished: publishedFilter }),
          sortField,
          sortOrder,
        });

        const response = await fetch(`/api/faq/entries?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setEntries(data.data);
          setPagination(data.pagination);
        } else {
          console.error('Failed to fetch FAQ entries');
        }
      } catch (error) {
        console.error('Error fetching FAQ entries:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, sectionFilter, localeFilter, publishedFilter, sortField, sortOrder],
  );

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    fetchEntries(currentPage);
  }, [currentPage, fetchEntries]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    setCurrentPage(1);
    setSortField(field);
    setSortOrder((prevOrder) => (field === sortField && prevOrder === 'asc' ? 'desc' : 'asc'));
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return <span>{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  const openCreateModal = () => {
    setEditingEntry(null);
    setFormData({
      sectionId: sections.length > 0 ? sections[0].id : '',
      faqKey: '',
      locale: 'en-US',
      title: '',
      contentMdx: '',
      questionSortOrder: 0,
      isPublished: false,
    });
    setFormErrors(null);
    setIsModalOpen(true);
  };

  const openEditModal = (entry: FaqEntry) => {
    setEditingEntry(entry);
    setFormData({
      sectionId: entry.sectionId,
      faqKey: entry.faqKey,
      locale: entry.locale,
      title: entry.title,
      contentMdx: entry.contentMdx,
      questionSortOrder: entry.questionSortOrder,
      isPublished: entry.isPublished,
    });
    setFormErrors(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setFormErrors(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormErrors(null);

    try {
      const payload = {
        sectionId: formData.sectionId,
        faqKey: formData.faqKey.trim(),
        locale: formData.locale,
        title: formData.title.trim(),
        contentMdx: formData.contentMdx.trim(),
        questionSortOrder: formData.questionSortOrder,
        isPublished: formData.isPublished,
      };

      const url = editingEntry ? `/api/faq/entries/${editingEntry.id}` : '/api/faq/entries';
      const method = editingEntry ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        closeModal();
        fetchEntries(currentPage);
      } else {
        const errorData = await response.json();
        setFormErrors(errorData.error || 'Failed to save entry');
      }
    } catch (error) {
      setFormErrors('Network error. Please try again.');
      console.error('Error saving entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entry: FaqEntry) => {
    if (!confirm(`Are you sure you want to delete "${entry.title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/faq/entries/${entry.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchEntries(currentPage);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete entry');
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Error deleting entry:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEntries.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedEntries.size} selected FAQ entries?`)) {
      return;
    }

    try {
      const ids = Array.from(selectedEntries).join(',');
      const response = await fetch(`/api/faq/entries?ids=${ids}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSelectedEntries(new Set());
        fetchEntries(currentPage);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete entries');
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Error bulk deleting entries:', error);
    }
  };

  const handleTranslate = async (entry: FaqEntry) => {
    if (
      !confirm(
        `This will automatically translate "${entry.title}" to all missing locales using AI. Continue?`,
      )
    ) {
      return;
    }

    setIsTranslating(true);

    try {
      const response = await fetch(`/api/faq/entries/${entry.id}/translate`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'Translation completed successfully');
        fetchEntries(currentPage);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Translation failed');
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Error translating entry:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedEntries.size === entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map((e) => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEntries(newSelected);
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search entries..."
            className="input input-bordered flex-1"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <select
            className="select select-bordered"
            value={sectionFilter}
            onChange={(e) => {
              setSectionFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.defaultLabel}
              </option>
            ))}
          </select>
          <select
            className="select select-bordered"
            value={localeFilter}
            onChange={(e) => {
              setLocaleFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Locales</option>
            {LOCALES.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.label}
              </option>
            ))}
          </select>
          <select
            className="select select-bordered"
            value={publishedFilter}
            onChange={(e) => {
              setPublishedFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="true">Published</option>
            <option value="false">Unpublished</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={openCreateModal}>
            <FaPlus className="mr-2" />
            Add Entry
          </button>
          {selectedEntries.size > 0 && (
            <button className="btn btn-error" onClick={handleBulkDelete}>
              <FaTrash className="mr-2" />
              Delete {selectedEntries.size} Selected
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={entries.length > 0 && selectedEntries.size === entries.length}
                  onChange={handleSelectAll}
                />
              </th>
              <th>
                <button
                  type="button"
                  className="flex items-center gap-1 font-semibold"
                  onClick={() => handleSort('locale')}
                >
                  Locale {renderSortIndicator('locale')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="flex items-center gap-1 font-semibold"
                  onClick={() => handleSort('section')}
                >
                  Section {renderSortIndicator('section')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="flex items-center gap-1 font-semibold"
                  onClick={() => handleSort('title')}
                >
                  Title {renderSortIndicator('title')}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="flex items-center gap-1 font-semibold"
                  onClick={() => handleSort('faqKey')}
                >
                  FAQ Key {renderSortIndicator('faqKey')}
                </button>
              </th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-base-content/60">
                  No entries found
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedEntries.has(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                    />
                  </td>
                  <td>
                    <span className="badge badge-outline">{entry.locale}</span>
                  </td>
                  <td className="text-sm">{entry.section?.defaultLabel || '—'}</td>
                  <td className="font-semibold max-w-md truncate">{entry.title}</td>
                  <td className="font-mono text-xs">{entry.faqKey}</td>
                  <td>
                    {entry.isPublished ? (
                      <span className="badge badge-success gap-2">
                        <FaCheck className="w-3 h-3" />
                        Published
                      </span>
                    ) : (
                      <span className="badge badge-warning gap-2">
                        <FaTimes className="w-3 h-3" />
                        Draft
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => openEditModal(entry)}
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-info"
                        onClick={() => handleTranslate(entry)}
                        title="Translate to other locales"
                        disabled={isTranslating}
                      >
                        <FaGlobe />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => handleDelete(entry)}
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="join">
            <button
              className="join-item btn"
              disabled={!pagination.hasPrev}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              «
            </button>
            <button className="join-item btn">
              Page {currentPage} of {pagination.totalPages}
            </button>
            <button
              className="join-item btn"
              disabled={!pagination.hasNext}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">
              {editingEntry ? 'Edit FAQ Entry' : 'Create FAQ Entry'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Section *</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.sectionId}
                    onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                    required
                  >
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.defaultLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Locale *</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.locale}
                    onChange={(e) => setFormData({ ...formData, locale: e.target.value })}
                    disabled={!!editingEntry}
                    required
                  >
                    {LOCALES.map((locale) => (
                      <option key={locale.code} value={locale.code}>
                        {locale.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text font-medium">FAQ Key *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.faqKey}
                    onChange={(e) => setFormData({ ...formData, faqKey: e.target.value })}
                    disabled={!!editingEntry}
                    required
                    placeholder="e.g., how-credits-work"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Sort Order</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    value={formData.questionSortOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, questionSortOrder: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                  />
                </div>
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text font-medium">Title *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="Question title"
                />
              </div>

              <div className="form-control w-full mb-6">
                <label className="label">
                  <span className="label-text font-medium">Content (MDX) *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered font-mono text-sm w-full h-64 leading-relaxed"
                  value={formData.contentMdx}
                  onChange={(e) => setFormData({ ...formData, contentMdx: e.target.value })}
                  required
                  placeholder="Full answer in Markdown/MDX format"
                />
              </div>

              <div className="form-control mb-6">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  />
                  <span className="label-text font-medium">Published</span>
                </label>
              </div>

              {formErrors && (
                <div className="alert alert-error mb-4">
                  <span>{formErrors}</span>
                </div>
              )}

              <div className="modal-action">
                <button type="button" className="btn" onClick={closeModal} disabled={isSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
