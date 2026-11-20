#!/usr/bin/env node
/**
 * Bộ kiểm tra nhiều vòng trước khi push/merge.
 *
 *   npm run verify                 # mọi vòng, so export với nhánh `main`
 *   npm run verify -- --base=origin/main --shuffle=5
 *   npm run verify -- --only=audit,test
 *
 * Vòng nào lỗi thì vẫn chạy tiếp các vòng sau để thấy toàn cảnh; mã thoát khác 0 nếu có vòng lỗi.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bin = (name) => join(root, 'node_modules/.bin', name);
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);
const base = args.base ?? 'main';
const shuffleRounds = Number(args.shuffle ?? 3);
const only = args.only ? new Set(args.only.split(',')) : null;
const roundIds = new Set(['static', 'types', 'audit', 'test', 'shuffle', 'build']);
const invalidArgument = Object.keys(args).find((key) => !['base', 'shuffle', 'only'].includes(key));
const invalidRound =
  args.only !== undefined ? args.only.split(',').find((id) => !roundIds.has(id)) : undefined;
if (invalidArgument || invalidRound !== undefined || !Number.isInteger(shuffleRounds) || shuffleRounds < 1) {
  console.error(
    invalidArgument
      ? `Unknown option: --${invalidArgument}`
      : invalidRound !== undefined
        ? `Unknown verification round: ${invalidRound || '(empty)'}`
        : '--shuffle must be a positive integer.',
  );
  process.exit(2);
}

/** Chạy một lệnh, in kết quả rút gọn; trả về true nếu thành công. */
function run(label, command, commandArgs, cwd = root) {
  const started = Date.now();
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const ok = result.status === 0;
  console.log(`  ${ok ? '✓' : '✗'} ${label} (${seconds}s)`);
  if (!ok) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n');
    console.log(
      output
        .slice(-40)
        .map((line) => `      ${line}`)
        .join('\n'),
    );
  }
  return ok;
}

const rounds = [
  {
    id: 'static',
    title: 'Vòng 1 · Định dạng và lint (gồm luật ranh giới module)',
    steps: () => [
      run('prettier --check', bin('prettier'), ['--check', '.', '--log-level', 'warn']),
      run('eslint', bin('eslint'), ['apps', 'packages', 'scripts', '--max-warnings=0']),
    ],
  },
  {
    id: 'types',
    title: 'Vòng 2 · Kiểu dữ liệu (mã chạy và test)',
    steps: () => [
      run('build @routetwin/shared', bin('tsc'), ['-p', 'packages/shared/tsconfig.json']),
      run('tsc web (gồm test)', bin('tsc'), ['--noEmit', '-p', 'apps/web/tsconfig.json']),
      run('tsc api', bin('tsc'), ['--noEmit', '-p', 'apps/api/tsconfig.json']),
      run('tsc api test', bin('tsc'), ['-p', 'apps/api/tsconfig.test.json']),
    ],
  },
  {
    id: 'audit',
    title: `Vòng 3 · Kiểm toán không xóa nhầm (so với ${base})`,
    steps: () => [
      run('export không mất / import đều tồn tại', process.execPath, [
        join(root, 'scripts/verify/export-audit.mjs'),
        `--base=${base}`,
      ]),
      run('props JSX của App.tsx không rơi khi tách', process.execPath, [
        join(root, 'scripts/verify/jsx-props-audit.mjs'),
        `--base=${base}`,
      ]),
    ],
  },
  {
    id: 'test',
    title: 'Vòng 4 · Unit test',
    steps: () => [
      run('vitest api', bin('vitest'), ['run'], join(root, 'apps/api')),
      run('vitest web', bin('vitest'), ['run'], join(root, 'apps/web')),
    ],
  },
  {
    id: 'shuffle',
    title: `Vòng 5 · Chạy lại ${shuffleRounds} lần với thứ tự test xáo trộn (bắt test phụ thuộc thứ tự)`,
    steps: () =>
      Array.from({ length: shuffleRounds }, (_, index) => {
        const seed = String(1000 + index * 7919);
        return ['api', 'web'].map((app) =>
          run(
            `vitest ${app} --sequence.shuffle seed=${seed}`,
            bin('vitest'),
            ['run', '--sequence.shuffle', `--sequence.seed=${seed}`],
            join(root, `apps/${app}`),
          ),
        );
      }).flat(),
  },
  {
    id: 'build',
    title: 'Vòng 6 · Build production',
    steps: () => {
      const out = mkdtempSync(join(tmpdir(), 'imap-verify-'));
      try {
        return [
          run('tsc api build', bin('tsc'), ['-p', 'apps/api/tsconfig.json', '--outDir', join(out, 'api')]),
          run(
            'vite build web',
            bin('vite'),
            ['build', '--outDir', join(out, 'web'), '--emptyOutDir'],
            join(root, 'apps/web'),
          ),
        ];
      } finally {
        rmSync(out, { recursive: true, force: true });
      }
    },
  },
];

let failed = 0;
const summary = [];
for (const round of rounds) {
  if (only && !only.has(round.id)) continue;
  console.log(`\n${round.title}`);
  const results = round.steps();
  const ok = results.every(Boolean);
  if (!ok) failed++;
  summary.push(`${ok ? '✓' : '✗'} ${round.title}`);
}
console.log(`\nTổng kết\n${summary.map((line) => `  ${line}`).join('\n')}`);
console.log(failed ? `\n${failed} vòng lỗi.` : '\nTất cả các vòng đều đạt.');
process.exit(failed ? 1 : 0);
