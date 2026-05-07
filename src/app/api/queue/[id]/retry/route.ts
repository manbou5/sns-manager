import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/queue/[id]/retry
 * 失敗したキューを "queued" に戻し、scheduledAt を即時実行に設定する。
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.postQueue.findUnique({ where: { id: params.id } });

    if (!existing) {
      return NextResponse.json({ error: "キューが見つかりません" }, { status: 404 });
    }
    if (existing.status !== "failed") {
      return NextResponse.json(
        { error: `status が "failed" のキューのみ再試行できます（現在: ${existing.status}）` },
        { status: 400 }
      );
    }

    const updated = await prisma.postQueue.update({
      where: { id: params.id },
      data: {
        status:       "queued",
        errorMessage: null,
        scheduledAt:  new Date(), // 即時実行
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    console.error("[POST /api/queue/[id]/retry]", e);
    return NextResponse.json({ error: "再試行の設定に失敗しました" }, { status: 500 });
  }
}
