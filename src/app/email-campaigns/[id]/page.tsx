'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { campaignClient } from '@/lib/campaignClient';
import type { CampaignDetailResponse, AudienceCount } from '@/lib/campaignClient';
import {
  NOTIFICATION_PREFERENCES,
  type CampaignAssetInput,
  type FilterTree,
  type UpdateCampaignInput,
} from '@/lib/schemas/campaigns';
import type { CampaignAudienceSource } from '@/db/schema/campaigns';
import CampaignDetailHeader from '@/components/email-campaigns/CampaignDetailHeader';
import CampaignFilterEditor from '@/components/email-campaigns/CampaignFilterEditor';
import CampaignAssetEditor from '@/components/email-campaigns/CampaignAssetEditor';
import CampaignProgress from '@/components/email-campaigns/CampaignProgress';
import SampleSendForm from '@/components/email-campaigns/SampleSendForm';
import GenerateAssetsModal from '@/components/email-campaigns/GenerateAssetsModal';
import { FiSave, FiZap } from 'react-icons/fi';

type NotificationPreference = (typeof NOTIFICATION_PREFERENCES)[number];

const DEFAULT_USER_NOTIFICATION_PREFERENCES: NotificationPreference[] = ['news', 'inspiration'];

function normalizeNotificationPreferences(
  values: string[] | null | undefined,
): NotificationPreference[] {
  if (!values || values.length === 0) {
    return [...DEFAULT_USER_NOTIFICATION_PREFERENCES];
  }
  return values.filter((value): value is NotificationPreference =>
    NOTIFICATION_PREFERENCES.includes(value as NotificationPreference),
  );
}

export default function CampaignDetailPage() {
  const preferenceOptions = NOTIFICATION_PREFERENCES;
  const { session, loading: authLoading } = useAdminAuth();
  const params = useParams();
  const campaignId = params.id as string;
  const router = useRouter();

  const [campaign, setCampaign] = useState<CampaignDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Editable metadata (only for draft)
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAudienceSource, setEditAudienceSource] = useState<CampaignAudienceSource>('leads');
  const [editUserNotificationPreferences, setEditUserNotificationPreferences] = useState<
    NotificationPreference[]
  >([...DEFAULT_USER_NOTIFICATION_PREFERENCES]);
  const [editDailyLimit, setEditDailyLimit] = useState('');
  const [editFilterTree, setEditFilterTree] = useState<FilterTree | null>(null);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [metaMessage, setMetaMessage] = useState<string | null>(null);

  // Audience count
  const [audienceCount, setAudienceCount] = useState<AudienceCount | null>(null);
  const [previousAudienceCount, setPreviousAudienceCount] = useState<AudienceCount | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);

  // Generate assets modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      setError(null);
      const data = await campaignClient.get(campaignId);
      setCampaign(data);

      // Populate edit fields
      setEditTitle(data.title);
      setEditDescription(data.description ?? '');
      setEditAudienceSource(data.audienceSource);
      setEditUserNotificationPreferences(
        normalizeNotificationPreferences(data.userNotificationPreferences),
      );
      setEditDailyLimit(data.dailySendLimit ? String(data.dailySendLimit) : '');
      setEditFilterTree(data.filterTree as FilterTree | null);
    } catch (err) {
      console.error('Error fetching campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!authLoading && session) {
      fetchCampaign();
    }
  }, [authLoading, session, fetchCampaign]);

  useEffect(() => {
    setAudienceCount(null);
    setPreviousAudienceCount(null);
  }, [campaignId]);

  // State transitions
  async function handleActivate() {
    setActionLoading(true);
    try {
      await campaignClient.activate(campaignId);
      await fetchCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate campaign');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    setActionLoading(true);
    try {
      await campaignClient.pause(campaignId);
      await fetchCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause campaign');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await campaignClient.cancel(campaignId);
      await fetchCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel campaign');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendBatch() {
    setActionLoading(true);
    try {
      await campaignClient.sendBatch(campaignId);
      await fetchCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send batch');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDuplicate() {
    setActionLoading(true);
    try {
      const duplicated = await campaignClient.duplicate(campaignId);
      router.push(`/email-campaigns/${duplicated.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate campaign');
    } finally {
      setActionLoading(false);
    }
  }

  // Save metadata
  async function handleSaveMetadata() {
    if (editAudienceSource !== 'leads' && editUserNotificationPreferences.length === 0) {
      setMetaMessage('Select at least one user notification preference');
      return;
    }

    setIsSavingMeta(true);
    setMetaMessage(null);
    try {
      const updateData: UpdateCampaignInput = {
        title: editTitle,
        description: editDescription || null,
        audienceSource: editAudienceSource,
        userNotificationPreferences: editUserNotificationPreferences,
        dailySendLimit: editDailyLimit ? parseInt(editDailyLimit, 10) : null,
        filterTree: editFilterTree,
      };
      await campaignClient.update(campaignId, updateData);
      await fetchCampaign();
      setMetaMessage('Campaign updated');
      setTimeout(() => setMetaMessage(null), 3000);
    } catch (err) {
      setMetaMessage(err instanceof Error ? err.message : 'Failed to update campaign');
    } finally {
      setIsSavingMeta(false);
    }
  }

  // Asset save
  async function handleSaveAsset(asset: CampaignAssetInput) {
    await campaignClient.update(campaignId, { assets: [asset] });
    await fetchCampaign();
  }

  // Asset delete
  async function handleDeleteAsset(id: string) {
    const response = await fetch(`/api/email-campaigns/${campaignId}?deleteAsset=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!response.ok) throw new Error('Failed to delete asset');
    await fetchCampaign();
  }

  // Handle AI-generated assets: save all locales then refresh
  async function handleGeneratedAssets(
    assets: Record<string, { subject: string; htmlBody: string; textBody: string }>,
  ) {
    try {
      const assetInputs = Object.entries(assets).map(([locale, asset]) => ({
        language: locale,
        subject: asset.subject,
        htmlBody: asset.htmlBody,
        textBody: asset.textBody,
      }));
      await campaignClient.update(campaignId, { assets: assetInputs });
      await fetchCampaign();
    } catch (err) {
      console.error('Error saving generated assets:', err);
      setError(err instanceof Error ? err.message : 'Failed to save generated assets');
    }
  }

  // Audience estimate
  async function handleEstimateAudience() {
    setIsEstimating(true);
    try {
      const count = await campaignClient.getAudienceCount(campaignId, {
        audienceSource: editAudienceSource,
        userNotificationPreferences: editUserNotificationPreferences,
        filterTree: editFilterTree,
      });
      setPreviousAudienceCount(audienceCount);
      setAudienceCount(count);
    } catch (err) {
      console.error('Error estimating audience:', err);
    } finally {
      setIsEstimating(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const isDraft = campaign.status === 'draft';
  const availableLocales = campaign.assets.map((a) => a.language);
  const audienceDeltaTotal =
    audienceCount && previousAudienceCount
      ? audienceCount.total - previousAudienceCount.total
      : null;

  return (
    <div className={`p-6 max-w-7xl mx-auto ${isDraft ? 'pb-20' : ''}`}>
      <CampaignDetailHeader
        title={campaign.title}
        status={campaign.status}
        isDraft={isDraft}
        onActivate={handleActivate}
        onPause={handlePause}
        onCancel={handleCancel}
        onSendBatch={handleSendBatch}
        onDuplicate={handleDuplicate}
        isLoading={actionLoading}
      />

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Metadata section */}
        {isDraft && (
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body">
              <h3 className="card-title text-sm mb-3">Campaign Details</h3>

              {metaMessage && (
                <div className="alert alert-info alert-sm py-2 mb-3">
                  <span className="text-sm">{metaMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Title</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-full"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Audience Source</span>
                  </label>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={editAudienceSource}
                    onChange={(e) =>
                      setEditAudienceSource(e.target.value as CampaignAudienceSource)
                    }
                  >
                    <option value="leads">Leads only</option>
                    <option value="users">Users only</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                {editAudienceSource !== 'leads' && (
                  <div className="form-control md:col-span-2">
                    <label className="label py-1">
                      <span className="label-text text-sm">User Notification Preferences</span>
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {preferenceOptions.map((value) => (
                        <label key={value} className="label cursor-pointer gap-2">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={editUserNotificationPreferences.includes(value)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...editUserNotificationPreferences, value]
                                : editUserNotificationPreferences.filter((pref) => pref !== value);
                              setEditUserNotificationPreferences(next);
                            }}
                          />
                          <span className="label-text capitalize">{value.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                    <label className="label py-1">
                      <span className="label-text-alt text-base-content/60">
                        Applied when users are included in the audience.
                      </span>
                    </label>
                  </div>
                )}

                <div className="form-control md:col-span-2">
                  <label className="label py-1">
                    <span className="label-text text-sm">Description</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered textarea-sm w-full"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Daily Send Limit</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm w-full"
                    placeholder="Unlimited"
                    value={editDailyLimit}
                    onChange={(e) => setEditDailyLimit(e.target.value)}
                    min={1}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Non-draft metadata display */}
        {!isDraft && (
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body">
              <h3 className="card-title text-sm mb-2">Campaign Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-base-content/50 text-xs">Audience</span>
                  <p className="font-medium capitalize">{campaign.audienceSource}</p>
                </div>
                {campaign.audienceSource !== 'leads' && (
                  <div>
                    <span className="text-base-content/50 text-xs">User Preferences</span>
                    <p className="font-medium">
                      {(campaign.userNotificationPreferences?.length
                        ? campaign.userNotificationPreferences
                        : ['news', 'inspiration']
                      )
                        .map((value) => value.replace('_', ' '))
                        .join(', ')}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-base-content/50 text-xs">Daily Limit</span>
                  <p className="font-medium">{campaign.dailySendLimit ?? 'Unlimited'}</p>
                </div>
                <div>
                  <span className="text-base-content/50 text-xs">Created By</span>
                  <p className="font-medium truncate">{campaign.createdBy}</p>
                </div>
                <div>
                  <span className="text-base-content/50 text-xs">Created At</span>
                  <p className="font-medium">{new Date(campaign.createdAt).toLocaleString()}</p>
                </div>
              </div>
              {campaign.description && (
                <p className="text-sm text-base-content/70 mt-2">{campaign.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <CampaignFilterEditor
          audienceSource={editAudienceSource}
          filterTree={editFilterTree}
          onChange={setEditFilterTree}
          onEstimate={handleEstimateAudience}
          audienceCount={audienceCount}
          audienceDeltaTotal={audienceDeltaTotal}
          isEstimating={isEstimating}
          readOnly={!isDraft}
        />

        {/* Assets */}
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title text-sm">Email Assets</h3>
              {isDraft && (
                <button
                  className="btn btn-sm btn-outline btn-warning gap-1"
                  onClick={() => setGenerateModalOpen(true)}
                >
                  <FiZap /> Generate Email Assets
                </button>
              )}
            </div>
            <CampaignAssetEditor
              assets={campaign.assets}
              onSave={handleSaveAsset}
              onDelete={handleDeleteAsset}
              readOnly={!isDraft}
            />
          </div>
        </div>

        {/* Generate Assets Modal */}
        <GenerateAssetsModal
          campaignId={campaignId}
          open={generateModalOpen}
          onClose={() => setGenerateModalOpen(false)}
          onComplete={handleGeneratedAssets}
        />

        {/* Sample Send */}
        {availableLocales.length > 0 && (
          <SampleSendForm
            campaignId={campaignId}
            availableLocales={availableLocales}
            assets={campaign.assets}
          />
        )}

        {/* Progress & Batch History */}
        <div className="card bg-base-100 shadow-sm border border-base-200">
          <div className="card-body">
            <h3 className="card-title text-sm mb-3">Campaign Progress</h3>
            <CampaignProgress
              progress={campaign.progress}
              batches={campaign.batchHistory.batches}
              totalBatches={campaign.batchHistory.total}
            />
          </div>
        </div>
      </div>

      {/* Sticky Save Bar (draft only) */}
      {isDraft && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-base-300 bg-base-100/95 backdrop-blur-sm shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-base-content/60">
              {metaMessage && (
                <span className={metaMessage.includes('Failed') ? 'text-error' : 'text-success'}>
                  {metaMessage}
                </span>
              )}
            </div>
            <button
              className="btn btn-sm btn-primary gap-2"
              onClick={handleSaveMetadata}
              disabled={isSavingMeta}
            >
              {isSavingMeta ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <FiSave className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
