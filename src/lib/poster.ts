/**
 * SNS 投稿ルーター
 *
 * autoPost.ts から呼ばれ、プラットフォームに応じた投稿関数へ振り分ける。
 * X の実投稿 / ダミー切り替えは publisher/twitter.ts が管理する。
 */

import { postTweet } from "@/lib/publisher/twitter";

// ─── 型 ─────────────────────────────────────────────────────────────────────

export type PostResult = {
  success: boolean;
  externalPostId?: string;
  error?: string;
};

// ─── X (Twitter) ─────────────────────────────────────────────────────────────

async function postToX(caption: string, hashtags: string | null): Promise<PostResult> {
  const text = [caption, hashtags].filter(Boolean).join("\n");
  const result = await postTweet(text);
  return {
    success:       result.success,
    externalPostId: result.platformPostId,
    error:         result.error,
  };
}

// ─── Instagram ───────────────────────────────────────────────────────────────
// TODO: 本番実装 — Instagram Graph API
// 現在はダミー投稿（ログ出力のみ）

async function postToInstagram(caption: string, hashtags: string | null): Promise<PostResult> {
  const text = [caption, hashtags].filter(Boolean).join("\n");
  console.log(`[poster:Instagram] 投稿内容: ${text.slice(0, 60)}${text.length > 60 ? "..." : ""}`);
  await new Promise((r) => setTimeout(r, 300));
  return {
    success:       true,
    externalPostId: `ig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
}

// ─── ルーター ─────────────────────────────────────────────────────────────────

export async function postToSNS(
  platform: string,
  caption: string,
  hashtags: string | null
): Promise<PostResult> {
  switch (platform) {
    case "X":
      return postToX(caption, hashtags);

    case "INSTAGRAM":
      return postToInstagram(caption, hashtags);

    case "BOTH": {
      const xResult = await postToX(caption, hashtags);
      if (!xResult.success) return xResult;

      const igResult = await postToInstagram(caption, hashtags);
      if (!igResult.success) return igResult;

      return {
        success:       true,
        externalPostId: [xResult.externalPostId, igResult.externalPostId]
          .filter(Boolean)
          .join(","),
      };
    }

    default:
      return { success: false, error: `未対応プラットフォーム: ${platform}` };
  }
}
