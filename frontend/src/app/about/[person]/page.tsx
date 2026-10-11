import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { coverGradient } from "@/lib/cover";
import { BLOGS } from "@/lib/format";
import { buttonPrimary, buttonSecondary, card, chip, cn, container } from "@/lib/ui";

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
  const other = (Object.keys(PROFILES) as Person[]).find((key) => key !== person)!;
  return (
    <div className={cn(container, "max-w-4xl py-16 sm:py-24")}>
      <div className="grid gap-10 md:grid-cols-[200px_1fr]">
        <div>
          <div className="grid aspect-square w-40 place-items-center rounded-3xl font-serif text-6xl font-semibold text-white shadow-lg md:w-full" style={{ backgroundImage: coverGradient(person) }}>
            {blog.author[0]}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 md:flex-col md:items-start">
            {Object.entries(blog.links).map(([label, href]) => (
              <a key={label} href={href} className={chip} target="_blank" rel="noopener noreferrer">{label} ↗</a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">About</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{blog.author}</h1>
          <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">{profile.intro}</p>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-zinc-500">Expertise</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {profile.expertise.map((item) => (
              <li key={item} className={cn(card, "px-4 py-3 text-sm")}>{item}</li>
            ))}
          </ul>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-zinc-500">Why this blog</h2>
          <p className="mt-3 leading-relaxed text-zinc-600 dark:text-zinc-300">{profile.why}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={`/?blog=${person}`} className={buttonPrimary}>Read {blog.author.split(" ")[0]}&apos;s posts</Link>
            <Link href={`/about/${other}/`} className={buttonSecondary}>Meet {BLOGS[other].author.split(" ")[0]}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
