#!/usr/bin/env node
/**
 * Kiểm toán sau khi dọn dẹp / chuyển file:
 *  1. Mọi tên được export ở nhánh gốc (`--base`, mặc định `main`) vẫn được export ở đâu đó trong cây hiện tại,
 *     trừ các tên ghi trong `intentional-removals.json` (kèm lý do).
 *  2. Mọi import tương đối trong mã hiện tại đều trỏ tới file có thật.
 *  3. Mọi tên import từ file tương đối đều thực sự được file đó export.
 *
 * Chỉ dùng git + Node, không cần thư viện. In danh sách tên đã chuyển chỗ để người review đối chiếu.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? 'main';
const verbose = process.argv.includes('--verbose');
const sourceRoots = ['apps/api/src', 'apps/web/src', 'packages/shared/src'];
const isSource = (path) => /\.(ts|tsx)$/.test(path) && !/\.d\.ts$/.test(path);
const isTest = (path) => /\.test\.(ts|tsx)$/.test(path);

const DECLARATION =
  /^\s*export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:function\*?|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
const LIST = /^\s*export\s+(?:type\s+)?\{([^}]*)\}/gm;

/** Tên được export bởi một file (không tính `export *` và `export default` không tên). */
function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(DECLARATION)) names.add(match[1]);
  for (const match of source.matchAll(LIST)) {
    for (const part of match[1].split(',')) {
      const spec = part.replace(/^\s*type\s+/, '').trim();
      if (!spec) continue;
      const name = spec
        .split(/\s+as\s+/)
        .pop()
        .trim();
      if (name !== 'default') names.add(name);
    }
  }
  return names;
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (isSource(path)) files.push(path);
  }
  return files;
}

// --- 1. Export ở nhánh gốc còn tồn tại không ---
const baseExports = new Map(); // name -> [file]
for (const file of git('ls-tree', '-r', '--name-only', base, '--', ...sourceRoots).split('\n')) {
  if (!file || !isSource(file) || isTest(file)) continue;
  for (const name of exportedNames(git('show', `${base}:${file}`))) {
    baseExports.set(name, [...(baseExports.get(name) ?? []), file]);
  }
}

const currentFiles = sourceRoots.flatMap((dir) => walk(join(root, dir)));
const currentExports = new Map();
const exportsByFile = new Map();
for (const path of currentFiles) {
  const names = exportedNames(readFileSync(path, 'utf8'));
  exportsByFile.set(path, names);
  if (isTest(path)) continue;
  for (const name of names)
    currentExports.set(name, [...(currentExports.get(name) ?? []), relative(root, path)]);
}

const allowlistPath = join(root, 'scripts/verify/intentional-removals.json');
const allowlist = existsSync(allowlistPath) ? JSON.parse(readFileSync(allowlistPath, 'utf8')) : {};

const missing = [];
const moved = [];
for (const [name, files] of baseExports) {
  const now = currentExports.get(name);
  if (!now) {
    if (!allowlist[name]) missing.push(`${name}  (trước ở ${files.join(', ')})`);
    continue;
  }
  if (!files.some((file) => now.includes(file)))
    moved.push(`${name}: ${files.join(', ')} -> ${now.join(', ')}`);
}
const staleAllowlist = Object.keys(allowlist).filter(
  (name) => currentExports.has(name) || !baseExports.has(name),
);

// --- 2 & 3. Import tương đối trỏ tới file có thật và tên có được export ---
// Regex tuyến tính (không lồng lượng từ) để chạy nhanh trên file lớn.
const NAMED_IMPORT = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'(\.[^']+)'/g;
const ANY_FROM = /from\s+'(\.[^']+)'/g;
const SIDE_EFFECT = /import\s+'(\.[^']+)'/g;

function resolveImport(fromFile, specifier) {
  const target = resolve(dirname(fromFile), specifier.replace(/\.js$/, ''));
  for (const candidate of [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    join(target, 'index.ts'),
    join(target, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const brokenImports = [];
const unknownNames = [];
for (const path of currentFiles) {
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(ANY_FROM)) {
    if (!resolveImport(path, match[1])) brokenImports.push(`${relative(root, path)} -> ${match[1]}`);
  }
  for (const match of source.matchAll(NAMED_IMPORT)) {
    const target = resolveImport(path, match[2]);
    if (!target || !isSource(target)) continue;
    const exported = exportsByFile.get(target) ?? exportedNames(readFileSync(target, 'utf8'));
    const reexportsAll = /export\s+\*\s+from/.test(readFileSync(target, 'utf8'));
    for (const part of match[1].split(',')) {
      const name = part
        .replace(/^\s*type\s+/, '')
        .trim()
        .split(/\s+as\s+/)[0]
        .trim();
      if (name && name !== 'default' && !exported.has(name) && !reexportsAll) {
        unknownNames.push(`${relative(root, path)}: '${name}' không được ${relative(root, target)} export`);
      }
    }
  }
  for (const match of source.matchAll(SIDE_EFFECT)) {
    if (!resolveImport(path, match[1])) brokenImports.push(`${relative(root, path)} -> ${match[1]}`);
  }
}

// --- Báo cáo ---
const section = (title, lines) => {
  if (!lines.length) return;
  console.log(`\n${title} (${lines.length})`);
  for (const line of lines) console.log(`  - ${line}`);
};
console.log(
  `So với ${base}: ${baseExports.size} tên export trước đây, ${currentExports.size} hiện tại, ${currentFiles.length} file nguồn.`,
);
section('Export bị mất (không còn ở đâu và không nằm trong intentional-removals.json)', missing);
section('Import tương đối trỏ tới file không tồn tại', brokenImports);
section('Tên import mà file đích không export', unknownNames);
section('Mục thừa trong intentional-removals.json (tên vẫn tồn tại hoặc chưa từng có)', staleAllowlist);
if (verbose) section('Tên đã chuyển chỗ (để đối chiếu)', moved);
else console.log(`${moved.length} tên đã chuyển chỗ (thêm --verbose để xem).`);
console.log(`${Object.keys(allowlist).length} tên được xóa có chủ đích.`);

const problems = missing.length + brokenImports.length + unknownNames.length + staleAllowlist.length;
console.log(problems ? `\n✗ ${problems} vấn đề.` : '\n✓ Không mất export, mọi import đều hợp lệ.');
process.exit(problems ? 1 : 0);
