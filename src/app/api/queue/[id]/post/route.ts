import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 疑似投稿: status を "posted" に変更し、GeneratedContent も "posted" に更新する
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.postQueue.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    if (existing.status !== "queued") {
      return NextResponse.json(
        { error: `status が "queued" のキューのみ投稿できます（現在: ${existing.status}）` },
        { status: 400 }
      );
    }

    const [item] = await prisma.$transaction([
      prisma.postQueue.update({
        where: { id: params.id },
        data:  { status: "posted" },
        include: {
          generatedContent: {
            select: { id: true, title: true, caption: true, hashtags: true, mediaType: true, mediaUrl: true },
          },
        },
      }),
      prisma.generatedContent.update({
        where: { id: existing.generatedContentId },
        data:  { status: "posted" },
      }),
    ]);

    return NextResponse.json(item);
  } catch (e) {
    console.error("[POST /api/queue/[id]/post]", e);
    return NextResponse.json({ error: "投稿処理に失敗しました" }, { status: 500 });
  }
}
