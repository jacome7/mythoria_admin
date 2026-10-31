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

const SURVEY_VARIABLES: Variable[] = [
  {
    name: '{{surveyLink}}',
    description: 'Tracked personal survey link (required)',
    availableFor: 'Survey',
  },
  {
    name: '{{surveyDeadline}}',
    description: 'Study close date (localized)',
    availableFor: 'Survey',
  },
  {
    name: '{{surveyMinutes}}',
    description: 'Estimated minutes to complete',
    availableFor: 'Survey',
  },
  {
    name: '{{rewardDeadline}}',
    description: 'Gift claim deadline (localized, empty if none)',
    availableFor: 'Survey',
  },
  {
    name: '{{privacyLink}}',
    description: 'Privacy policy URL (localized)',
    availableFor: 'Survey',
  },
];

interface VariablesPanelProps {
  /** Survey campaigns (audienceSource = survey_invitations) also get the survey variables. */
  isSurveyCampaign?: boolean;
}

export default function VariablesPanel({ isSurveyCampaign = false }: VariablesPanelProps) {
  const variables = isSurveyCampaign
    ? [...AVAILABLE_VARIABLES, ...SURVEY_VARIABLES]
    : AVAILABLE_VARIABLES;

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
        {isSurveyCampaign && (
          <p className="text-xs text-base-content/60 mb-2">
            Survey emails must include surveyLink and unsubscribeLink in both bodies, plus
            physicalAddress in the HTML body.
          </p>
        )}
        <div className="space-y-1">
          {variables.map((v) => (
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
