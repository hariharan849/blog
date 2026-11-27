import type { Metadata } from "next";
import { feedApi, feedConfigured, safeFeed } from "@/lib/feed";
import { getLessonAuthors, getLessons } from "@/lib/posts";
import DailyView from "./DailyView";

export const metadata: Metadata = { title: "Daily Dose" };
export const revalidate = 300;

export default async function DailyPage() {
  const [feed, days] = await Promise.all([safeFeed(feedApi.day()), safeFeed(feedApi.days(14))]);
  const lessons = getLessons();
  return (
    <DailyView
      feed={feed}
      recentDays={days ?? []}
      lesson={lessons[0]}
      lessonCount={lessons.length}
      lessonAuthors={getLessonAuthors()}
      feedNote={
        feedConfigured ? "The feed is temporarily unavailable. Please try again shortly." : "The feed backend isn't connected yet."
      }
    />
  );
}
