import type { Metadata } from "next";

import AskPanel from "@/components/AskPanel";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/server-api";
import { cn, container } from "@/lib/ui";

export const metadata: Metadata = { title: "Ask", description: "Ask a question and get an answer grounded in the blog, with citations." };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const { q } = await searchParams;
  const user = await getCurrentUser();
  return (
    <>
      <PageHeader
        eyebrow="Ask"
        title="Ask the blog"
        description={user?.is_staff
          ? "Answers are written from the blog and your newsletter library, and every claim links to its source."
          : "Answers are written from the posts on this blog, and every claim links to its source."}
        narrow
      />
      <div className={cn(container, "max-w-3xl")}>
        <AskPanel initialQuestion={typeof q === "string" ? q : ""} canUseNewsletters={!!user?.is_staff} />
      </div>
    </>
  );
}
