import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../../../scripts/verify/verify.mjs', import.meta.url));

describe('verification CLI fails closed on invalid arguments', () => {
  it.each([
    ['--only=typo'],
    ['--only='],
    ['--only=test,'],
    ['--only=shuffle', '--shuffle=0'],
    ['--only=shuffle', '--shuffle=-1'],
    ['--only=shuffle', '--shuffle=NaN'],
    ['--only=shuffle', '--shuffle=1.5'],
    ['--shufle=2'],
  ])('rejects %j without reporting a passing verification', (...args) => {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 5_000 });
    expect(result.status).toBe(2);
    expect(result.stderr).not.toBe('');
    expect(result.stdout).not.toContain('Tất cả các vòng đều đạt');
  });
});
