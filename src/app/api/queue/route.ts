import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_STATUSES  = new Set(["queued", "posted", "failed", "cancelled"]);
const VALID_PLATFORMS = new Set(["X", "INSTAGRAM", "BOTH"]);

const CONTENT_SELECT = {
  id:        true,
  title:     true,
  caption:   true,
  hashtags:  true,
  mediaType: true,
  mediaUrl:  true,
} as const;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const items = await prisma.postQueue.findMany({
      where: {
        ...(status && VALID_STATUSES.has(status) ? { status } : {}),
      },
      include: { generatedContent: { select: CONTENT_SELECT } },
      orderBy: [
        { status: "asc" },
        { scheduledAt: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(items);
  } catch (e) {
    console.error("[GET /api/queue]", e);
    return NextResponse.json({ error: "キューの取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const { generatedContentId, platform, scheduledAt } = body;

  if (!generatedContentId?.trim()) {
    return NextResponse.json(
      { error: "generatedContentId は必須です" },
      { status: 400 }
    );
  }

  const content = await prisma.generatedContent.findUnique({
    where: { id: generatedContentId },
  });
  if (!content) {
    return NextResponse.json(
      { error: "指定されたコンテンツが見つかりません" },
      { status: 404 }
    );
  }
  if (content.status === "posted") {
    return NextResponse.json(
      { error: "投稿済みのコンテンツはキューに追加できません" },
      { status: 400 }
    );
  }

  const [item] = await prisma.$transaction([
    prisma.postQueue.create({
      data: {
        generatedContentId,
        platform:   VALID_PLATFORMS.has(platform) ? platform : "X",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status:     "queued",
      },
      include: { generatedContent: { select: CONTENT_SELECT } },
    }),
    // コンテンツのステータスを scheduled に更新（draft/ready の場合のみ）
    ...(content.status === "draft" || content.status === "ready"
      ? [
          prisma.generatedContent.update({
            where: { id: generatedContentId },
            data:  { status: "scheduled" },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(item, { status: 201 });
  } catch (e) {
    console.error("[POST /api/queue]", e);
    return NextResponse.json({ error: "キューの作成に失敗しました" }, { status: 500 });
  }
}
