import type { Metadata } from "next";
import { projectCategories, projects } from "@/lib/projects";
import { profile } from "@/lib/profile";
import ProjectCard from "@/components/ProjectCard";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  const github = profile.links.find((l) => l.label === "GitHub");
  return (
    <>
      <section className="hero">
        <h1>Projects</h1>
        <p className="lead">
          Things I&apos;ve built, from multi-agent systems and production RAG to MLOps pipelines and desktop tools.
          {github && (
            <>
              {" "}
              Everything is on{" "}
              <a href={github.href} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              .
            </>
          )}
        </p>
      </section>
      {projectCategories.map((cat) => {
        const list = projects.filter((p) => p.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="section">
            <h2>{cat}</h2>
            <div className="grid grid-2">
              {list.map((p) => (
                <ProjectCard key={p.name} project={p} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
