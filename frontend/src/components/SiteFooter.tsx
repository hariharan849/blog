import Link from "next/link";

import Logo from "./Logo";

import { BLOGS } from "@/lib/format";
import { cn, container } from "@/lib/ui";

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-zinc-200 dark:border-zinc-800">
      <div className={cn(container, "grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]")}>
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Notes on deep learning, machine learning and building with AI. Search by meaning, or ask a question with ⌘K.
          </p>
        </div>
        {Object.entries(BLOGS).map(([key, blog]) => (
          <div key={key}>
            <h2 className="text-sm font-semibold">{blog.author}</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link className="hover:text-zinc-900 dark:hover:text-white" href={`/about/${key}/`}>About</Link></li>
              {Object.entries(blog.links).map(([label, href]) => (
                <li key={label}>
                  <a className="hover:text-zinc-900 dark:hover:text-white" href={href} target="_blank" rel="noopener noreferrer">{label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={cn(container, "flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 py-6 text-xs text-zinc-400 dark:border-zinc-900")}>
        <span>&copy; {new Date().getFullYear()} PyChanter</span>
        <span className="space-x-4">
          <a href="/sitemap.xml" className="hover:text-zinc-700 dark:hover:text-zinc-200">Sitemap</a>
          <a href="/llms.txt" className="hover:text-zinc-700 dark:hover:text-zinc-200">llms.txt</a>
        </span>
      </div>
    </footer>
  );
}
