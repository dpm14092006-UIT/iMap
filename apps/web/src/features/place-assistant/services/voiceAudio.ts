/** Fixed PCM16 mono / 16kHz WAV. Kept small enough for the serverless API. */
export function encodeVoiceWav(samples: Float32Array): Blob {
  if (samples.length < 3200 || samples.length > 240000) throw new Error('Hãy nói từ 0,2 đến 15 giây.');
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => { const s = Math.max(-1, Math.min(1, value)); view.setInt16(44 + i * 2, Math.round(s < 0 ? s * 32768 : s * 32767), true); });
  return new Blob([buffer], { type: 'audio/wav' });
}
export async function recordingToWav(blob: Blob) {
  if (blob.size > 2000000) throw new Error('Bản ghi quá lớn. Hãy nói ngắn hơn.');
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration > 16 || decoded.duration < 0.2) throw new Error('Hãy nói từ 0,2 đến 15 giây.');
    // MediaRecorder may add codec padding. Cap the actual output to 15 seconds.
    const length = Math.min(240000, Math.floor(decoded.duration * 16000));
    const offline = new OfflineAudioContext(1, length, 16000), source = offline.createBufferSource();
    source.buffer = decoded; source.connect(offline.destination); source.start();
    return encodeVoiceWav((await offline.startRendering()).getChannelData(0));
  } finally { await decoder.close(); }
}
