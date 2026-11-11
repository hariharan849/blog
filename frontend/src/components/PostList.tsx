import type { PostSummary } from "@/lib/api";
import PostCard from "./PostCard";

export default function PostList({
  posts,
  empty = "No posts available. Check back soon!",
}: {
  posts: PostSummary[];
  empty?: string;
}) {
  if (posts.length === 0) return <p className="muted empty">{empty}</p>;
  return (
    <div className="post-list">
      {posts.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
    </div>
  );
}
