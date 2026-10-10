import PostCard from "./PostCard";

import type { PostSummary } from "@/lib/types";

export default function PostList({ posts, empty = "No posts yet. Check back soon!" }: { posts: PostSummary[]; empty?: string }) {
  if (!posts.length) return <p className="text-muted">{empty}</p>;
  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}
    </>
  );
}
