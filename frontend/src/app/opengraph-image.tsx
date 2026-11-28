import { ogContentType, ogImage, ogSize } from "@/lib/ogImage";
import { profile } from "@/lib/profile";

export const alt = `${profile.name}, ${profile.role}`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogImage({ eyebrow: "Portfolio · Daily Dose", title: profile.headline });
}
