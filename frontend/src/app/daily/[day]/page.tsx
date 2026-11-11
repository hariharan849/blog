import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { feedApi, FeedApiError } from "@/lib/feed";
import { formatDay } from "@/lib/format";
import DailyView from "../DailyView";

type Props = { params: Promise<{ day: string }> };

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day } = await params;
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? { title: `Daily Dose · ${formatDay(day)}` } : {};
}

export default async function DayPage({ params }: Props) {
  const { day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  try {
    const [feed, days] = await Promise.all([feedApi.day(day), feedApi.days(14)]);
    if (!feed.items.length) notFound();
    return <DailyView feed={feed} recentDays={days} />;
  } catch (err) {
    if (err instanceof FeedApiError && err.status === 400) notFound();
    throw err;
  }
}
