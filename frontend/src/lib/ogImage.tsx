import { ImageResponse } from "next/og";
import { profile } from "@/lib/profile";

/** Shared look for the link-preview images (LinkedIn, X, Slack...): 1200×630, site blue. */
export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export function ogImage({ eyebrow, title, footer }: { eyebrow: string; title: string; footer?: string }) {
  const size = title.length > 90 ? 52 : title.length > 55 ? 62 : 72;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0b1f4d 0%, #143a8c 55%, #1d5fd6 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 2, textTransform: "uppercase", color: "#93c5fd" }}>
          {eyebrow}
        </div>
        <div style={{ display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1.15, maxWidth: 1050 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 700 }}>{profile.name}</span>
            <span style={{ color: "#bfdbfe", fontSize: 24 }}>{footer ?? profile.role}</span>
          </div>
          <div style={{ display: "flex", width: 120, height: 8, borderRadius: 4, background: "#60a5fa" }} />
        </div>
      </div>
    ),
    ogSize,
  );
}
