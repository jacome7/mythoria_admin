'use client';

import { useMemo } from 'react';
import Handlebars from 'handlebars';
import { FiX } from 'react-icons/fi';

interface TemplatePreviewModalProps {
  open: boolean;
  onClose: () => void;
  subject: string;
  htmlBody: string;
  locale: string;
  variablesJson: string;
}

export default function TemplatePreviewModal({
  open,
  onClose,
  subject,
  htmlBody,
  locale,
  variablesJson,
}: TemplatePreviewModalProps) {
  const { renderedSubject, renderedHtml, error } = useMemo(() => {
    let variables: Record<string, unknown> = {};
    if (variablesJson.trim()) {
      try {
        variables = JSON.parse(variablesJson);
      } catch {
        return { renderedSubject: '', renderedHtml: '', error: 'Invalid JSON in variables field.' };
      }
    }

    try {
      const subjectTemplate = Handlebars.compile(subject || '');
      const bodyTemplate = Handlebars.compile(htmlBody || '');
      return {
        renderedSubject: subjectTemplate(variables),
        renderedHtml: bodyTemplate(variables),
        error: null,
      };
    } catch (err) {
      return {
        renderedSubject: '',
        renderedHtml: '',
        error: `Template compilation error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }, [subject, htmlBody, variablesJson]);

  if (!open) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl h-[85vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-base-300">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base truncate">Template Preview</h3>
            <p className="text-xs text-base-content/60 mt-0.5">
              Locale: <span className="font-mono">{locale}</span>
            </p>
          </div>
          <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error alert-sm mx-5 mt-3 py-2">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Subject preview */}
        {!error && renderedSubject && (
          <div className="px-5 pt-3 pb-2 border-b border-base-200">
            <p className="text-xs text-base-content/50 mb-0.5">Subject</p>
            <p className="text-sm font-medium">{renderedSubject}</p>
          </div>
        )}

        {/* Body preview in isolated iframe */}
        {!error && (
          <div className="flex-1 min-h-0 p-3">
            <iframe
              srcDoc={renderedHtml}
              title="Email template preview"
              className="w-full h-full border border-base-300 rounded-lg bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        {/* Footer */}
        <div className="modal-action px-5 py-3 border-t border-base-300 mt-0">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
