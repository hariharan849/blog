/**
 * A drawn cover for cards that have no image: a blue gradient tile with a
 * subtle grid pattern and a label. Tones keep every card inside the blue theme.
 */
const TONES = ["navy", "royal", "sky", "indigo"] as const;
export type CoverTone = (typeof TONES)[number];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function toneFor(key: string): CoverTone {
  return TONES[hash(key) % TONES.length];
}

export default function Cover({
  label,
  title,
  tone,
  size = "md",
}: {
  label: string;
  /** Short text drawn large on the cover, e.g. the project's initials or a keyword. */
  title?: string;
  tone?: CoverTone;
  size?: "md" | "lg";
}) {
  return (
    <div className={`cover cover-${tone ?? toneFor(label)} cover-${size}`} aria-hidden="true">
      <span className="cover-label">{label}</span>
      {title && <span className="cover-title">{title}</span>}
    </div>
  );
}
