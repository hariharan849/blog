import Link from "next/link";
import { projectSlug, type Project } from "@/lib/projects";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="card tile">
      <div className="card-body tile-body">
        <p className="kicker">{project.category}</p>
        <h3 className="tile-title">
          <Link href={`/projects/${projectSlug(project)}`}>{project.name}</Link>
        </h3>
        <p className="excerpt">{project.summary}</p>
        <p className="tag-row">
          {project.tags.map((t) => (
            <span key={t} className="badge badge-muted">
              {t}
            </span>
          ))}
        </p>
        <Link href={`/projects/${projectSlug(project)}`} className="read-more">
          Read more <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
