import type { Post, PublishResult } from "@/types";

// ─── Instagram 投稿モジュール ──────────────────────────────────────────────────
// MVP段階ではログ出力のみ。
// 実際のAPI連携は INSTAGRAM_ACCESS_TOKEN 等の環境変数設定後に実装してください。
//
// 参考: https://developers.facebook.com/docs/instagram-api/guides/content-publishing

export async function publishToInstagram(post: Post): Promise<PublishResult> {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) {
    console.log("[Instagram Publisher] Access Token未設定 - 実際の投稿はスキップします");
    console.log("[Instagram Publisher] 投稿予定内容:", {
      caption: post.caption,
      hashtags: post.hashtags,
      mediaPath: post.mediaPath,
    });
    return { success: true, platformPostId: `sim_ig_${Date.now()}` };
  }

  // TODO: Instagram Content Publishing APIを使った実装
  // 1. メディアコンテナ作成 (POST /{ig-user-id}/media)
  // 2. コンテナ公開 (POST /{ig-user-id}/media_publish)

  return { success: false, error: "Instagram API未実装" };
}
