import eslint from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const tsFiles = ['**/*.{ts,tsx}']
const reactHooksRecommended = reactHooks.configs.flat.recommended

export default [
  {
    ignores: ['out/**', 'dist/**', 'release/**', 'node_modules/**', 'coverage/**']
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node
    }
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({ ...config, files: tsFiles })),
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-floating-promises': 'error'
    }
  },
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ...reactHooksRecommended,
    plugins: {
      ...reactHooksRecommended.plugins,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooksRecommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  prettier
]
