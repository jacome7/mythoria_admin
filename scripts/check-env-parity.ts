// Environment variable parity / validation script for mythoria_admin service.
// Inspired by mythoria-webapp/scripts/check-env-parity.ts; adjusted for admin-specific manifest.
// Validates presence & scope of vars across:
//  - env.manifest.ts (canonical list)
//  - .env.local (dev values)
//  - .env.production (optional prod template; should not contain live secrets)
//  - cloudbuild.yaml (substitutions, set-env-vars, set-secrets)
// Exit code 1 if any Missing violations; other violations reported but do not fail build unless Missing.

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import { envManifest, manifestByName } from '../env.manifest';

interface SourceMaps {
  dev: Record<string, string | undefined>;
  prodFile: Record<string, string | undefined>;
  cloudBuildSubstitutions: Record<string, string | undefined>;
  cloudBuildSetEnv: Record<string, string | undefined>;
  cloudBuildSecrets: Set<string>;
  buildArgs: Set<string>;
}

const root = path.resolve(__dirname, '..');

function readEnvFile(name: string): Record<string, string | undefined> {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) return {};
  return dotenv.parse(fs.readFileSync(p, 'utf8'));
}

function parseCloudBuild(): Partial<SourceMaps> {
  const file = path.join(root, 'cloudbuild.yaml');
  if (!fs.existsSync(file)) return {};
  const doc = yaml.load(fs.readFileSync(file, 'utf8')) as any;
  const substitutions: Record<string, string> = doc?.substitutions || {};
  const setEnv: Record<string, string> = {};
  const secrets = new Set<string>();
  const buildArgs = new Set<string>();

  for (const step of doc?.steps || []) {
    if (Array.isArray(step.args)) {
      const args: string[] = step.args;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--set-env-vars' && args[i + 1]) {
          args[i + 1].split(',').forEach((p) => {
            const [k, v] = p.split('=');
            if (k) setEnv[k.trim()] = (v || '').trim();
          });
        }
        if (args[i] === '--set-secrets' && args[i + 1]) {
          args[i + 1].split(',').forEach((p) => {
            const [k] = p.split('=');
            if (k) secrets.add(k.trim());
          });
        }
      }
      // Detect build args patterns --build-arg NAME=VALUE
      for (const a of args) {
        if (typeof a === 'string') {
          const re = /--build-arg\s+([A-Z0-9_]+)=/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(a))) buildArgs.add(m[1]);
        }
      }
    }
  }

  // Fallback heuristic parsing if structured traversal produced no secrets or envs.
  if (secrets.size === 0) {
    const raw = fs.readFileSync(file, 'utf8');
    const secretLineMatch = raw.match(/--set-secrets[^\n]*\n\s*-\s*'([^']+)'/);
    if (secretLineMatch) {
      secretLineMatch[1].split(',').forEach((pair) => {
        const [k] = pair.split('=');
        if (k) secrets.add(k.trim());
      });
    }
  }
  if (Object.keys(setEnv).length === 0) {
    const raw = fs.readFileSync(file, 'utf8');
    const envLineMatch = raw.match(/--set-env-vars[^\n]*\n\s*-\s*'([^']+)'/);
    if (envLineMatch) {
      envLineMatch[1].split(',').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) setEnv[k.trim()] = (v || '').trim();
      });
    }
  }

  return {
    cloudBuildSubstitutions: substitutions,
    cloudBuildSetEnv: setEnv,
    cloudBuildSecrets: secrets,
    buildArgs,
  };
}

interface Violation {
  type: 'Missing' | 'Empty' | 'Unexpected' | 'DeprecatedPresent';
  key: string;
  detail?: string;
}

function analyze(src: SourceMaps) {
  const manifest = manifestByName();
  const violations: Violation[] = [];
  const allKeys = new Set<string>([
    ...Object.keys(src.dev),
    ...Object.keys(src.prodFile),
    ...Object.keys(src.cloudBuildSubstitutions),
    ...Object.keys(src.cloudBuildSetEnv),
    ...Array.from(src.cloudBuildSecrets),
    ...Array.from(src.buildArgs),
    ...envManifest.map((v) => v.name),
  ]);

  function hasInScope(key: string, scope: string): boolean {
    switch (scope) {
      case 'dev':
        return src.dev[key] !== undefined; // presence only
      case 'build':
        return src.buildArgs.has(key) || src.cloudBuildSubstitutions[key] !== undefined;
      case 'runtime': {
        if (src.cloudBuildSetEnv[key] !== undefined || src.cloudBuildSecrets.has(key)) return true;
        const subKey = `_${key}`;
        if (src.cloudBuildSubstitutions[subKey] !== undefined) {
          // If substitution exists assume deployment will inject via --set-env-vars even if parsing failed; best-effort.
          return true;
        }
        return false;
      }
      case 'prod':
        return true; // satisfied by runtime/build checks
      case 'public':
        return /^(NEXT_PUBLIC_|PUBLIC_)/.test(key);
      default:
        return false;
    }
  }

  for (const key of allKeys) {
    if (key.startsWith('_')) continue; // substitution keys not in manifest
    const desc = manifest[key];
    if (!desc) {
      violations.push({ type: 'Unexpected', key, detail: 'Not defined in env.manifest.ts' });
      continue;
    }
    if (desc.deprecated) {
      // If deprecated still appears in any non-substitution source, warn
      if (
        src.cloudBuildSetEnv[key] !== undefined ||
        src.dev[key] !== undefined ||
        src.prodFile[key] !== undefined
      ) {
        violations.push({
          type: 'DeprecatedPresent',
          key,
          detail: 'Deprecated variable still present',
        });
      }
    }
    if (desc.required) {
      for (const scope of desc.scopes) {
        if (!hasInScope(key, scope)) {
          violations.push({ type: 'Missing', key, detail: `Missing in scope ${scope}` });
        }
      }
    }
    if (desc.required && desc.scopes.includes('dev')) {
      const v = src.dev[key];
      if (v !== undefined && v.trim() === '')
        violations.push({ type: 'Empty', key, detail: '.env.local empty value' });
    }
  }
  return violations;
}

function main() {
  const dev = readEnvFile('.env.local');
  const prodFile = readEnvFile('.env.production');
  const cloud = parseCloudBuild();
  const sources: SourceMaps = {
    dev,
    prodFile,
    cloudBuildSubstitutions: cloud.cloudBuildSubstitutions || {},
    cloudBuildSetEnv: cloud.cloudBuildSetEnv || {},
    cloudBuildSecrets: cloud.cloudBuildSecrets || new Set(),
    buildArgs: cloud.buildArgs || new Set(),
  };
  const violations = analyze(sources);
  const grouped = violations.reduce<Record<string, Violation[]>>((a, v) => {
    (a[v.type] ||= []).push(v);
    return a;
  }, {});
  const order: Violation['type'][] = ['Missing', 'Empty', 'Unexpected', 'DeprecatedPresent'];
  if (violations.length === 0) {
    console.log('✅ Admin environment parity check passed.');
    process.exit(0);
  }
  console.log('Environment parity issues (admin):');
  for (const t of order) {
    const list = grouped[t];
    if (!list || list.length === 0) continue;
    console.log(`\n== ${t} ==`);
    for (const v of list) console.log(` - ${v.key.padEnd(30, ' ')} ${v.detail || ''}`);
  }
  process.exit(grouped['Missing']?.length ? 1 : 0);
}

if (process.argv[1] && /check-env-parity\.ts$/.test(process.argv[1])) {
  main();
}
