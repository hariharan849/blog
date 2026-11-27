/** Portfolio projects, drawn from github.com/hariharan849. `featured` ones appear on the home page. */
export type Project = {
  name: string;
  summary: string;
  tags: string[];
  repo: string;
  category: "GenAI & Agents" | "MLOps" | "Deep Learning" | "Tools";
  featured?: boolean;
};

const GH = "https://github.com/hariharan849";
const GENAI = `${GH}/GenAI/tree/main`;

export const projects: Project[] = [
  {
    name: "Production-Grade RAG for Nuke",
    summary:
      "A retrieval-augmented assistant over the Foundry Nuke docs: hybrid semantic + keyword search, an agentic LangGraph workflow, FastAPI backend, Next.js chat UI, evaluation tooling and observability, with Airflow, Prefect or Dagster ingestion.",
    tags: ["LangGraph", "RAG", "FastAPI", "Next.js", "Airflow"],
    repo: `${GENAI}/Production-grade-RAG`,
    category: "GenAI & Agents",
    featured: true,
  },
  {
    name: "Multi-Agent Course Creator (A2A + MCP)",
    summary:
      "A distributed, learner-adaptive course builder. A LangGraph orchestrator coordinates researcher, judge and content-builder agents over the Agent-to-Agent protocol, sharing a source-verification service over MCP.",
    tags: ["A2A", "MCP", "LangGraph", "Multi-agent"],
    repo: `${GENAI}/multi-agent-a2a-mcp`,
    category: "GenAI & Agents",
    featured: true,
  },
  {
    name: "Blog2Podcast",
    summary:
      "Turns any blog URL into a conversational podcast script and ElevenLabs audio. Built four ways, with AutoGen, CrewAI, Google ADK and LangGraph, to compare agent frameworks side by side.",
    tags: ["AutoGen", "CrewAI", "Google ADK", "LangGraph", "Streamlit"],
    repo: `${GENAI}/Blog2Podcast`,
    category: "GenAI & Agents",
    featured: true,
  },
  {
    name: "GitHub Assistant Agent",
    summary:
      "A CrewAI assistant that indexes GitHub repositories locally, answers questions from retrieved code context and falls back to GitHub search. Ships with a CLI, Gradio UI, Docker setup and tests.",
    tags: ["CrewAI", "RAG", "Gradio", "Docker"],
    repo: `${GENAI}/github_assistant_agent`,
    category: "GenAI & Agents",
  },
  {
    name: "Mid Software Engineer Agent",
    summary:
      "A LangChain DeepAgents workflow that behaves like a mid-level engineer: shaping requirements, design review, incremental implementation with tests, demos and release prep, with LangSmith-compatible tracing.",
    tags: ["DeepAgents", "LangChain", "LangSmith"],
    repo: `${GENAI}/mid_software_engineer`,
    category: "GenAI & Agents",
  },
  {
    name: "vLLM Serve",
    summary:
      "A compact FastAPI service around vLLM exposing an OpenAI-compatible, streaming chat-completions endpoint for GPU-backed inference.",
    tags: ["vLLM", "FastAPI", "LLM serving"],
    repo: `${GENAI}/vllm`,
    category: "GenAI & Agents",
    featured: true,
  },
  {
    name: "Anime Recommender (LLMOps)",
    summary:
      "An LLM-powered recommendation engine backed by a ChromaDB vector store, containerised with Docker and deployed to Kubernetes.",
    tags: ["LLMOps", "ChromaDB", "Docker", "Kubernetes"],
    repo: `${GH}/AnimeRecommender`,
    category: "MLOps",
  },
  {
    name: "Phishing Detection (Network Security)",
    summary:
      "An end-to-end ML pipeline for phishing data: MongoDB ingestion, training, a prediction app and CI/CD to AWS ECR and EC2.",
    tags: ["MLOps", "AWS", "MongoDB", "Docker"],
    repo: `${GH}/security`,
    category: "MLOps",
  },
  {
    name: "MLOps Pipelines with Jenkins",
    summary:
      "Data ingestion, preprocessing and training pipelines with Jenkins CI/CD, Docker and cloud storage on AWS and GCS.",
    tags: ["Jenkins", "Docker", "AWS", "GCP"],
    repo: `${GH}/MLOps_Jenkins`,
    category: "MLOps",
  },
  {
    name: "Deep Learning for Vision",
    summary:
      "Hands-on deep learning for images: classification, object detection with Detectron2 and YOLO, GANs and OpenCV, plus early agentic-AI experiments.",
    tags: ["PyTorch", "Detectron2", "YOLO", "GAN"],
    repo: `${GH}/DeepLearning`,
    category: "Deep Learning",
    featured: true,
  },
  {
    name: "ML Python Notes",
    summary: "Notebooks that walk through how the core scikit-learn algorithms work, plus XGBoost basics.",
    tags: ["scikit-learn", "XGBoost", "Jupyter"],
    repo: `${GH}/MLPythonNotes`,
    category: "Deep Learning",
  },
  {
    name: "GST Billing",
    summary:
      "Desktop invoicing for sales, purchases, purchase orders and quotations, with credit/debit vouchers and chart-based analysis.",
    tags: ["Python", "Desktop", "Charts"],
    repo: `${GH}/GST-Billing`,
    category: "Tools",
    featured: true,
  },
  {
    name: "PyChanter",
    summary: "A Python code editor built on PyQt5 and QScintilla.",
    tags: ["PyQt5", "QScintilla"],
    repo: `${GH}/PyChanter`,
    category: "Tools",
  },
  {
    name: "camel2Snake",
    summary: "A comparison tool for Python code.",
    tags: ["Python", "CLI"],
    repo: `${GH}/camel2Snake`,
    category: "Tools",
  },
];

export const projectCategories = ["GenAI & Agents", "MLOps", "Deep Learning", "Tools"] as const;
