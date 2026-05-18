import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const config = [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      // Pre-existing style preferences — keep as warnings, don't block CI
      'react/no-unescaped-entities':         'warn',
      '@next/next/no-html-link-for-pages':   'warn',
      '@typescript-eslint/no-var-requires':  'off',
    },
  },
]

export default config
