import type { Metadata } from "next";
import { getArticles, MEDIUM_PROFILE_URL } from "@/lib/medium";
import ArticleCard from "@/components/ArticleCard";

export const metadata: Metadata = {
  title: "Articles",
  description: "Articles I've written on Medium about RAG, agents and AI engineering.",
};

export const revalidate = 3600;

export default async function ArticlesPage() {
  const articles = await getArticles();
  return (
    <>
      <section className="hero">
        <h1>Articles</h1>
        <p className="lead">
          What I write on Medium: RAG, agents and building AI systems. Each one opens on{" "}
          <a href={MEDIUM_PROFILE_URL} target="_blank" rel="noopener">
            Medium
          </a>
          .
        </p>
      </section>
      {articles.length ? (
        <div className="grid grid-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      ) : (
        <p className="muted empty">
          Articles couldn&apos;t be loaded right now.{" "}
          <a href={MEDIUM_PROFILE_URL} target="_blank" rel="noopener">
            Read them on Medium
          </a>
          .
        </p>
      )}
      {articles.length > 0 && (
        <p className="muted" style={{ marginTop: "2rem" }}>
          <a href={MEDIUM_PROFILE_URL} target="_blank" rel="noopener">
            All articles on Medium ↗
          </a>
        </p>
      )}
    </>
  );
}
