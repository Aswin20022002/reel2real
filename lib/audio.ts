/**
 * Browser-side audio extraction so a full-size downloaded reel (10-100 MB) can be transcribed even though
 * the server only accepts small requests. The audio track is decoded, resampled to 16 kHz mono and cut into
 * ~90 second WAV chunks (about 2.9 MB each), which is what speech-to-text needs.
 */
const RATE = 16000;

function encodeWav(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

export interface AudioChunks { chunks: Blob[]; seconds: number; truncated: boolean }

export async function extractAudioChunks(file: File, chunkSec = 90, maxSec = 360): Promise<AudioChunks> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try { decoded = await ctx.decodeAudioData(await file.arrayBuffer()); } finally { void ctx.close(); }
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded; src.connect(off.destination); src.start();
  const data = (await off.startRendering()).getChannelData(0);
  const limit = Math.min(data.length, maxSec * RATE);
  const step = chunkSec * RATE;
  const chunks: Blob[] = [];
  for (let i = 0; i < limit; i += step) chunks.push(encodeWav(data.subarray(i, Math.min(i + step, limit))));
  return { chunks, seconds: decoded.duration, truncated: data.length > limit };
}
