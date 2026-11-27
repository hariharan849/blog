"use server";

import { feedApi, FeedApiError } from "@/lib/feed";

export type SubscribeResult = { ok: boolean; message: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function subscribe(_prev: SubscribeResult | null, formData: FormData): Promise<SubscribeResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Please enter a valid email address." };
  try {
    await feedApi.subscribe(email, String(formData.get("company") ?? ""));
    return { ok: true, message: "Almost done: check your inbox and click the link to confirm." };
  } catch (err) {
    if (err instanceof FeedApiError && (err.status === 400 || err.status === 503)) {
      return { ok: false, message: err.status === 503 ? "Email subscriptions open soon." : err.message };
    }
    console.error(err);
    return { ok: false, message: "Something went wrong. Please try again in a minute." };
  }
}

export async function unsubscribe(_prev: SubscribeResult | null, formData: FormData): Promise<SubscribeResult> {
  try {
    await feedApi.unsubscribe(String(formData.get("id") ?? ""), String(formData.get("token") ?? ""));
    return { ok: true, message: "You're unsubscribed. You won't get any more Daily Dose emails." };
  } catch (err) {
    if (err instanceof FeedApiError && (err.status === 400 || err.status === 404)) {
      return { ok: false, message: "This unsubscribe link is no longer valid." };
    }
    console.error(err);
    return { ok: false, message: "Something went wrong. Please try again in a minute." };
  }
}
