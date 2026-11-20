import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'apps/api/data/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'scripts/**/*.{ts,mjs}', '*.js', 'apps/web/*.{js,cjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } },

  // --- Ranh giới module (xem docs/architecture/ARCHITECTURE.md) ---
  // Mỗi khối chỉ được phụ thuộc "vào trong": app -> features -> shared; presentation -> application -> domain.
  boundary(
    'apps/web/src/shared/**',
    ['**/features/**', '**/app/**'],
    'shared không được phụ thuộc feature hay app.',
  ),
  boundary(
    'apps/web/src/features/**',
    ['**/app/**'],
    'feature không được phụ thuộc app; đưa phần dùng chung xuống shared.',
  ),
  boundary(
    'apps/web/src/features/*/domain/**',
    [
      'react',
      'react-dom',
      '**/app/**',
      '**/components/**',
      '**/hooks/**',
      '**/context/**',
      // api/ và services/ của feature là I/O (HTTP, Supabase, localStorage, trình duyệt); shared/api/ApiError chỉ là kiểu lỗi.
      '../api/**',
      '../../*/api/**',
      '../../../*/api/**',
      '../services/**',
      '../../*/services/**',
      '../../../*/services/**',
      '!../../../shared/**',
    ],
    'domain là logic thuần: không React, không gọi API, không I/O.',
  ),
  boundary(
    'apps/web/src/features/*/{api,services}/**',
    ['react', 'react-dom', '**/app/**', '**/components/**', '**/hooks/**', '**/context/**'],
    'api/ và services/ là adapter I/O, không chứa React.',
  ),
  boundary('apps/api/src/shared/**', ['**/modules/**'], 'shared của API không được phụ thuộc module.'),
  boundary(
    'apps/api/src/modules/*/domain/**',
    ['express', '**/application/**', '**/infrastructure/**', '**/presentation/**'],
    'domain không phụ thuộc application/infrastructure/presentation.',
  ),
  boundary(
    'apps/api/src/modules/*/application/**',
    ['express', '**/infrastructure/**', '**/presentation/**'],
    'application chỉ dùng port; implementation cụ thể được lắp ở composition-root.',
  ),
  boundary(
    'apps/api/src/modules/*/presentation/**',
    ['**/infrastructure/**'],
    'presentation gọi use case, không phụ thuộc implementation của infrastructure.',
  ),
  boundary(
    'apps/api/src/modules/*/infrastructure/**',
    ['**/presentation/**'],
    'infrastructure không phụ thuộc HTTP controller hay router.',
  ),
);

/** Cấm `files` import các đường dẫn khớp `patterns` (bỏ qua file test). */
function boundary(files, patterns, message) {
  return {
    files: [files],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }] },
  };
}
