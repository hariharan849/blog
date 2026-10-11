import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="PyChanter home">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 font-serif text-lg font-semibold text-white shadow-sm shadow-indigo-500/30 transition group-hover:rotate-6">
        P
      </span>
      <span className="font-serif text-lg font-semibold tracking-tight">PyChanter</span>
    </Link>
  );
}
