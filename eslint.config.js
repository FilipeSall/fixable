import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import reactHooks from 'eslint-plugin-react-hooks';

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
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
