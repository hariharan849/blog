import FailuresPanel from "@/components/bytes/FailuresPanel";
import InterestsManager from "@/components/bytes/InterestsManager";
import SourcesManager from "@/components/bytes/SourcesManager";
import { apiGet } from "@/lib/server-api";
import type { Interest, Page, PipelineFailure, Source } from "@/lib/types";

export const metadata = { title: "Sources & interests" };

export default async function SourcesPage() {
  const [sources, interests, failures] = await Promise.all([
    apiGet<Source[]>("/api/v1/bytes/sources/", { withCookies: true }),
    apiGet<Interest[]>("/api/v1/bytes/interests/", { withCookies: true }),
    apiGet<Page<PipelineFailure>>("/api/v1/bytes/failures/?resolved=0&page_size=10", { withCookies: true }),
  ]);
  return (
    <div className="space-y-12">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <SourcesManager sources={sources} />
        <InterestsManager interests={interests} />
      </div>
      <FailuresPanel failures={failures.results} total={failures.count} />
    </div>
  );
}
