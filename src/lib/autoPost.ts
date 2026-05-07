import { prisma } from "@/lib/db";
import { postToSNS } from "@/lib/poster";

// ─── 型 ─────────────────────────────────────────────────────────────────────

export type AutoPostItemResult = {
  id: string;
  title: string | null;
  platform: string;
  status: "posted" | "failed";
  externalPostId?: string;
  error?: string;
};

export type AutoPostResult = {
  processed: number;
  succeeded: number;
  failed: number;
  items: AutoPostItemResult[];
};

// ─── メイン ──────────────────────────────────────────────────────────────────

/**
 * scheduledAt <= now かつ status = "queued" のキューを一括自動投稿する。
 * 各アイテムを順次処理し、成功/失敗をDBに記録する。
 */
export async function runAutoPost(): Promise<AutoPostResult> {
  const now = new Date();

  const dueItems = await prisma.postQueue.findMany({
    where: {
      status: "queued",
      scheduledAt: { lte: now },
    },
    include: { generatedContent: true },
    orderBy: { scheduledAt: "asc" },
  });

  const result: AutoPostResult = {
    processed: dueItems.length,
    succeeded: 0,
    failed: 0,
    items: [],
  };

  for (const item of dueItems) {
    const caption  = item.generatedContent.caption  ?? "";
    const hashtags = (item.generatedContent as { hashtags?: string | null }).hashtags ?? null;

    try {
      const postResult = await postToSNS(item.platform, caption, hashtags);

      if (postResult.success) {
        // 成功: posted へ更新し、GeneratedContent も posted に
        await prisma.postQueue.update({
          where: { id: item.id },
          data: {
            status: "posted",
            externalPostId: postResult.externalPostId ?? null,
            errorMessage: null,
            postedAt: new Date(),
          },
        });
        await prisma.generatedContent.update({
          where: { id: item.generatedContentId },
          data: { status: "posted" },
        });

        result.succeeded++;
        result.items.push({
          id: item.id,
          title: item.generatedContent.title,
          platform: item.platform,
          status: "posted",
          externalPostId: postResult.externalPostId,
        });
        console.log(
          `[autoPost] ✓ id=${item.id} platform=${item.platform} externalId=${postResult.externalPostId}`
        );
      } else {
        const errorMsg = postResult.error ?? "投稿に失敗しました";
        await prisma.postQueue.update({
          where: { id: item.id },
          data: { status: "failed", errorMessage: errorMsg },
        });

        result.failed++;
        result.items.push({
          id: item.id,
          title: item.generatedContent.title,
          platform: item.platform,
          status: "failed",
          error: errorMsg,
        });
        console.error(`[autoPost] ✗ id=${item.id} error=${errorMsg}`);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "不明なエラー";
      await prisma.postQueue.update({
        where: { id: item.id },
        data: { status: "failed", errorMessage: errorMsg },
      });

      result.failed++;
      result.items.push({
        id: item.id,
        title: item.generatedContent.title,
        platform: item.platform,
        status: "failed",
        error: errorMsg,
      });
      console.error(`[autoPost] ✗ id=${item.id} exception:`, e);
    }
  }

  return result;
}

// ─── ステータス集計 ───────────────────────────────────────────────────────────

/** scheduledAt が現在時刻以前で未処理のキュー件数 */
export async function countDueItems(): Promise<number> {
  return prisma.postQueue.count({
    where: { status: "queued", scheduledAt: { lte: new Date() } },
  });
}

/** 将来の scheduledAt を持つ待機中キュー件数 */
export async function countUpcomingItems(): Promise<number> {
  return prisma.postQueue.count({
    where: { status: "queued", scheduledAt: { gt: new Date() } },
  });
}

/** 直近の scheduledAt（次回自動投稿予定）*/
export async function nextScheduledAt(): Promise<Date | null> {
  const item = await prisma.postQueue.findFirst({
    where: { status: "queued", scheduledAt: { gt: new Date() } },
    orderBy: { scheduledAt: "asc" },
    select: { scheduledAt: true },
  });
  return item?.scheduledAt ?? null;
}
