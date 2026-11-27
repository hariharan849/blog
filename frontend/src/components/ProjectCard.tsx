import type { Project } from "@/lib/projects";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="card tile">
      <div className="card-body tile-body">
        <p className="kicker">{project.category}</p>
        <h3 className="tile-title">
          <a href={project.repo} target="_blank" rel="noopener noreferrer">
            {project.name}
          </a>
        </h3>
        <p className="excerpt">{project.summary}</p>
        <p className="tag-row">
          {project.tags.map((t) => (
            <span key={t} className="badge badge-muted">
              {t}
            </span>
          ))}
        </p>
        <a href={project.repo} target="_blank" rel="noopener noreferrer" className="read-more">
          View on GitHub <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}
