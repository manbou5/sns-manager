import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkSafety } from "@/lib/safety";

type Params = { params: { id: string } };

// 投稿詳細取得
export async function GET(_: NextRequest, { params }: Params) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: { analytics: true },
    });

    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (e) {
    console.error("[GET /api/posts/[id]]", e);
    return NextResponse.json({ error: "投稿の取得に失敗しました" }, { status: 500 });
  }
}

// 投稿更新
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    // 投稿済みは編集不可
    if (post.status === "POSTED") {
      return NextResponse.json({ error: "投稿済みの投稿は編集できません" }, { status: 400 });
    }

    const body = await req.json();
    const { title, caption, mediaPath, platform, genre, hashtags, scheduledAt, status } = body;

    if (caption !== undefined) {
      const fullText = `${caption} ${hashtags ?? post.hashtags ?? ""}`;
      const safetyResult = checkSafety(fullText);
      if (!safetyResult.passed) {
        return NextResponse.json(
          { error: "安全チェックエラー", issues: safetyResult.errors },
          { status: 422 }
        );
      }
    }

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined ? { title: title?.trim() || null } : {}),
        ...(caption !== undefined ? { caption: caption.trim() } : {}),
        ...(mediaPath !== undefined ? { mediaPath: mediaPath?.trim() || null } : {}),
        ...(platform !== undefined ? { platform } : {}),
        ...(genre !== undefined ? { genre } : {}),
        ...(hashtags !== undefined ? { hashtags: hashtags?.trim() || null } : {}),
        ...(scheduledAt !== undefined
          ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
          : {}),
        ...(status !== undefined ? { status } : {}),
      },
      include: { analytics: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/posts/[id]]", e);
    return NextResponse.json({ error: "投稿の更新に失敗しました" }, { status: 500 });
  }
}

// 投稿削除
export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const post = await prisma.post.findUnique({ where: { id: params.id } });
    if (!post) {
      return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
    }

    await prisma.post.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/posts/[id]]", e);
    return NextResponse.json({ error: "投稿の削除に失敗しました" }, { status: 500 });
  }
}
