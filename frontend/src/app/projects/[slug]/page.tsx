import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, projectSlug, projects } from "@/lib/projects";
import { getProjectWriteup } from "@/lib/posts";
import TableOfContents from "@/components/TableOfContents";
import ProjectCard from "@/components/ProjectCard";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((p) => ({ slug: projectSlug(p) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = getProject((await params).slug);
  if (!project) return {};
  return {
    title: project.name,
    description: project.summary,
    openGraph: { type: "article", title: project.name, description: project.summary },
  };
}

export default async function ProjectPage({ params }: Props) {
  const slug = (await params).slug;
  const project = getProject(slug);
  if (!project) notFound();
  const writeup = getProjectWriteup(slug);
  const more = projects.filter((p) => p.category === project.category && p !== project).slice(0, 2);

  return (
    <>
      <article className="narrow">
        <header className="hero">
          <p className="eyebrow">
            <Link href="/projects">Projects</Link> · {project.category}
          </p>
          <h1 className="post-title">{project.name}</h1>
          <p className="lead">{project.summary}</p>
          <p className="tag-row">
            {project.tags.map((t) => (
              <span key={t} className="badge badge-muted">
                {t}
              </span>
            ))}
          </p>
          <p className="actions">
            <a href={project.repo} target="_blank" rel="noopener noreferrer" className="button">
              View the code on GitHub
            </a>
            <Link href="/projects" className="button button-secondary">
              All projects
            </Link>
          </p>
        </header>
        {writeup ? (
          <>
            <TableOfContents toc={writeup.toc} />
            {/* Write-ups are Markdown files committed to this repo by the site owner. */}
            <div className="prose" dangerouslySetInnerHTML={{ __html: writeup.html }} />
          </>
        ) : (
          <p className="muted">
            The README on{" "}
            <a href={project.repo} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{" "}
            has the full setup and design notes for this project.
          </p>
        )}
      </article>
      {more.length > 0 && (
        <section className="section">
          <h2>More {project.category} projects</h2>
          <div className="grid grid-2">
            {more.map((p) => (
              <ProjectCard key={p.name} project={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
