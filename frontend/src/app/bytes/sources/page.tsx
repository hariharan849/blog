import InterestsManager from "@/components/bytes/InterestsManager";
import SourcesManager from "@/components/bytes/SourcesManager";
import { apiGet } from "@/lib/server-api";
import type { Interest, Source } from "@/lib/types";

export const metadata = { title: "Sources & interests" };

export default async function SourcesPage() {
  const [sources, interests] = await Promise.all([
    apiGet<Source[]>("/api/v1/bytes/sources/", { withCookies: true }),
    apiGet<Interest[]>("/api/v1/bytes/interests/", { withCookies: true }),
  ]);
  return (
    <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <SourcesManager sources={sources} />
      <InterestsManager interests={interests} />
    </div>
  );
}
