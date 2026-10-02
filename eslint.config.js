// ESLint flat config. See https://eslint.org/docs/latest/use/configure/configuration-files
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'data/raw/**',
      'data/processed/**',
      'docs/screenshots/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // eslint.config.js is plain JS and deliberately outside the TS
          // project; without this, type-aware linting cannot resolve it.
          allowDefaultProject: ['eslint.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // --- Architecture invariant: the engine stays framework-free ------------
  // This is the rule that keeps simulations testable headlessly, so a
  // violation is an architecture error, not a style preference.
  {
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message:
                'src/engine/ must not import React. The engine is framework-agnostic and runs headless. See AGENTS.md section 3.',
            },
            {
              group: ['@ui/*', '../ui/*', 'src/ui/*'],
              message:
                'src/engine/ must not import from src/ui/. See docs/ARCHITECTURE.md section 2.',
            },
          ],
        },
      ],
      // The engine may not reach for the DOM, or it stops running in Node.
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'Engine code must run in Node. Use an explicit host adapter instead.',
        },
      ],
    },
  },

  // --- Architecture invariant: shared/ is the framework-free contract -----
  {
    files: ['src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', 'react', 'react-dom', 'react/*'],
              message:
                'src/shared/ is the framework-free contract. No Three.js, no React. See docs/ARCHITECTURE.md section 2.',
            },
          ],
        },
      ],
    },
  },

  // --- Data honesty: fabricated data is a defect, not a placeholder -------
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Math.random() may not stand in for a real measurement. Use a named seeded generator, or mark the value synthetic. See AGENTS.md section 6.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // esquery attribute matching takes a regex literal, not a
          // case-insensitive flag on a plain string.
          selector: 'Literal[value=/lorem\\s+ipsum/i]',
          message: 'No placeholder copy. See AGENTS.md section 6.',
        },
      ],
    },
  },

  // Scripts are plain Node ESM, not part of the TS program.
  {
    files: ['scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },

  // --- Tests: type-aware rules add nothing here and slow the run down ----
  {
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Prettier last so its rules win any conflict with formatting.
  prettier,
);
