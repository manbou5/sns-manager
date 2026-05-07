import { NextResponse } from "next/server";
import { runAutoPost, countDueItems, countUpcomingItems, nextScheduledAt } from "@/lib/autoPost";

/** POST /api/queue/auto-post — 期限到来キューを一括投稿 */
export async function POST() {
  try {
    const result = await runAutoPost();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[POST /api/queue/auto-post]", e);
    return NextResponse.json(
      { ok: false, message: "自動投稿の実行に失敗しました" },
      { status: 500 }
    );
  }
}

/** GET /api/queue/auto-post — 処理待ち件数・次回予定を返す */
export async function GET() {
  try {
    const [due, upcoming, next] = await Promise.all([
      countDueItems(),
      countUpcomingItems(),
      nextScheduledAt(),
    ]);
    return NextResponse.json({ due, upcoming, nextScheduledAt: next });
  } catch (e) {
    console.error("[GET /api/queue/auto-post]", e);
    return NextResponse.json(
      { error: "ステータス取得に失敗しました" },
      { status: 500 }
    );
  }
}
