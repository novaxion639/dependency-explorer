import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig(
  globalIgnores(['**/dist/', '**/coverage/', '.pinned/', 'packages/web/overlay/']),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      curly: ['error', 'all'],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    files: ['packages/web/src/**/*.tsx'],
    extends: [jsxA11y.flatConfigs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'jsx-a11y/label-has-associated-control': ['error', { controlComponents: ['SkCheckbox'], depth: 3 }],
    },
  },
  {
    files: ['packages/web/src/components/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@dependency-explorer/data',
          importNames: ['connectivityMap', 'resourceSurface', 'listenerSurface', 'allResourceRelations', 'resourceNotes'],
          message: 'Components take the dataset as props; the shell reads it.',
        }],
        patterns: [{ group: ['**/shell/dataIndexes'], message: 'Components take the dataset as props; the shell reads it.' }],
      }],
    },
  },
)
