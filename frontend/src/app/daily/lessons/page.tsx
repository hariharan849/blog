import type { Metadata } from "next";
import Link from "next/link";
import { getLessons } from "@/lib/posts";
import LessonCard from "@/components/LessonCard";
import SubscribeForm from "@/components/SubscribeForm";

export const metadata: Metadata = {
  title: "Daily lessons",
  description: "One engineering lesson a day, written from a talk or tutorial worth knowing.",
};

export default function LessonsPage() {
  const lessons = getLessons();
  return (
    <>
      <section className="hero">
        <p className="eyebrow">
          <Link href="/daily">Daily Dose</Link>
        </p>
        <h1>Daily lessons</h1>
        <p className="lead">
          One engineering lesson a day, written from a talk or tutorial on my watch list, so it takes a few minutes to
          read instead of an hour to watch.
        </p>
        <SubscribeForm compact />
      </section>
      {lessons.length ? (
        <div className="stack">
          {lessons.map((l) => (
            <LessonCard key={l.slug} lesson={l} />
          ))}
        </div>
      ) : (
        <p className="muted empty">No lessons yet. The first one arrives with the next daily run.</p>
      )}
    </>
  );
}
