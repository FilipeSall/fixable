import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import reactHooks from 'eslint-plugin-react-hooks';
import jsdoc from 'eslint-plugin-jsdoc';

export default tseslint.config(
  {
    ignores: ['*.html', 'assets/**', '**/node_modules/**', '**/dist/**', '**/.astro/**', '**/playwright-report/**', '**/test-results/**', 'docs/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  sonarjs.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['apps/api/src/mailers/smtp.mailer.ts'],
    rules: { 'sonarjs/no-clear-text-protocols': 'off' },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: { 'max-lines': ['error', { max: 700 }] },
  },
  {
    files: ['apps/api/src/**/*.ts', 'apps/site/src/**/*.{ts,tsx}', 'packages/shared/src/**/*.ts'],
    ignores: ['**/*.test.{ts,tsx}', '**/tests/**', '**/e2e/**', '**/*.d.ts'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          contexts: ['VariableDeclarator > ArrowFunctionExpression', 'VariableDeclarator > FunctionExpression'],
        },
      ],
      'jsdoc/require-description': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
