import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Ignore generated and external artifacts to reduce noise and speed up linting.
    ignores: [
      '.next/**',
      'public/**',
      'logs/**',
      'drizzle/**/*.sql',
      // Auto-generated TypeScript helper / metadata files
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
      // Common codegen output conventions (add more here as tooling is introduced)
      '**/__generated__/**',
      '**/*.generated.*',
      '**/*.gen.*',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
];

export default eslintConfig;
