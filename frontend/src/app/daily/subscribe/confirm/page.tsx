import type { Metadata } from "next";
import Link from "next/link";
import { feedApi, FeedApiError } from "@/lib/feed";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ id?: string; token?: string }> };

async function confirm(id?: string, token?: string): Promise<{ ok: boolean; message: string }> {
  if (!id || !token) return { ok: false, message: "This confirmation link is incomplete." };
  try {
    await feedApi.confirmSubscription(id, token);
    return { ok: true, message: "You're subscribed. Your first lesson arrives with the next Daily Dose." };
  } catch (err) {
    if (err instanceof FeedApiError && (err.status === 400 || err.status === 404)) {
      return { ok: false, message: "This confirmation link is no longer valid. Please subscribe again." };
    }
    console.error(err);
    return { ok: false, message: "We couldn't confirm your subscription right now. Please try the link again later." };
  }
}

export default async function ConfirmPage({ searchParams }: Props) {
  const { id, token } = await searchParams;
  const result = await confirm(id, token);
  return (
    <section className="hero narrow">
      <p className="eyebrow">Daily Dose</p>
      <h1>{result.ok ? "You're in" : "Something's off"}</h1>
      <p className="lead">{result.message}</p>
      <div className="actions">
        <Link href="/daily" className="button">
          Read today&apos;s Daily Dose
        </Link>
      </div>
    </section>
  );
}
