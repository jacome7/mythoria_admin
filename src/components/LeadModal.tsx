'use client';

import { useState, useEffect } from 'react';

interface Lead {
  id: string;
  name: string | null;
  email: string;
  mobilePhone: string | null;
  language: string;
  emailStatus: 'ready' | 'sent' | 'open' | 'click' | 'soft_bounce' | 'hard_bounce' | 'unsub';
  lastEmailSentAt: string | null;
}

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lead?: Lead | null;
}

interface FormData {
  name: string;
  email: string;
  mobilePhone: string;
  language: string;
  emailStatus: string;
}

export default function LeadModal({ isOpen, onClose, onSuccess, lead }: LeadModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    mobilePhone: '',
    language: 'pt-PT',
    emailStatus: 'ready',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form data when lead changes (for edit mode)
  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || '',
        email: lead.email,
        mobilePhone: lead.mobilePhone || '',
        language: lead.language,
        emailStatus: lead.emailStatus,
      });
    } else {
      // Reset form for new lead
      setFormData({
        name: '',
        email: '',
        mobilePhone: '',
        language: 'pt-PT',
        emailStatus: 'ready',
      });
    }
    setError(null);
  }, [lead, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Prepare data - only send non-empty values
      const payload: Record<string, string> = {
        email: formData.email,
        language: formData.language,
        emailStatus: formData.emailStatus,
      };

      if (formData.name.trim()) {
        payload.name = formData.name;
      }

      if (formData.mobilePhone.trim()) {
        payload.mobilePhone = formData.mobilePhone;
      }

      const url = lead ? `/api/admin/leads/${lead.id}` : '/api/admin/leads';
      const method = lead ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save lead');
      }
    } catch (err) {
      console.error('Error saving lead:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">{lead ? 'Edit Lead' : 'Add New Lead'}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Name field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Name</span>
              <span className="label-text-alt text-gray-500">Optional</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Rodrigo Jácome"
              className="input input-bordered w-full"
            />
            <label className="label">
              <span className="label-text-alt text-gray-500">
                Will be auto-capitalized (e.g., &quot;rodrigo jácome&quot; → &quot;Rodrigo
                Jácome&quot;)
              </span>
            </label>
          </div>

          {/* Email field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">
                Email <span className="text-error">*</span>
              </span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g., user@example.com"
              className="input input-bordered w-full"
              required
              disabled={!!lead} // Can't change email when editing
            />
            {lead && (
              <label className="label">
                <span className="label-text-alt text-warning">
                  Email cannot be changed after creation
                </span>
              </label>
            )}
            {!lead && (
              <label className="label">
                <span className="label-text-alt text-gray-500">
                  Will be normalized (lowercase, remove aliases for Gmail/Outlook)
                </span>
              </label>
            )}
          </div>

          {/* Mobile Phone field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Mobile Phone</span>
              <span className="label-text-alt text-gray-500">Optional</span>
            </label>
            <input
              type="tel"
              name="mobilePhone"
              value={formData.mobilePhone}
              onChange={handleChange}
              placeholder="e.g., +351 912 345 678"
              className="input input-bordered w-full"
            />
            <label className="label">
              <span className="label-text-alt text-gray-500">Any format accepted</span>
            </label>
          </div>

          {/* Language field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">
                Language <span className="text-error">*</span>
              </span>
            </label>
            <select
              name="language"
              value={formData.language}
              onChange={handleChange}
              className="select select-bordered w-full"
              required
            >
              <option value="pt-PT">Portuguese (PT)</option>
              <option value="es-ES">Spanish (ES)</option>
              <option value="en-US">English (US)</option>
              <option value="fr-FR">French (FR)</option>
            </select>
          </div>

          {/* Email Status field */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">
                Email Status <span className="text-error">*</span>
              </span>
            </label>
            <select
              name="emailStatus"
              value={formData.emailStatus}
              onChange={handleChange}
              className="select select-bordered w-full"
              required
            >
              <option value="ready">Ready</option>
              <option value="sent">Sent</option>
              <option value="open">Opened</option>
              <option value="click">Clicked</option>
              <option value="soft_bounce">Soft Bounce</option>
              <option value="hard_bounce">Hard Bounce</option>
              <option value="unsub">Unsubscribed</option>
            </select>
            <label className="label">
              <span className="label-text-alt text-gray-500">
                {lead ? 'Update the campaign status for this lead' : 'New leads default to "Ready"'}
              </span>
            </label>
          </div>

          {/* Form actions */}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Saving...
                </>
              ) : lead ? (
                'Update Lead'
              ) : (
                'Create Lead'
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
