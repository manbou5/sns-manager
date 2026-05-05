import type { Post, PublishResult } from "@/types";

// ─── X (Twitter) 投稿モジュール ───────────────────────────────────────────────
// MVP段階ではログ出力のみ。
// 実際のAPI連携は X_API_KEY 等の環境変数設定後に実装してください。
//
// 参考: https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets

export async function publishToX(post: Post): Promise<PublishResult> {
  if (!process.env.X_API_KEY) {
    console.log("[X Publisher] API Key未設定 - 実際の投稿はスキップします");
    console.log("[X Publisher] 投稿予定内容:", {
      caption: post.caption,
      hashtags: post.hashtags,
      mediaPath: post.mediaPath,
    });
    // MVP: シミュレーション成功として扱う
    return { success: true, platformPostId: `sim_x_${Date.now()}` };
  }

  // TODO: twitter-api-v2 ライブラリを使った実装
  // const client = new TwitterApi({ ... });
  // const tweet = await client.v2.tweet({ text: fullCaption, media: { media_ids: [...] } });
  // return { success: true, platformPostId: tweet.data.id };

  return { success: false, error: "X API未実装" };
}
