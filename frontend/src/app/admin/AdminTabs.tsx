import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Daily Dose" },
  { href: "/admin/roadmap", label: "Roadmap" },
  { href: "/admin/todos", label: "Todos" },
  { href: "/admin/progress", label: "Weekly updates" },
];

export default function AdminTabs({ current }: { current: string }) {
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === current ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
