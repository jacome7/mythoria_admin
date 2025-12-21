#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  . "$PROJECT_ROOT/.env"
  set +a
fi
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  set -a
  . "$PROJECT_ROOT/.env.local"
  set +a
fi

npx tsx -e "import { envManifest } from './env.manifest.ts'; const required = envManifest.filter(v => v.required && v.scopes.includes('dev')).map(v => v.name); const missing = required.filter(name => !process.env[name]); if (missing.length) { console.error('Missing required env vars:', missing.join(', ')); process.exit(1); } console.log('All required env vars are present.');" \
  --cwd "$PROJECT_ROOT"
