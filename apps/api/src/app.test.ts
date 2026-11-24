import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('entry point Vercel (src/app.ts)', () => {
  it('import trực tiếp từ express, nếu không preset Express của Vercel không nhận ra entry và build thất bại', () => {
    // Vercel tìm entry bằng cách đọc mã nguồn, không chạy code: thiếu import này thì CI vẫn xanh
    // nhưng production đứng ở bản cũ ("No entrypoint found which imports express").
    const source = readFileSync(new URL('./app.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/^import\s+(type\s+)?[^;]*\sfrom\s+'express';/m);
    expect(source).toMatch(/^export default /m);
  });
});
