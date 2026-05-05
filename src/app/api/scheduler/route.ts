import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// スケジューラーチェックエンドポイント
// 予約時刻を過ぎた投稿を SCHEDULED → PENDING_CONFIRMATION に変更する
export async function POST() {
  try {
    const now = new Date();

    const duePosts = await prisma.post.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
    });

    if (duePosts.length === 0) {
      return NextResponse.json({ updated: 0, posts: [] });
    }

    await prisma.post.updateMany({
      where: { id: { in: duePosts.map((p) => p.id) } },
      data: { status: "PENDING_CONFIRMATION" },
    });

    return NextResponse.json({
      updated: duePosts.length,
      posts: duePosts.map((p) => ({ id: p.id, title: p.title, caption: p.caption })),
    });
  } catch (e) {
    console.error("[POST /api/scheduler]", e);
    return NextResponse.json({ error: "スケジューラーの実行に失敗しました", updated: 0, posts: [] }, { status: 500 });
  }
}
