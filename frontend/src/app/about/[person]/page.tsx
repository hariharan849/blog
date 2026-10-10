import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BLOGS } from "@/lib/format";

const PROFILES = {
  hariharan: {
    intro:
      "Hi, I'm Hariharan, a Senior Software Developer specializing in VFX and Deep Learning. With over 9 years of experience, I have worked on AI-powered tools, pipeline automation, and high-performance computing.",
    expertise: ["AI & Machine Learning", "VFX & Pipeline Development", "Python, Django, PyQt/PySide2", "Nuke, Silhouette, Unreal Engine"],
    why: "This blog is my way of sharing knowledge on deep learning, AI integration in VFX, and best practices in software development.",
  },
  rajan: {
    intro:
      "Hi, I'm Rajan, a Data Scientist and Machine Learning Enthusiast. With a strong background in statistical modeling and computer vision, I've been developing AI solutions that transform complex data into meaningful insights.",
    expertise: ["Data Science & Analytics", "Machine Learning & Deep Learning", "Python, R, and TensorFlow", "Computer Vision and Natural Language Processing"],
    why: "This blog is my platform for sharing the latest trends in AI, deep learning techniques, and best practices in data-driven decision making. Here, I break down complex concepts into actionable insights for fellow enthusiasts and professionals.",
  },
} as const;

type Person = keyof typeof PROFILES;
type Props = PageProps<"/about/[person]">;

export function generateStaticParams() {
  return Object.keys(PROFILES).map((person) => ({ person }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { person } = await params;
  return { title: person in BLOGS ? `About ${BLOGS[person as Person].author}` : "Not found" };
}

export default async function AboutPage({ params }: Props) {
  const { person } = await params;
  if (!(person in PROFILES)) notFound();
  const profile = PROFILES[person as Person];
  const blog = BLOGS[person as Person];
  return (
    <div className="row py-4">
      <div className="col-md-4 text-center mb-4">
        <div className="avatar rounded-circle text-white d-inline-flex align-items-center justify-content-center">
          {blog.author[0]}
        </div>
      </div>
      <div className="col-md-8">
        <h1 className="h2">About Me</h1>
        <p>{profile.intro}</p>
        <h2 className="h4">My Expertise</h2>
        <ul>{profile.expertise.map((item) => <li key={item}>{item}</li>)}</ul>
        <h2 className="h4">Why This Blog?</h2>
        <p>{profile.why}</p>
        <p>
          {Object.entries(blog.links).map(([label, href]) => (
            <a key={label} href={href} className="me-3" target="_blank" rel="noopener noreferrer">{label}</a>
          ))}
        </p>
      </div>
    </div>
  );
}
