import { Router, raw } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/AppError.js';

const MAX_BYTES = 500000; // 15 seconds of mono PCM16 / 16kHz is 480044 bytes.
/** Accept our bounded PCM WAV format only; reject compressed audio and dishonest durations. */
export function validateVoiceWav(audio: Buffer) {
  const invalid = () => new AppError(400, 'INVALID_AUDIO', 'Cần WAV PCM16 mono 16 kHz, dài từ 0,2 đến 15 giây.');
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE' || audio.readUInt32LE(4) + 8 !== audio.length) throw invalid();
  let format = false, samples = 0, dataChunks = 0;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const name = audio.toString('ascii', offset, offset + 4), size = audio.readUInt32LE(offset + 4);
    const start = offset + 8; if (start + size > audio.length) throw invalid();
    if (name === 'fmt ') {
      if (size !== 16 || format || audio.readUInt16LE(start) !== 1 || audio.readUInt16LE(start + 2) !== 1 || audio.readUInt32LE(start + 4) !== 16000 || audio.readUInt32LE(start + 8) !== 32000 || audio.readUInt16LE(start + 12) !== 2 || audio.readUInt16LE(start + 14) !== 16) throw invalid();
      format = true;
    }
    if (name === 'data') { samples += size / 2; dataChunks++; }
    offset = start + size + (size % 2);
    if (offset > audio.length) throw invalid();
  }
  if (!format || dataChunks !== 1 || !Number.isInteger(samples) || samples < 3200 || samples > 240000) throw invalid();
}
const outputSchema = z.object({ success: z.literal(true), result: z.object({ text: z.string().trim().min(1).max(300) }) });
export type VoiceConfig = { enabled: boolean; accountId?: string; token?: string };
export function createVoiceRouter(config: VoiceConfig = { enabled: env.VOICE_STT_PROVIDER === 'cloudflare', accountId: env.CLOUDFLARE_ACCOUNT_ID, token: env.CLOUDFLARE_AI_TOKEN }, fetcher: typeof fetch = fetch) {
  const router = Router();
  const available = Boolean(config.enabled && config.accountId && config.token);
  router.get('/config', (_req, res) => res.json({ data: { available, provider: available ? 'cloudflare-whisper' : 'off', maxSeconds: 15, language: 'en' } }));
  const windows = new Map<string, { count: number; until: number }>(); let active = 0;
  router.post('/transcribe', (req, res, next) => {
    if (!available) { next(new AppError(503, 'VOICE_NOT_CONFIGURED', 'API voice chưa được cấu hình. Có thể dùng nhập chữ hoặc voice trình duyệt.')); return; }
    const now = Date.now();
    for (const [key, value] of windows) if (value.until <= now) windows.delete(key);
    const key = req.ip ?? 'unknown', window = windows.get(key) ?? { count: 0, until: now + 60000 };
    if (active >= 2 || window.count >= 5 || (windows.size >= 1000 && !windows.has(key))) { res.setHeader('Retry-After', '60'); next(new AppError(429, 'VOICE_BUSY', 'Voice đang bận. Thử lại sau một phút.')); return; }
    window.count++; windows.set(key, window); next();
  }, raw({ type: 'audio/wav', limit: MAX_BYTES }), async (req, res, next) => {
    if (!req.is('audio/wav')) { next(new AppError(415, 'AUDIO_TYPE', 'Chỉ nhận audio/wav.')); return; }
    active++;
    try {
      if (!Buffer.isBuffer(req.body)) throw new AppError(400, 'EMPTY_AUDIO', 'Chưa có âm thanh.');
      validateVoiceWav(req.body);
      // Fixed provider/model; no paid-provider fallback, no client-controlled upstream URL.
      const upstream = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId!)}/ai/run/@cf/openai/whisper`, {
        method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/octet-stream' },
        body: new Uint8Array(req.body), signal: AbortSignal.timeout(25000),
      });
      if (upstream.status === 429) throw new AppError(429, 'VOICE_QUOTA', 'Đã hết quota hoặc bị giới hạn voice. Không tự chuyển sang dịch vụ trả phí.');
      if (!upstream.ok) throw new AppError(502, 'VOICE_PROVIDER_ERROR', 'Dịch vụ nhận giọng nói chưa sẵn sàng. Hãy thử lại hoặc nhập chữ.');
      const payload = outputSchema.safeParse(await upstream.json());
      if (!payload.success) throw new AppError(502, 'VOICE_NO_TEXT', 'Không nhận được câu nói rõ ràng dưới 300 ký tự. Hãy nói ngắn hơn hoặc nhập chữ.');
      res.json({ data: { text: payload.data.result.text, provider: 'cloudflare-whisper' } });
    } catch (cause) {
      next(cause instanceof AppError ? cause : new AppError(502, 'VOICE_UNAVAILABLE', 'Không nhận dạng được âm thanh lúc này. Hãy thử lại hoặc nhập chữ.'));
    } finally { active--; }
  });
  return router;
}
