import { NextResponse } from "next/server";
import { updateDb } from "@/lib/store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;

  await updateDb((db) => {
    const item = db.showcaseItems.find((entry) => entry.id === itemId);

    if (!item) {
      return;
    }

    item.viewCount += 1;
    item.updatedAt = new Date().toISOString();
  });

  return NextResponse.json({ ok: true });
}
