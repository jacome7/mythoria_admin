'use client';

import { useState } from 'react';
import { NOTIFICATION_PREFERENCES, type CreateCampaignInput } from '@/lib/schemas/campaigns';
import type { CampaignAudienceSource } from '@/db/schema/campaigns';

type NotificationPreference = (typeof NOTIFICATION_PREFERENCES)[number];

const DEFAULT_USER_NOTIFICATION_PREFERENCES: NotificationPreference[] = ['news', 'inspiration'];

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateCampaignInput) => Promise<void>;
}

export default function CreateCampaignModal({
  isOpen,
  onClose,
  onCreate,
}: CreateCampaignModalProps) {
  const preferenceOptions = NOTIFICATION_PREFERENCES;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audienceSource, setAudienceSource] = useState<CampaignAudienceSource>('leads');
  const [userNotificationPreferences, setUserNotificationPreferences] = useState<
    NotificationPreference[]
  >([...DEFAULT_USER_NOTIFICATION_PREFERENCES]);
  const [dailySendLimit, setDailySendLimit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle('');
    setDescription('');
    setAudienceSource('leads');
    setUserNotificationPreferences([...DEFAULT_USER_NOTIFICATION_PREFERENCES]);
    setDailySendLimit('');
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (audienceSource !== 'leads' && userNotificationPreferences.length === 0) {
      setError('Select at least one user notification preference');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        audienceSource,
        userNotificationPreferences,
        dailySendLimit: dailySendLimit ? parseInt(dailySendLimit, 10) : null,
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">Create New Campaign</h3>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Campaign Title *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="e.g., Spring 2026 Launch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              required
            />
          </div>

          {/* Description */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Description</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Optional campaign description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Audience Source */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Audience *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={audienceSource}
              onChange={(e) => setAudienceSource(e.target.value as CampaignAudienceSource)}
            >
              <option value="leads">Leads only</option>
              <option value="users">Users only</option>
              <option value="both">Both users and leads</option>
            </select>
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                Users are filtered by notification preferences; leads exclude unsubscribed and
                hard-bounced.
              </span>
            </label>
          </div>

          {audienceSource !== 'leads' && (
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text font-medium">User Notification Preferences</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {preferenceOptions.map((value) => (
                  <label key={value} className="label cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={userNotificationPreferences.includes(value)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...userNotificationPreferences, value]
                          : userNotificationPreferences.filter((pref) => pref !== value);
                        setUserNotificationPreferences(next);
                      }}
                    />
                    <span className="label-text capitalize">{value.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  Applies only when users are included in the audience.
                </span>
              </label>
            </div>
          )}

          {/* Daily Send Limit */}
          <div className="form-control mb-6">
            <label className="label">
              <span className="label-text font-medium">Daily Send Limit</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              placeholder="Unlimited (leave empty)"
              value={dailySendLimit}
              onChange={(e) => setDailySendLimit(e.target.value)}
              min={1}
            />
            <label className="label">
              <span className="label-text-alt text-base-content/60">
                Maximum emails this campaign sends per day. Leave empty for no limit.
              </span>
            </label>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                'Create Campaign'
              )}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={handleClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}
