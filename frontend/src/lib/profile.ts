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
  /** Medium username (without @); their articles fill the Articles tab. */
  medium: string;
  links: { label: string; href: string }[];
};

export const profile: Profile = {
  name: "Hariharan Manoharan",
  shortName: "Hariharan",
  headline: "I build GenAI systems: agents, retrieval and LLMs in production.",
  role: "Lead AI Engineer · GenAI, Agents & Deep Learning",
  intro:
    "Lead AI Engineer with 9+ years of building software, from AI-powered tools and pipeline automation to high-performance systems. Today I lead work on agentic workflows, retrieval systems and serving LLMs in production.",
  about: [
    "I'm Hariharan, a Lead AI Engineer. Over 9+ years I've built AI-powered tools, pipeline automation and high-performance software, starting in the VFX industry before moving fully into AI.",
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
    { group: "Earlier: VFX", items: ["Nuke", "Silhouette", "Unreal Engine", "Pipeline development"] },
  ],
  experience: [],
  medium: "hari.haran849",
  links: [
    { label: "GitHub", href: "https://github.com/hariharan849" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/hariharan-manoharan-6b059958/" },
    { label: "Medium", href: "https://medium.com/@hari.haran849" },
    { label: "Kaggle", href: "https://www.kaggle.com/hariharan849" },
  ],
};
