import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const metric = await prisma.performanceMetric.findUnique({
      where:   { id: params.id },
      include: { postQueue: { select: QUEUE_CONTENT_SELECT } },
    });
    if (!metric) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json(metric);
  } catch (e) {
    console.error("[GET /api/performance/[id]]", e);
    return NextResponse.json({ error: "実績データの取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.performanceMetric.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    const body = await req.json();
    const toInt = (v: unknown, fallback: number) =>
      v !== undefined ? Math.max(0, Math.round(Number(v) || 0)) : fallback;

    const vViews    = toInt(body.views,    existing.views);
    const vLikes    = toInt(body.likes,    existing.likes);
    const vComments = toInt(body.comments, existing.comments);
    const vShares   = toInt(body.shares,   existing.shares);
    const vSaves    = toInt(body.saves,    existing.saves);
    const vFG       = body.followersGained !== undefined
      ? Math.round(Number(body.followersGained) || 0)
      : existing.followersGained;

    const metric = await prisma.performanceMetric.update({
      where: { id: params.id },
      data: {
        views:           vViews,
        likes:           vLikes,
        comments:        vComments,
        shares:          vShares,
        saves:           vSaves,
        followersGained: vFG,
        engagementRate:  calcER(vViews, vLikes, vComments, vShares, vSaves),
        ...(body.measuredAt !== undefined
          ? { measuredAt: new Date(body.measuredAt) }
          : {}),
      },
      include: { postQueue: { select: QUEUE_CONTENT_SELECT } },
    });

    return NextResponse.json(metric);
  } catch (e) {
    console.error("[PATCH /api/performance/[id]]", e);
    return NextResponse.json({ error: "実績データの更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.performanceMetric.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    await prisma.performanceMetric.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/performance/[id]]", e);
    return NextResponse.json({ error: "実績データの削除に失敗しました" }, { status: 500 });
  }
}
