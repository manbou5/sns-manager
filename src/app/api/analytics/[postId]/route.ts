import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { postId: string } };

// 投稿の分析データ取得
export async function GET(_: NextRequest, { params }: Params) {
  try {
    const analytics = await prisma.analytics.findUnique({
      where: { postId: params.postId },
    });
    return NextResponse.json(analytics);
  } catch (e) {
    console.error("[GET /api/analytics/[postId]]", e);
    return NextResponse.json({ error: "分析データの取得に失敗しました" }, { status: 500 });
  }
}

// 分析データ作成・更新（upsert）
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();
    const { impressions, likes, reposts, clicks, followerGain } = body;

    // 投稿の存在確認
    const post = await prisma.post.findUnique({ where: { id: params.postId } });
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    const analytics = await prisma.analytics.upsert({
      where: { postId: params.postId },
      create: {
        postId: params.postId,
        impressions: impressions ?? 0,
        likes: likes ?? 0,
        reposts: reposts ?? 0,
        clicks: clicks ?? 0,
        followerGain: followerGain ?? 0,
      },
      update: {
        impressions: impressions ?? 0,
        likes: likes ?? 0,
        reposts: reposts ?? 0,
        clicks: clicks ?? 0,
        followerGain: followerGain ?? 0,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(analytics);
  } catch (e) {
    console.error("[PUT /api/analytics/[postId]]", e);
    return NextResponse.json({ error: "分析データの更新に失敗しました" }, { status: 500 });
  }
}
