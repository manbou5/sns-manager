import type { PostResult } from "./index";

const INSTAGRAM_ENABLED = !!process.env.INSTAGRAM_ACCESS_TOKEN;

export async function postToInstagram(caption: string, hashtags: string | null): Promise<PostResult> {
  const text = [caption, hashtags].filter(Boolean).join("\n");

  if (!INSTAGRAM_ENABLED) {
    console.log(`[instagramPoster] dummy: ${text.slice(0, 60)}${text.length > 60 ? "..." : ""}`);
    await new Promise((r) => setTimeout(r, 300));
    return {
      success:       true,
      externalPostId: `ig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
  }

  // TODO: Instagram Content Publishing API 本番実装
  // 1. メディアコンテナ作成 (POST /{ig-user-id}/media)
  // 2. コンテナ公開 (POST /{ig-user-id}/media_publish)
  return { success: false, error: "Instagram API 未実装" };
}
