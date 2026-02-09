'use client';

import { FiCopy, FiInfo } from 'react-icons/fi';

interface Variable {
  name: string;
  description: string;
  availableFor: string;
}

const AVAILABLE_VARIABLES: Variable[] = [
  { name: '{{name}}', description: 'Full name', availableFor: 'Users + Leads' },
  { name: '{{firstName}}', description: 'First name (extracted)', availableFor: 'Users + Leads' },
  { name: '{{email}}', description: 'Email address', availableFor: 'Users + Leads' },
  { name: '{{trackingPixelUrl}}', description: 'Open tracking pixel', availableFor: 'Leads' },
  { name: '{{signUpLink}}', description: 'Sign-up CTA with tracking', availableFor: 'Leads' },
  {
    name: '{{unsubscribeLink}}',
    description: 'One-click unsubscribe',
    availableFor: 'Users + Leads',
  },
  { name: '{{homepageLink}}', description: 'Homepage with tracking', availableFor: 'Leads' },
  { name: '{{termsLink}}', description: 'Terms and conditions link', availableFor: 'Leads' },
  {
    name: '{{physicalAddress}}',
    description: 'Company physical address',
    availableFor: 'Users + Leads',
  },
];

export default function VariablesPanel() {
  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(console.error);
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-200">
      <div className="card-body py-3 px-4">
        <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
          <FiInfo className="text-info" />
          Template Variables
        </h4>
        <div className="space-y-1">
          {AVAILABLE_VARIABLES.map((v) => (
            <div
              key={v.name}
              className="flex items-center justify-between text-xs hover:bg-base-200 rounded px-1 py-0.5 cursor-pointer group"
              onClick={() => copyToClipboard(v.name)}
              title={`Click to copy ${v.name}`}
            >
              <div>
                <code className="text-primary font-mono">{v.name}</code>
                <span className="text-base-content/60 ml-2">{v.description}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-base-content/40">{v.availableFor}</span>
                <FiCopy className="opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
