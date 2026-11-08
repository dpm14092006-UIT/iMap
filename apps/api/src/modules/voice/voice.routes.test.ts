import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { createVoiceRouter, validateVoiceWav, type VoiceConfig } from './voice.routes.js';
import { errorHandler } from '../../shared/http/error-handler.js';
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))); });
function wav(seconds = 1) {
  const b = Buffer.alloc(44 + seconds * 32000); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(seconds * 32000, 40); return b;
}
async function start(fetcher: typeof fetch, config: VoiceConfig = { enabled: true, accountId: 'test-account', token: 'test-secret' }) {
  const app = express(); app.use('/api/voice', createVoiceRouter(config, fetcher)); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); servers.push(server); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw Error('port'); return `http://127.0.0.1:${address.port}/api/voice`;
}
const send = (url: string, audio = wav(), type = 'audio/wav') => fetch(url + '/transcribe', { method: 'POST', headers: { 'Content-Type': type }, body: new Uint8Array(audio) });
describe('deployable voice boundary', () => {
  it('validates actual bytes, PCM format and duration', () => {
    expect(() => validateVoiceWav(wav(15))).not.toThrow();
    for (const invalid of [wav(16), Buffer.from('not audio'), wav().subarray(0, 100)]) expect(() => validateVoiceWav(invalid)).toThrow();
    const stereo = wav(); stereo.writeUInt16LE(2, 22); expect(() => validateVoiceWav(stereo)).toThrow();
  });
  it('stays off without credentials and never leaks keys in config', async () => {
    const provider = vi.fn<typeof fetch>(); const url = await start(provider, { enabled: false });
    expect(await (await fetch(url + '/config')).json()).toMatchObject({ data: { available: false, provider: 'off' } });
    expect((await send(url)).status).toBe(503); expect(provider).not.toHaveBeenCalled();
  });
  it('sends binary to fixed Whisper URL and returns only transcript', async () => {
    const provider = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ success: true, result: { text: 'Find a school nearby.', vtt: 'unused' } }));
    const url = await start(provider); const response = await send(url);
    expect(await response.json()).toEqual({ data: { text: 'Find a school nearby.', provider: 'cloudflare-whisper' } });
    const [endpoint, init] = provider.mock.calls[0]!;
    expect(endpoint).toBe('https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/@cf/openai/whisper');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-secret', 'Content-Type': 'application/octet-stream' });
    expect(Buffer.from(init?.body as Uint8Array)).toEqual(wav());
  });
  it('rejects invalid format and oversized audio before inference', async () => {
    const provider = vi.fn<typeof fetch>(); const url = await start(provider);
    expect((await send(url, wav(), 'audio/webm')).status).toBe(415);
    expect((await send(url, Buffer.from('garbage'))).status).toBe(400);
    expect((await send(url, wav(16))).status).toBe(413); expect(provider).not.toHaveBeenCalled();
  });
  it('fails closed on quota/invalid provider output; no fallback calls', async () => {
    const provider = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 429 })).mockResolvedValueOnce(Response.json({ success: true, result: { text: '' } }));
    const url = await start(provider); expect((await send(url)).status).toBe(429); expect((await send(url)).status).toBe(502); expect(provider).toHaveBeenCalledTimes(2);
  });
  it('limits calls per process', async () => {
    const provider = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ success: true, result: { text: 'Find a school.' } })); const url = await start(provider);
    for (let i = 0; i < 5; i++) expect((await send(url)).status).toBe(200);
    expect((await send(url)).status).toBe(429); expect(provider).toHaveBeenCalledTimes(5);
  });
});
