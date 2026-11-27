import type { Project } from "@/lib/projects";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="card project-card">
      <div className="card-body">
        <p className="eyebrow">{project.category}</p>
        <h3>
          <a href={project.repo} target="_blank" rel="noopener noreferrer">
            {project.name} <span aria-hidden="true">↗</span>
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
      </div>
    </article>
  );
}
