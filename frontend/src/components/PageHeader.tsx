import { cn, container } from "@/lib/ui";

export default function PageHeader({ eyebrow, title, description, children, narrow = false }: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={cn(container, narrow && "max-w-3xl", "pb-8 pt-14 sm:pt-20")}>
      {eyebrow && <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{eyebrow}</p>}
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      {description && <p className="mt-4 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">{description}</p>}
      {children}
    </div>
  );
}
