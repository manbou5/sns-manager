import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publishPost } from "@/lib/publisher";
import { checkPostingFrequency } from "@/lib/safety";
import type { Post } from "@/types";

type Params = { params: { id: string } };

// 投稿確認・実行エンドポイント
export async function POST(req: NextRequest, { params }: Params) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { analytics: true },
  });

  if (!post) {
    return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
  }

  if (post.status !== "PENDING_CONFIRMATION") {
    return NextResponse.json(
      { error: "この投稿は確認待ち状態ではありません" },
      { status: 400 }
    );
  }

  // 直近投稿の間隔チェック
  const lastPosted = await prisma.post.findFirst({
    where: { status: "POSTED" },
    orderBy: { postedAt: "desc" },
  });

  const frequencyWarning = checkPostingFrequency(
    lastPosted?.postedAt ?? null
  );

  // 強制フラグがなければ警告を返す
  const body = await req.json().catch(() => ({}));
  if (frequencyWarning && !body.forcePost) {
    return NextResponse.json(
      { warning: frequencyWarning, requiresForce: true },
      { status: 409 }
    );
  }

  // 投稿実行
  try {
    const results = await publishPost(post as unknown as Post);
    const allSuccess = results.every((r) => r.success);

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: {
        status: allSuccess ? "POSTED" : "FAILED",
        postedAt: allSuccess ? new Date() : null,
        errorMsg: allSuccess
          ? null
          : results.map((r) => r.error).filter(Boolean).join(", "),
      },
    });

    return NextResponse.json({ success: allSuccess, post: updated, results });
  } catch (err) {
    await prisma.post.update({
      where: { id: params.id },
      data: { status: "FAILED", errorMsg: String(err) },
    });
    return NextResponse.json({ error: "投稿に失敗しました", detail: String(err) }, { status: 500 });
  }
}
