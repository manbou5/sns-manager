import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkSafety } from "@/lib/safety";

// 投稿一覧取得
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const platform = searchParams.get("platform");

    const posts = await prisma.post.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(platform ? { platform } : {}),
      },
      include: { analytics: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(posts);
  } catch (e) {
    console.error("[GET /api/posts]", e);
    return NextResponse.json({ error: "投稿の取得に失敗しました" }, { status: 500 });
  }
}

// 投稿作成
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, caption, mediaPath, platform, genre, hashtags, scheduledAt } = body;

    if (!caption?.trim()) {
      return NextResponse.json({ error: "キャプションは必須です" }, { status: 400 });
    }

    // 安全チェック
    const fullText = `${caption} ${hashtags ?? ""}`;
    const safetyResult = checkSafety(fullText);
    if (!safetyResult.passed) {
      return NextResponse.json(
        { error: "安全チェックエラー", issues: safetyResult.errors },
        { status: 422 }
      );
    }

    const status = scheduledAt ? "SCHEDULED" : "DRAFT";

    const post = await prisma.post.create({
      data: {
        title: title?.trim() || null,
        caption: caption.trim(),
        mediaPath: mediaPath?.trim() || null,
        platform: platform ?? "X",
        genre: genre ?? "LIFESTYLE",
        hashtags: hashtags?.trim() || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status,
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    console.error("[POST /api/posts]", e);
    return NextResponse.json({ error: "投稿の作成に失敗しました" }, { status: 500 });
  }
}
