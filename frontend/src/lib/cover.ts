const PALETTES: [string, string][] = [
  ["#6366f1", "#a855f7"], // indigo → purple
  ["#0ea5e9", "#6366f1"], // sky → indigo
  ["#14b8a6", "#0ea5e9"], // teal → sky
  ["#f43f5e", "#f97316"], // rose → orange
  ["#8b5cf6", "#ec4899"], // violet → pink
  ["#10b981", "#84cc16"], // emerald → lime
  ["#f59e0b", "#ef4444"], // amber → red
  ["#3b82f6", "#06b6d4"], // blue → cyan
];

/** Stable 32-bit FNV-1a hash, so a post always gets the same cover. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A deterministic gradient for posts without a cover image. */
export function coverGradient(seed: string): string {
  const hash = hashString(seed);
  const [from, to] = PALETTES[hash % PALETTES.length];
  const angle = 110 + (hash % 5) * 20;
  return `linear-gradient(${angle}deg, ${from}, ${to})`;
}
