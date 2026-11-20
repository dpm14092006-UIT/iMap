#!/usr/bin/env node
/**
 * Đối chiếu props JSX trước/sau khi tách file giao diện: mọi prop từng được truyền cho một component
 * (theo tên component) ở file gốc phải vẫn được truyền ở đâu đó trong thư mục đích.
 *
 *   node scripts/verify/jsx-props-audit.mjs --base=main --from=apps/web/src/app/App.tsx --to=apps/web/src/app
 *
 * Hiểu được spread `{...obj}` khi `obj` là object literal khai báo trong cùng file, và spread điều kiện
 * `{...(cond ? { a: x } : {})}`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name, fallback) =>
  process.argv.find((item) => item.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const base = arg('base', 'main');
const from = arg('from', 'apps/web/src/app/App.tsx');
const to = arg('to', 'apps/web/src/app');

/** Các object literal `const name = { ... };` trong file → tên khóa. */
function objectLiterals(source) {
  const result = new Map();
  for (const match of source.matchAll(/const\s+(\w+)\s*=\s*\{/g)) {
    const body = balanced(source, match.index + match[0].length - 1, '{', '}');
    if (body !== null) result.set(match[1], keysOf(body));
  }
  return result;
}

/** Nội dung giữa cặp ngoặc bắt đầu tại `start` (bỏ qua chuỗi), hoặc null. */
function balanced(source, start, open, close) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === open) depth++;
    else if (char === close && --depth === 0) return source.slice(start + 1, index);
  }
  return null;
}

/** Khóa cấp ngoài cùng của một object literal (gồm cả viết tắt `{ a, b: c }`). */
function keysOf(body) {
  const keys = new Set();
  let depth = 0;
  let token = '';
  let quote = null;
  const flush = () => {
    const key = token.trim().match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
    if (key) keys.add(key[1]);
    token = '';
  };
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = null;
      if (depth === 0) token += char;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
    if ('{[('.includes(char)) depth++;
    if ('}])'.includes(char)) depth--;
    if (char === ',' && depth === 0) flush();
    else if (depth === 0) token += char;
  }
  flush();
  return keys;
}

/** Map tên component → tập props được truyền trong `source`. */
function jsxProps(source) {
  const literals = objectLiterals(source);
  const result = new Map();
  // Bỏ generic TypeScript (`useState<Kind>`, `Map<K, V>`): thẻ JSX không đứng ngay sau một định danh.
  for (const match of source.matchAll(/(?<![\w$.])<([A-Z][\w.]*)(?=[\s/>])/g)) {
    const props = result.get(match[1]) ?? new Set();
    result.set(match[1], props);
    // Quét tới dấu '>' kết thúc thẻ mở, bỏ qua mọi thứ trong {...} và chuỗi.
    let depth = 0;
    let quote = null;
    let attrs = '';
    for (let index = match.index + match[0].length; index < source.length; index++) {
      const char = source[index];
      if (quote) {
        if (char === quote) quote = null;
        if (depth > 0) attrs += char;
        continue;
      }
      if (depth === 0 && (char === '"' || char === "'")) quote = char;
      if (char === '{') {
        if (depth === 0) {
          const inner = balanced(source, index, '{', '}') ?? '';
          const spread = inner.trim().match(/^\.\.\.\s*(.*)$/s);
          if (spread) {
            const expression = spread[1].trim();
            if (literals.has(expression)) for (const key of literals.get(expression)) props.add(key);
            for (const literal of expression.matchAll(/\{([^{}]*)\}/g))
              for (const key of keysOf(literal[1])) props.add(key);
          }
        }
        depth++;
      } else if (char === '}') depth--;
      else if (depth === 0 && char === '>') break;
      else if (depth === 0) attrs += char;
    }
    for (const attr of attrs.matchAll(/(?:^|\s)([A-Za-z_][\w-]*)(?=\s*=|\s|$|\/)/g)) props.add(attr[1]);
  }
  return result;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.tsx$/.test(path) && !/\.test\.tsx$/.test(path)) files.push(path);
  }
  return files;
}

const before = jsxProps(execFileSync('git', ['show', `${base}:${from}`], { cwd: root, encoding: 'utf8' }));
const after = new Map();
for (const file of walk(join(root, to))) {
  for (const [component, props] of jsxProps(readFileSync(file, 'utf8'))) {
    const set = after.get(component) ?? new Set();
    for (const prop of props) set.add(prop);
    after.set(component, set);
  }
}

const problems = [];
let checked = 0;
for (const [component, props] of before) {
  const now = after.get(component);
  if (!now) {
    problems.push(`<${component}> không còn được dùng trong ${to}`);
    continue;
  }
  for (const prop of props) {
    checked++;
    if (!now.has(prop)) problems.push(`<${component}> mất prop "${prop}"`);
  }
}
console.log(`Đối chiếu ${before.size} component, ${checked} prop của ${base}:${from} với ${to}/**.tsx.`);
for (const line of problems) console.log(`  ✗ ${line}`);
console.log(
  problems.length ? `\n✗ ${problems.length} vấn đề.` : '✓ Không component hay prop nào bị rơi khi tách.',
);
process.exit(problems.length ? 1 : 0);
