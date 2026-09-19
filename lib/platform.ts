import type { ReelSource } from "./types";

export function detectPlatformClient(url: string): ReelSource["platform"] {
  if (/instagram\.com|instagr\.am/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  return "other";
}
