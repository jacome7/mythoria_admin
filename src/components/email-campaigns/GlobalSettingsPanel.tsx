'use client';

import { useEffect, useState, useCallback } from 'react';
import { campaignClient } from '@/lib/campaignClient';
import { FiSettings, FiSave } from 'react-icons/fi';

interface GlobalConfig {
  paused: boolean;
  batchSize: number;
  sendWindowStart: string | null;
  sendWindowEnd: string | null;
  timezone: string;
}

export default function GlobalSettingsPanel() {
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [batchSize, setBatchSize] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const data = (await campaignClient.getGlobalConfig()) as GlobalConfig;
      const nextBatchSize = Number.isFinite(data.batchSize) ? data.batchSize : 100;
      setConfig(data);
      setBatchSize(nextBatchSize);
    } catch (err) {
      console.error('Error fetching global config:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSaveBatchSize() {
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = (await campaignClient.updateGlobalConfig({ batchSize })) as GlobalConfig;
      setConfig(updated);
      setMessage('Batch size updated');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update batch size');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body">
          <div className="loading loading-spinner loading-md mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-200">
      <div className="card-body">
        <h3 className="card-title text-sm gap-2">
          <FiSettings className="text-base-content/60" />
          Global Send Settings
        </h3>

        {message && (
          <div className="alert alert-info alert-sm py-2 mt-2">
            <span className="text-sm">{message}</span>
          </div>
        )}

        {/* Batch size slider */}
        <div className="form-control mt-2">
          <label className="label pb-0">
            <span className="label-text text-sm">Batch Size: {batchSize}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="range range-sm range-primary flex-1"
            />
            <button
              className="btn btn-sm btn-outline btn-primary"
              onClick={handleSaveBatchSize}
              disabled={isSaving || batchSize === config?.batchSize}
            >
              {isSaving ? <span className="loading loading-spinner loading-xs" /> : <FiSave />}
            </button>
          </div>
          <label className="label pt-0">
            <span className="label-text-alt text-base-content/50">10 - 500 emails per cycle</span>
          </label>
        </div>

        {/* Send window info */}
        {config && (
          <div className="text-xs text-base-content/60 mt-1">
            <span>
              Send window: {config.sendWindowStart ?? 'Any'} - {config.sendWindowEnd ?? 'Any'}
            </span>
            <span className="ml-2">({config.timezone})</span>
          </div>
        )}
      </div>
    </div>
  );
}
