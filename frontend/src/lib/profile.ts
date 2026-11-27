/**
 * Everything personal shown on the site lives here: hero text, About page,
 * skills, experience and social links. Edit freely.
 */
export type Experience = {
  role: string;
  company: string;
  period: string;
  highlights: string[];
};

export type Profile = {
  name: string;
  shortName: string;
  headline: string;
  role: string;
  /** Optional image in /public, e.g. "/images/profile.jpg". Initials are shown when unset. */
  avatar?: string;
  /** Optional PDF in /public, e.g. "/resume.pdf". The Resume button is hidden when unset. */
  resume?: string;
  intro: string;
  about: string[];
  skills: { group: string; items: string[] }[];
  /**
   * TODO: fill in from LinkedIn. Left empty on purpose so nothing invented is published;
   * the Experience section is hidden while this list is empty.
   */
  experience: Experience[];
  links: { label: string; href: string }[];
};

export const profile: Profile = {
  name: "Hariharan Manoharan",
  shortName: "Hariharan",
  headline: "I build GenAI systems, ML pipelines and tools for VFX.",
  role: "Senior Software Developer · GenAI, VFX & Deep Learning",
  intro:
    "Senior Software Developer with 9+ years of experience building AI-powered tools, pipeline automation and high-performance software for VFX. These days I spend most of my time on agentic workflows, retrieval systems and serving LLMs in production.",
  about: [
    "I'm Hariharan, a Senior Software Developer specializing in VFX and Deep Learning. Over 9+ years I've worked on AI-powered tools, pipeline automation and high-performance computing.",
    "Recently my focus has been generative AI: multi-agent systems with LangGraph, CrewAI, AutoGen and Google ADK, agents that talk over A2A and MCP, production RAG with hybrid retrieval and evaluation, and GPU-backed model serving with vLLM.",
    "This site is where I share what I build and learn, plus a Daily Dose of the GenAI writing I follow.",
  ],
  skills: [
    {
      group: "GenAI & Agents",
      items: ["LangGraph", "LangChain", "CrewAI", "AutoGen", "Google ADK", "A2A", "MCP", "RAG", "vLLM"],
    },
    {
      group: "Machine Learning",
      items: ["PyTorch", "TensorFlow", "Detectron2", "YOLO", "scikit-learn", "XGBoost", "ChromaDB"],
    },
    {
      group: "MLOps & Cloud",
      items: ["Docker", "Kubernetes", "Jenkins", "AWS", "GCP", "Airflow", "Prefect", "Dagster"],
    },
    {
      group: "Software",
      items: ["Python", "FastAPI", "Django", "PyQt / PySide2", "Next.js"],
    },
    { group: "VFX", items: ["Nuke", "Silhouette", "Unreal Engine", "Pipeline development"] },
  ],
  experience: [],
  links: [
    { label: "GitHub", href: "https://github.com/hariharan849" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/hariharan-manoharan-6b059958/" },
    { label: "Kaggle", href: "https://www.kaggle.com/hariharan849" },
  ],
};
