// @ts-check
import tseslint from 'typescript-eslint';

/** Dependency rule of CLAUDE.md (NFR-2): only src/sources/ may import a source SDK. */
const sourceSdkOutsideSources = {
  files: ['src/**/*.ts'],
  ignores: ['src/sources/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [{ name: '@immich/sdk', message: 'Only src/sources/ imports the Immich SDK.' }],
        patterns: [{ group: ['@immich/sdk/*'], message: 'Only src/sources/ imports the Immich SDK.' }],
      },
    ],
  },
};

/** src/triage/ is the functional core: it imports nothing from store, effects, sources or node:fs. */
const pureTriageCore = {
  files: ['src/triage/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [{ name: '@immich/sdk', message: 'Only src/sources/ imports the Immich SDK.' }],
        patterns: [
          {
            group: ['../store/**', '../effects', '../effects.js', '../fs', '../fs.js', '../sources/**', '../commands/**', '../cli.js', 'node:fs', 'node:fs/*', '@immich/sdk/*'],
            message: 'src/triage/ imports nothing from store, effects, sources, commands or the file system.',
          },
        ],
      },
    ],
  },
};

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'data/**'] },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Named exports only.' },
      ],
    },
  },
  { files: ['vitest.config.ts'], rules: { 'no-restricted-syntax': 'off' } },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // `expect.any()` and friends are typed `any` by vitest; a `json<T>()` reader is the idiom here.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
  sourceSdkOutsideSources,
  pureTriageCore,
);
