// Canonical environment variable manifest for Mythoria Admin Portal
// Pattern mirrors mythoria-webapp/env.manifest.ts; keep in sync conceptually but
// this file is authoritative for the admin service.
// Scopes:
//  - dev: required/present for local development (.env.local)
//  - prod: conceptually required in production deployment (Cloud Run)
//  - build: needed at image build / Next.js build phase
//  - runtime: must be provided to the running container (via --set-env-vars or secrets)
//  - public: exposed to the browser (must use NEXT_PUBLIC_ prefix)
// Notes:
//  * For secrets we rely on Cloud Build --set-secrets mapping; values should not appear in .env.production.
//  * If a var is optional we set required:false and explain defaults.
//  * Some variables (GOOGLE_CLOUD_REGION) appear in deployment config but are unused in code; flagged deprecated.

export type EnvScope = 'dev' | 'prod' | 'build' | 'runtime' | 'public';
export interface EnvVarDescriptor {
  name: string;
  required: boolean;
  scopes: EnvScope[];
  secret?: boolean;
  public?: boolean;
  default?: string;
  source?: 'secret-manager' | 'substitution' | 'inline';
  note?: string;
  deprecated?: boolean;
}

export const envManifest: EnvVarDescriptor[] = [
  // Core environment
  {
    name: 'NODE_ENV',
    required: true,
    scopes: ['prod', 'runtime'],
    default: 'development',
    note: 'Framework provided.',
  },
  {
    name: 'PORT',
    required: false,
    scopes: ['dev', 'runtime'],
    default: '3001',
    note: 'Local dev port override.',
  },
  { name: 'NEXT_PHASE', required: false, scopes: ['build'], note: 'Next.js build phase sentinel.' },

  // Authentication (NextAuth with Google OAuth)
  {
    name: 'GOOGLE_CLIENT_ID',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    source: 'substitution',
    note: 'Google OAuth client id; build scope not enforced (server-only usage).',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: true,
    scopes: ['prod', 'runtime'],
    secret: true,
    source: 'secret-manager',
    note: 'Secret for Google OAuth; injected via Secret Manager.',
  },
  {
    name: 'AUTH_SECRET',
    required: true,
    scopes: ['prod', 'runtime'],
    secret: true,
    source: 'secret-manager',
    note: 'NextAuth secret for JWT/session encryption.',
  },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'http://localhost:3001',
    source: 'substitution',
    note: 'Base URL for NextAuth callbacks (also duplicated as AUTH_URL).',
  },
  {
    name: 'AUTH_URL',
    required: false,
    scopes: ['prod', 'runtime', 'dev'],
    note: 'Legacy alias for NEXTAUTH_URL referenced in debug route.',
  },

  // Public facing (rare for admin - only admin base and app base for story links)
  {
    name: 'NEXT_PUBLIC_ADMIN_URL',
    required: false,
    scopes: ['prod', 'build', 'public', 'dev'],
    default: 'http://localhost:3001',
    note: 'Used in sign-in UI for constructing links.',
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: false,
    scopes: ['prod', 'build', 'public', 'dev'],
    default: 'https://mythoria.pt',
    note: 'Used to build links back to main app (AdminStoryReader component).',
  },

  // Databases (connection details shared across three logical DBs)
  {
    name: 'DB_HOST',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    secret: true,
    source: 'secret-manager',
    note: 'Primary Cloud SQL host / private IP.',
  },
  {
    name: 'DB_PORT',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: '5432',
    source: 'substitution',
  },
  {
    name: 'DB_USER',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    secret: true,
    source: 'secret-manager',
  },
  {
    name: 'DB_PASSWORD',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    secret: true,
    source: 'secret-manager',
  },
  {
    name: 'DB_MAX_CONNECTIONS',
    required: false,
    scopes: ['prod', 'runtime', 'dev'],
    default: '10',
    note: 'Optional pool max size override.',
  },
  // Individual database names (non-secret, can be substitutions)
  {
    name: 'MYTHORIA_DB',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'mythoria_db',
    source: 'substitution',
    note: 'Core shared schema (read-only here).',
  },
  {
    name: 'WORKFLOWS_DB',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'workflows_db',
    source: 'substitution',
    note: 'Workflow telemetry DB (read-only here).',
  },
  {
    name: 'BACKOFFICE_DB',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'backoffice_db',
    source: 'substitution',
    note: 'Admin-owned DB (migrations in this repo).',
  },

  // Upstream service URLs & API keys
  {
    name: 'WEBAPP_URL',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'http://localhost:3000',
    source: 'substitution',
    note: 'Base URL to the public web app (health + linking).',
  },
  {
    name: 'ADMIN_URL',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'http://localhost:3001',
    source: 'substitution',
    note: 'Self URL for health / introspection.',
  },
  {
    name: 'STORY_GENERATION_WORKFLOW_URL',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'http://localhost:8080',
    source: 'substitution',
  },
  {
    name: 'NOTIFICATION_ENGINE_URL',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'http://localhost:8081',
    source: 'substitution',
  },
  {
    name: 'NOTIFICATION_ENGINE_API_KEY',
    required: true,
    scopes: ['prod', 'runtime'],
    secret: true,
    source: 'secret-manager',
  },
  {
    name: 'ADMIN_API_KEY',
    required: true,
    scopes: ['prod', 'runtime'],
    secret: true,
    source: 'secret-manager',
    note: 'Internal API access protection.',
  },

  // Pub/Sub topics
  {
    name: 'GOOGLE_CLOUD_PROJECT_ID',
    required: true,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'oceanic-beach-460916-n5',
    source: 'substitution',
  },
  {
    name: 'PUBSUB_TOPIC',
    required: false,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'mythoria-story-requests',
    source: 'substitution',
    note: 'Optional; defaults used if unset.',
  },
  {
    name: 'PUBSUB_AUDIOBOOK_TOPIC',
    required: false,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'mythoria-audiobook-requests',
    note: 'Optional – only if audiobook jobs are dispatched.',
  },
  {
    name: 'PUBSUB_TOPIC_PRINT',
    required: false,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'mythoria-print-requests',
    note: 'Optional print/PDF generation topic (generate-pdfs route).',
  },

  // Google Postmaster Tools API (for email deliverability monitoring)
  {
    name: 'POSTMASTER_DOMAIN',
    required: false,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'mythoria.pt',
    source: 'substitution',
    note: 'Domain to monitor via Postmaster Tools API.',
  },
  {
    name: 'POSTMASTER_SERVICE_ACCOUNT_EMAIL',
    required: false,
    scopes: ['prod', 'runtime', 'dev'],
    secret: true,
    source: 'secret-manager',
    note: 'Service account email for Postmaster API (same as Gmail service account).',
  },
  {
    name: 'POSTMASTER_SERVICE_ACCOUNT_KEY',
    required: false,
    scopes: ['prod', 'runtime'],
    secret: true,
    source: 'secret-manager',
    note: 'Service account private key JSON for Postmaster API authentication.',
  },
  {
    name: 'POSTMASTER_IMPERSONATE_EMAIL',
    required: false,
    scopes: ['prod', 'runtime', 'dev'],
    default: 'rodrigo.jacome@mythoria.pt',
    source: 'substitution',
    note: 'Email to impersonate for domain-wide delegation (must have Postmaster Tools access).',
  },

  // Deployment-only / deprecated
  {
    name: 'GOOGLE_CLOUD_REGION',
    required: false,
    scopes: ['prod'],
    default: 'europe-west9',
    note: 'Present in cloudbuild substitutions but unused in code.',
    deprecated: true,
  },
  // Legacy / deprecated variable names retained for transition (not required)
  {
    name: 'MYTHORIA_DB_NAME',
    required: false,
    scopes: ['prod'],
    default: 'mythoria_db',
    deprecated: true,
    note: 'Use MYTHORIA_DB instead.',
  },
  {
    name: 'WORKFLOWS_DB_NAME',
    required: false,
    scopes: ['prod'],
    default: 'workflows_db',
    deprecated: true,
    note: 'Use WORKFLOWS_DB instead.',
  },
  {
    name: 'BACKOFFICE_DB_NAME',
    required: false,
    scopes: ['prod'],
    default: 'backoffice_db',
    deprecated: true,
    note: 'Use BACKOFFICE_DB instead.',
  },
  {
    name: 'MYTHORIA_WEBAPP_URL',
    required: false,
    scopes: ['prod'],
    deprecated: true,
    note: 'Use WEBAPP_URL instead.',
  },
  {
    name: 'MYTHORIA_ADMIN_URL',
    required: false,
    scopes: ['prod'],
    deprecated: true,
    note: 'Use ADMIN_URL instead.',
  },
];

export function manifestByName(): Record<string, EnvVarDescriptor> {
  return Object.fromEntries(envManifest.map((d) => [d.name, d]));
}
