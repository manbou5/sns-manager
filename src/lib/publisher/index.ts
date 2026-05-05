import type { Post, PublishResult } from "@/types";
import { publishToX } from "./twitter";
import { publishToInstagram } from "./instagram";

// プラットフォーム別に投稿を振り分けるファサード
export async function publishPost(post: Post): Promise<PublishResult[]> {
  const results: PublishResult[] = [];

  if (post.platform === "X" || post.platform === "BOTH") {
    results.push(await publishToX(post));
  }

  if (post.platform === "INSTAGRAM" || post.platform === "BOTH") {
    results.push(await publishToInstagram(post));
  }

  return results;
}
