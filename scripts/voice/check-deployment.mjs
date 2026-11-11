/** Live HTTPS smoke test. Uses synthetic benchmark WAVs; no microphone or provider secrets.
 * node scripts/voice/check-deployment.mjs https://API.example/api https://WEB.example ~/.cache/imap-voice/audio
 * Fails without a real configured provider. Never substitutes a fixture transcript.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const [baseArgument, webOrigin, audioDirectory, output] = process.argv.slice(2);
if (!baseArgument || !webOrigin || !audioDirectory)
  throw Error('Pass API URL including /api, web origin and benchmark audio directory.');
const sessionToken = process.env.IMAP_TEST_ACCESS_TOKEN;
if (!sessionToken)
  throw Error(
    'Set IMAP_TEST_ACCESS_TOKEN with a test member session. Never pass tokens as command arguments.',
  );
const base = baseArgument.replace(/\/$/, '');
for (const value of [base, webOrigin])
  if (new URL(value).protocol !== 'https:')
    throw Error('This acceptance check requires deployed HTTPS endpoints.');
const report = {
  checkedAt: new Date().toISOString(),
  api: base,
  webOrigin,
  checks: [],
  samples: [],
  browserMicrophone: 'not tested by this script',
};
async function data(endpoint, init) {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${sessionToken}`);
  const response = await fetch(base + endpoint, { ...init, headers, signal: AbortSignal.timeout(35000) });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw Error(`${endpoint}: HTTP ${response.status} ${json?.error?.code ?? ''}`);
  if (!json?.data) throw Error(`${endpoint}: missing API envelope`);
  return json.data;
}
try {
  await data('/health');
  report.checks.push('health OK');
  const config = await data('/voice/config');
  if (!config.available || config.provider !== 'cloudflare-whisper')
    throw Error('Cloud voice not configured; local/browser ASR does not satisfy this check.');
  report.checks.push('cloud provider configured');
  const preflight = await fetch(base + '/voice/transcribe', {
    method: 'OPTIONS',
    headers: {
      Origin: webOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (
    !preflight.ok ||
    preflight.headers.get('access-control-allow-origin') !== webOrigin ||
    !preflight.headers.get('access-control-allow-methods')?.includes('POST')
  )
    throw Error('CORS preflight does not allow deployed web origin.');
  report.checks.push('CORS preflight OK');
  // Three real upstream calls stay within per-process five/minute guard.
  for (const [file, required] of [
    ['clean_us-0.wav', /\b(fuel|gas|petrol)\b/i],
    ['clean_us-1.wav', /\bschool\b/i],
    ['clean_us-7.wav', /\bpharmacy\b/i],
  ]) {
    const audio = await readFile(join(audioDirectory, file));
    const started = performance.now();
    const result = await data('/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav', Origin: webOrigin },
      body: audio,
    });
    if (
      result.provider !== 'cloudflare-whisper' ||
      typeof result.text !== 'string' ||
      !required.test(result.text)
    )
      throw Error(`${file}: expected real transcript/category was not returned`);
    report.samples.push({
      file,
      transcript: result.text,
      roundTripMs: Math.round(performance.now() - started),
    });
  }
  report.checks.push('three real cloud ASR round trips OK');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failure = error.message;
  process.exitCode = 1;
}
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
