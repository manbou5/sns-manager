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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const item = await prisma.postQueue.findUnique({
      where:   { id: params.id },
      include: { generatedContent: { select: CONTENT_SELECT } },
    });
    if (!item) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (e) {
    console.error("[GET /api/queue/[id]]", e);
    return NextResponse.json({ error: "キューの取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.postQueue.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    if (existing.status === "posted") {
      return NextResponse.json(
        { error: "投稿済みのキューは変更できません" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { platform, scheduledAt, status, errorMessage } = body;

    const newStatus =
      status !== undefined && VALID_STATUSES.has(status) ? status : existing.status;

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.postQueue.update({
        where: { id: params.id },
        data: {
          ...(platform    !== undefined ? { platform: VALID_PLATFORMS.has(platform) ? platform : existing.platform } : {}),
          ...(scheduledAt !== undefined ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null } : {}),
          ...(status      !== undefined ? { status: newStatus } : {}),
          ...(errorMessage !== undefined ? { errorMessage: errorMessage || null } : {}),
        },
        include: { generatedContent: { select: CONTENT_SELECT } },
      });

      // キャンセル時: 同コンテンツに他の queued がなければ ready に戻す
      if (newStatus === "cancelled") {
        const remaining = await tx.postQueue.count({
          where: { generatedContentId: existing.generatedContentId, status: "queued" },
        });
        if (remaining === 0) {
          const content = await tx.generatedContent.findUnique({
            where: { id: existing.generatedContentId },
          });
          if (content && content.status === "scheduled") {
            await tx.generatedContent.update({
              where: { id: existing.generatedContentId },
              data:  { status: "ready" },
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error("[PATCH /api/queue/[id]]", e);
    return NextResponse.json({ error: "キューの更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
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
    if (existing.status === "posted") {
      return NextResponse.json(
        { error: "投稿済みのキューは削除できません" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.postQueue.delete({ where: { id: params.id } });

      // 削除後に queued が残っていなければ content を ready に戻す
      const remaining = await tx.postQueue.count({
        where: { generatedContentId: existing.generatedContentId, status: "queued" },
      });
      if (remaining === 0) {
        const content = await tx.generatedContent.findUnique({
          where: { id: existing.generatedContentId },
        });
        if (content && content.status === "scheduled") {
          await tx.generatedContent.update({
            where: { id: existing.generatedContentId },
            data:  { status: "ready" },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/queue/[id]]", e);
    return NextResponse.json({ error: "キューの削除に失敗しました" }, { status: 500 });
  }
}
