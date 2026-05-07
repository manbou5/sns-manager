import { postTweet, getXPostingMode } from "@/lib/publisher/twitter";
import type { PostResult } from "./index";

export { getXPostingMode };

export async function postToX(caption: string, hashtags: string | null): Promise<PostResult> {
  const text = [caption, hashtags].filter(Boolean).join("\n");
  const result = await postTweet(text);
  return {
    success:       result.success,
    externalPostId: result.platformPostId,
    error:         result.error,
  };
}
