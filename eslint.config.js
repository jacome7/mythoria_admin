import next from 'eslint-config-next';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const config = [
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['node_modules', '.next', 'out', 'dist', 'coverage'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['jest.config.cjs', 'jest.setup.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        jest: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['jest.setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['__tests__/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-useless-escape': 'off',
    },
  },
];

export default config;
