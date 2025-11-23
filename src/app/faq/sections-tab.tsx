'use client';

import { useEffect, useState, useCallback } from 'react';
import { FaEdit, FaTrash, FaPlus, FaCheck, FaTimes } from 'react-icons/fa';

interface FaqSection {
  id: string;
  sectionKey: string;
  defaultLabel: string;
  description: string | null;
  iconName: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

export default function FaqSectionsTab() {
  const [sections, setSections] = useState<FaqSection[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<FaqSection | null>(null);
  const [formData, setFormData] = useState({
    sectionKey: '',
    defaultLabel: '',
    description: '',
    iconName: '',
    sortOrder: 0,
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSections = useCallback(
    async (page: number) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '100',
          ...(searchTerm && { search: searchTerm }),
          ...(isActiveFilter !== 'all' && { isActive: isActiveFilter }),
        });

        const response = await fetch(`/api/faq/sections?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setSections(data.data);
          setPagination(data.pagination);
        } else {
          console.error('Failed to fetch FAQ sections');
        }
      } catch (error) {
        console.error('Error fetching FAQ sections:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, isActiveFilter],
  );

  useEffect(() => {
    fetchSections(currentPage);
  }, [currentPage, fetchSections]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const openCreateModal = () => {
    setEditingSection(null);
    setFormData({
      sectionKey: '',
      defaultLabel: '',
      description: '',
      iconName: '',
      sortOrder: sections.length > 0 ? Math.max(...sections.map((s) => s.sortOrder)) + 1 : 1,
      isActive: true,
    });
    setFormErrors(null);
    setIsModalOpen(true);
  };

  const openEditModal = (section: FaqSection) => {
    setEditingSection(section);
    setFormData({
      sectionKey: section.sectionKey,
      defaultLabel: section.defaultLabel,
      description: section.description || '',
      iconName: section.iconName || '',
      sortOrder: section.sortOrder,
      isActive: section.isActive,
    });
    setFormErrors(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSection(null);
    setFormErrors(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormErrors(null);

    try {
      const payload = {
        sectionKey: formData.sectionKey.trim(),
        defaultLabel: formData.defaultLabel.trim(),
        description: formData.description.trim() || undefined,
        iconName: formData.iconName.trim() || undefined,
        sortOrder: formData.sortOrder,
        isActive: formData.isActive,
      };

      const url = editingSection ? `/api/faq/sections/${editingSection.id}` : '/api/faq/sections';
      const method = editingSection ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        closeModal();
        fetchSections(currentPage);
      } else {
        const errorData = await response.json();
        setFormErrors(errorData.error || 'Failed to save section');
      }
    } catch (error) {
      setFormErrors('Network error. Please try again.');
      console.error('Error saving section:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (section: FaqSection) => {
    if (
      !confirm(
        `Are you sure you want to delete the section "${section.defaultLabel}"? This will fail if there are FAQ entries in this section.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/faq/sections/${section.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchSections(currentPage);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete section');
      }
    } catch (error) {
      alert('Network error. Please try again.');
      console.error('Error deleting section:', error);
    }
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search sections..."
          className="input input-bordered flex-1"
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <select
          className="select select-bordered"
          value={isActiveFilter}
          onChange={(e) => {
            setIsActiveFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Status</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <FaPlus className="mr-2" />
          Add Section
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Sort Order</th>
              <th>Section Key</th>
              <th>Label</th>
              <th>Description</th>
              <th>Icon</th>
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
            ) : sections.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-base-content/60">
                  No sections found
                </td>
              </tr>
            ) : (
              sections.map((section) => (
                <tr key={section.id}>
                  <td className="font-mono">{section.sortOrder}</td>
                  <td className="font-mono text-sm">{section.sectionKey}</td>
                  <td className="font-semibold">{section.defaultLabel}</td>
                  <td className="max-w-xs truncate text-sm">{section.description || '—'}</td>
                  <td className="font-mono text-sm">{section.iconName || '—'}</td>
                  <td>
                    {section.isActive ? (
                      <span className="badge badge-success gap-2">
                        <FaCheck className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-ghost gap-2">
                        <FaTimes className="w-3 h-3" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => openEditModal(section)}
                        title="Edit"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => handleDelete(section)}
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
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">
              {editingSection ? 'Edit FAQ Section' : 'Create FAQ Section'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text font-medium">Section Key *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.sectionKey}
                    onChange={(e) => setFormData({ ...formData, sectionKey: e.target.value })}
                    disabled={!!editingSection}
                    required
                    placeholder="e.g., credits-pricing-and-payments"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Sort Order</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                    }
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Default Label *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.defaultLabel}
                    onChange={(e) => setFormData({ ...formData, defaultLabel: e.target.value })}
                    required
                    placeholder="e.g., Credits, Pricing & Payments"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Icon Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.iconName}
                    onChange={(e) => setFormData({ ...formData, iconName: e.target.value })}
                    placeholder="e.g., FaCreditCard (from react-icons)"
                  />
                </div>
              </div>

              <div className="form-control w-full mb-6">
                <label className="label">
                  <span className="label-text font-medium">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full h-24"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short description of this section"
                />
              </div>

              <div className="form-control mb-6">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span className="label-text font-medium">Active</span>
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
