'use client';

import { useState } from 'react';
import type { MarketingCampaignAsset } from '@/db/schema/campaigns';
import type { CampaignAssetInput } from '@/lib/schemas/campaigns';
import VariablesPanel from './VariablesPanel';
import { FiSave, FiTrash2 } from 'react-icons/fi';

const LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

interface CampaignAssetEditorProps {
  assets: MarketingCampaignAsset[];
  onSave: (asset: CampaignAssetInput) => Promise<void>;
  onDelete: (assetId: string) => Promise<void>;
  readOnly?: boolean;
}

export default function CampaignAssetEditor({
  assets,
  onSave,
  onDelete,
  readOnly = false,
}: CampaignAssetEditorProps) {
  const [activeLocale, setActiveLocale] = useState<string>(LOCALES[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Local editable state per locale
  const [localEdits, setLocalEdits] = useState<
    Record<string, { subject: string; htmlBody: string; textBody: string }>
  >({});

  function getAssetForLocale(locale: string): MarketingCampaignAsset | undefined {
    return assets.find((a) => a.language === locale);
  }

  function getCurrentValues(locale: string) {
    const existing = getAssetForLocale(locale);
    const edits = localEdits[locale];
    return {
      subject: edits?.subject ?? existing?.subject ?? '',
      htmlBody: edits?.htmlBody ?? existing?.htmlBody ?? '',
      textBody: edits?.textBody ?? existing?.textBody ?? '',
    };
  }

  function updateField(locale: string, field: 'subject' | 'htmlBody' | 'textBody', value: string) {
    setLocalEdits((prev) => ({
      ...prev,
      [locale]: {
        ...getCurrentValues(locale),
        ...prev[locale],
        [field]: value,
      },
    }));
  }

  async function handleSave(locale: string) {
    const values = getCurrentValues(locale);
    if (!values.subject.trim() || !values.htmlBody.trim() || !values.textBody.trim()) {
      setMessage('All fields (subject, HTML body, text body) are required.');
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      await onSave({
        language: locale,
        subject: values.subject,
        htmlBody: values.htmlBody,
        textBody: values.textBody,
      });
      // Clear local edits for this locale (data now comes from props)
      setLocalEdits((prev) => {
        const next = { ...prev };
        delete next[locale];
        return next;
      });
      setMessage(`Asset saved for ${locale}`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save asset');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(locale: string) {
    const existing = getAssetForLocale(locale);
    if (!existing) return;

    setIsSaving(true);
    try {
      await onDelete(existing.id);
      setLocalEdits((prev) => {
        const next = { ...prev };
        delete next[locale];
        return next;
      });
      setMessage(`Asset removed for ${locale}`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to delete asset');
    } finally {
      setIsSaving(false);
    }
  }

  const current = getCurrentValues(activeLocale);
  const existingAsset = getAssetForLocale(activeLocale);
  const hasEdits = !!localEdits[activeLocale];

  return (
    <div className="space-y-4">
      {/* Locale tabs */}
      <div role="tablist" className="tabs tabs-bordered">
        {LOCALES.map((locale) => {
          const hasAsset = !!getAssetForLocale(locale);
          return (
            <button
              key={locale}
              role="tab"
              className={`tab ${activeLocale === locale ? 'tab-active' : ''}`}
              onClick={() => setActiveLocale(locale)}
            >
              {locale}
              {hasAsset && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-success inline-block" />
              )}
            </button>
          );
        })}
      </div>

      {message && (
        <div className="alert alert-info alert-sm py-2">
          <span className="text-sm">{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-3">
          {/* Subject */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-sm font-medium">Subject</span>
            </label>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-mono"
              placeholder="Email subject line (supports Handlebars)"
              value={current.subject}
              onChange={(e) => updateField(activeLocale, 'subject', e.target.value)}
              disabled={readOnly}
            />
          </div>

          {/* HTML Body */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-sm font-medium">HTML Body</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full font-mono text-xs leading-relaxed"
              placeholder="HTML email body (Handlebars template)"
              value={current.htmlBody}
              onChange={(e) => updateField(activeLocale, 'htmlBody', e.target.value)}
              rows={14}
              disabled={readOnly}
            />
          </div>

          {/* Text Body */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-sm font-medium">Text Body</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full font-mono text-xs"
              placeholder="Plaintext fallback body"
              value={current.textBody}
              onChange={(e) => updateField(activeLocale, 'textBody', e.target.value)}
              rows={6}
              disabled={readOnly}
            />
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className="flex gap-2 justify-end">
              {existingAsset && (
                <button
                  className="btn btn-sm btn-error btn-outline"
                  onClick={() => handleDelete(activeLocale)}
                  disabled={isSaving}
                >
                  <FiTrash2 /> Remove {activeLocale}
                </button>
              )}
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleSave(activeLocale)}
                disabled={isSaving || (!hasEdits && !!existingAsset)}
              >
                {isSaving ? <span className="loading loading-spinner loading-xs" /> : <FiSave />}
                {existingAsset ? 'Update' : 'Create'} Asset
              </button>
            </div>
          )}
        </div>

        {/* Variables panel */}
        <div>
          <VariablesPanel />
        </div>
      </div>
    </div>
  );
}
