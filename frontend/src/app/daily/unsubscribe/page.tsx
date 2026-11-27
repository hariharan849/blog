import type { Metadata } from "next";
import UnsubscribeForm from "./UnsubscribeForm";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ id?: string; token?: string }> };

export default async function UnsubscribePage({ searchParams }: Props) {
  const { id, token } = await searchParams;
  return (
    <section className="hero narrow">
      <p className="eyebrow">Daily Dose</p>
      <h1>Unsubscribe</h1>
      {id && token ? (
        <>
          <p className="lead">Stop getting the daily lesson by email? You can subscribe again any time.</p>
          <UnsubscribeForm id={id} token={token} />
        </>
      ) : (
        <p className="lead">This unsubscribe link is incomplete. Use the link at the bottom of any Daily Dose email.</p>
      )}
    </section>
  );
}
