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
    <div className="row">
      <div className="col-lg-7">
        <SourcesManager sources={sources} />
      </div>
      <div className="col-lg-5">
        <InterestsManager interests={interests} />
      </div>
    </div>
  );
}
