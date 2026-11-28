import { ogContentType, ogImage, ogSize } from "@/lib/ogImage";
import { getPost, getPosts } from "@/lib/posts";
import { formatDate } from "@/lib/format";

export const alt = "Blog post";
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  return ogImage({
    eyebrow: post ? `Blog · ${formatDate(post.date, { month: "long" })}` : "Blog",
    title: post?.title ?? "Blog",
  });
}
