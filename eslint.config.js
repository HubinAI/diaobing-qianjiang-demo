import js from '@eslint/js'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import tseslint from 'typescript-eslint'

const configDir = dirname(fileURLToPath(import.meta.url))

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', '*.png', '*.jpg', '*.tsbuildinfo', 'qa_*.cjs', 'vite.config.js', 'vitest.config.js', 'playwright.config.js', '*.config.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', '*.config.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: configDir,
      },
      globals: {
        document: 'readonly',
        window: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        PointerEvent: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
