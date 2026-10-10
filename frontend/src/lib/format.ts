const UTC = { timeZone: "UTC" } as const;

export function formatDate(value: string | null | undefined, style: "short" | "long" = "long"): string {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return date.toLocaleDateString("en-US", {
    ...UTC,
    ...(style === "long"
      ? { year: "numeric", month: "long", day: "numeric" }
      : { month: "short", day: "numeric" }),
  });
}

export function truncateWords(text: string, count: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= count ? text : `${words.slice(0, count).join(" ")}…`;
}

/** JSON for a <script type="application/ld+json"> tag that cannot break out of the script element. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const BLOGS = {
  hariharan: {
    label: "Hariharan's Blog",
    author: "Hariharan Manoharan",
    links: {
      LinkedIn: "https://www.linkedin.com/in/hariharan-manoharan-6b059958/",
      GitHub: "https://github.com/hariharan849",
      Kaggle: "https://www.kaggle.com/hariharan849",
    },
  },
  rajan: {
    label: "Rajan's Blog",
    author: "Rajan Singh",
    links: {
      LinkedIn: "https://www.linkedin.com/in/rajan-singh-parmar-3698891b1/",
      GitHub: "https://github.com/rajanpratap",
      Kaggle: "https://www.kaggle.com/rajansinghparmar",
    },
  },
} as const;
