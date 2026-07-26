/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: ['./tsconfig.json', './tsconfig.test.json'],
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier',
  ],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  env: {
    browser: true,
    es2022: true,
  },
  overrides: [
    {
      // Test files: relax rules that are impractical with vi.stubGlobal mocks
      files: ['tests/**/*.ts'],
      parserOptions: { project: ['./tsconfig.test.json'] },
      env: { node: true },
      rules: {
        'no-console': 'off',
        // Mock objects from vi.stubGlobal are typed as `any` — disable unsafe checks
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        // Async mock implementations often don't need await
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      // Config and scripts: not part of the typed project
      files: ['scripts/**/*.mjs', 'vite.config.ts', 'vitest.config.ts'],
      parserOptions: { project: null },
      env: { node: true },
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', '*.mjs'],
};
