import { expect, it } from 'vitest';
import { encodeVoiceWav } from './voiceAudio';
it('encodes bounded mono PCM16 WAV with clipping', async () => {
  const input = new Float32Array(16000);
  input.set([-2, -1, 0, 1, 2]);
  const wav = encodeVoiceWav(input),
    bytes = await wav.arrayBuffer(),
    view = new DataView(bytes);
  expect(wav.type).toBe('audio/wav');
  expect(bytes.byteLength).toBe(32044);
  expect(view.getUint32(24, true)).toBe(16000);
  expect(view.getUint16(22, true)).toBe(1);
  expect([0, 1, 2, 3, 4].map((i) => view.getInt16(44 + 2 * i, true))).toEqual([
    -32768, -32768, 0, 32767, 32767,
  ]);
  expect(() => encodeVoiceWav(new Float32Array(240001))).toThrow();
  expect(() => encodeVoiceWav(new Float32Array(3199))).toThrow();
});
