import { ogContentType, ogImage, ogSize } from "@/lib/ogImage";
import { getLesson, getLessons } from "@/lib/posts";

export const alt = "Daily Dose lesson";
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getLessons().map((l) => ({ slug: l.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = getLesson((await params).slug);
  return ogImage({
    eyebrow: "Daily Dose lesson",
    title: lesson?.title ?? "Daily Dose",
    footer: lesson?.sourceAuthor ? `From ${lesson.sourceAuthor}` : undefined,
  });
}
