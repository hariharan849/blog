import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/** Called by the ingest Lambda after the 2 AM run so new posts show up immediately. */
export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok =
    expected.length > 0 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  revalidateTag("feed");
  revalidatePath("/");
  revalidatePath("/daily");
  return NextResponse.json({ revalidated: true });
}
