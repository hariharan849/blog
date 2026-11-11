import type { Metadata } from "next";
import { feedApi, feedConfigured, safeFeed } from "@/lib/feed";
import DailyView from "./DailyView";

export const metadata: Metadata = { title: "Daily Dose" };
export const revalidate = 300;

export default async function DailyPage() {
  const [feed, days] = await Promise.all([safeFeed(feedApi.day()), safeFeed(feedApi.days(14))]);
  if (!feed) {
    return (
      <section className="hero narrow">
        <h1>Daily Dose</h1>
        <p className="muted">
          {feedConfigured ? "The feed is temporarily unavailable. Please try again shortly." : "The feed backend isn't connected yet."}
        </p>
      </section>
    );
  }
  return <DailyView feed={feed} recentDays={days ?? []} />;
}
