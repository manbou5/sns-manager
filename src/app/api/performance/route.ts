import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function calcER(
  views: number,
  likes: number,
  comments: number,
  shares: number,
  saves: number
): number {
  if (views <= 0) return 0;
  return Math.round(((likes + comments + shares + saves) / views) * 10000) / 100;
}

const QUEUE_CONTENT_SELECT = {
  id:       true,
  platform: true,
  updatedAt: true,
  generatedContent: {
    select: { id: true, title: true, caption: true, mediaType: true },
  },
} as const;

// ─── GET /api/performance ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queueId = searchParams.get("queueId");

    const metrics = await prisma.performanceMetric.findMany({
      where: {
        ...(queueId ? { postQueueId: queueId } : {}),
      },
      include: { postQueue: { select: QUEUE_CONTENT_SELECT } },
      orderBy: { measuredAt: "desc" },
    });

    return NextResponse.json(metrics);
  } catch (e) {
    console.error("[GET /api/performance]", e);
    return NextResponse.json({ error: "実績データの取得に失敗しました" }, { status: 500 });
  }
}

// ─── POST /api/performance ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const {
    postQueueId,
    views       = 0,
    likes       = 0,
    comments    = 0,
    shares      = 0,
    saves       = 0,
    followersGained = 0,
    measuredAt,
  } = body;

  if (!postQueueId?.trim()) {
    return NextResponse.json({ error: "postQueueId は必須です" }, { status: 400 });
  }

  const queue = await prisma.postQueue.findUnique({ where: { id: postQueueId } });
  if (!queue) {
    return NextResponse.json({ error: "指定されたキューが見つかりません" }, { status: 404 });
  }
  if (queue.status !== "posted") {
    return NextResponse.json(
      { error: "投稿済み（posted）のキューにのみ実績を登録できます" },
      { status: 400 }
    );
  }

  const toInt = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  const vViews    = toInt(views);
  const vLikes    = toInt(likes);
  const vComments = toInt(comments);
  const vShares   = toInt(shares);
  const vSaves    = toInt(saves);

  const metric = await prisma.performanceMetric.create({
    data: {
      postQueueId,
      platform:        queue.platform,
      views:           vViews,
      likes:           vLikes,
      comments:        vComments,
      shares:          vShares,
      saves:           vSaves,
      followersGained: Math.round(Number(followersGained) || 0),
      engagementRate:  calcER(vViews, vLikes, vComments, vShares, vSaves),
      measuredAt:      measuredAt ? new Date(measuredAt) : new Date(),
    },
    include: { postQueue: { select: QUEUE_CONTENT_SELECT } },
  });

  return NextResponse.json(metric, { status: 201 });
  } catch (e) {
    console.error("[POST /api/performance]", e);
    return NextResponse.json({ error: "実績データの作成に失敗しました" }, { status: 500 });
  }
}
