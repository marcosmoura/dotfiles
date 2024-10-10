// @ts-check

import eslint from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import eslintConfigPrettier from 'eslint-config-prettier';
import { flatConfigs } from 'eslint-plugin-import';
import oxlint from 'eslint-plugin-oxlint';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  // @ts-expect-error - The comments plugin doesn't override the TS types
  comments.recommended,
  flatConfigs.recommended,
  flatConfigs.typescript,
  eslintPluginUnicorn.configs['flat/recommended'],
  eslintConfigPrettier,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^[a-z]+|(@[a-z]+)'],
            ['^@/'],
            [
              '^@/utils/(.*)$',
              '^@/config/(.*)$',
              '^@/components/(.*)$',
              '^@/modules/(.*)$',
              '^@/assets/(.*)$',
            ],
            ['^[../]'],
            ['^[./]'],
          ],
        },
      ],
    },
  },
  oxlint.configs['flat/recommended'],
  {
    rules: {
      'import/default': 'off',
      'import/export': 'off',
      'import/first': 'error',
      'import/named': 'off',
      'import/namespace': 'off',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off',
      'unicorn/filename-case': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'off',
    },
  },
);
