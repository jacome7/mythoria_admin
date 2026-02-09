'use client';

import { useState } from 'react';
import { campaignClient } from '@/lib/campaignClient';
import { FiSend } from 'react-icons/fi';

const LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

interface SampleSendFormProps {
  campaignId: string;
  availableLocales: string[];
}

export default function SampleSendForm({ campaignId, availableLocales }: SampleSendFormProps) {
  const [locale, setLocale] = useState(availableLocales[0] ?? 'en-US');
  const [email, setEmail] = useState('');
  const [variablesJson, setVariablesJson] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Email address is required.' });
      return;
    }

    let variables: Record<string, unknown> | undefined;
    if (variablesJson.trim()) {
      try {
        variables = JSON.parse(variablesJson);
      } catch {
        setMessage({ type: 'error', text: 'Invalid JSON in variables field.' });
        return;
      }
    }

    setIsSending(true);
    setMessage(null);

    try {
      await campaignClient.sendSample(campaignId, { locale, email: email.trim(), variables });
      setMessage({ type: 'success', text: `Sample email sent to ${email.trim()}` });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send sample email',
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-200">
      <div className="card-body">
        <h3 className="card-title text-sm">
          <FiSend className="text-base-content/60" />
          Send Sample Email
        </h3>

        {message && (
          <div
            className={`alert alert-sm py-2 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
          >
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-3 mt-2">
          <div className="flex gap-3">
            <div className="form-control flex-1">
              <label className="label py-0.5">
                <span className="label-text text-xs">Locale</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              >
                {LOCALES.map((l) => (
                  <option key={l} value={l} disabled={!availableLocales.includes(l)}>
                    {l} {availableLocales.includes(l) ? '' : '(no asset)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control flex-[2]">
              <label className="label py-0.5">
                <span className="label-text text-xs">Recipient Email</span>
              </label>
              <input
                type="email"
                className="input input-bordered input-sm w-full"
                placeholder="test@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label py-0.5">
              <span className="label-text text-xs">Custom Variables (JSON, optional)</span>
            </label>
            <textarea
              className="textarea textarea-bordered textarea-xs font-mono w-full"
              placeholder='{"name": "Test User", "firstName": "Test"}'
              value={variablesJson}
              onChange={(e) => setVariablesJson(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-sm btn-outline btn-info" disabled={isSending}>
              {isSending ? <span className="loading loading-spinner loading-xs" /> : <FiSend />}
              Send Sample
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
