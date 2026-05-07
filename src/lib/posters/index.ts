import { postToX } from "./xPoster";
import { postToInstagram } from "./instagramPoster";

export type PostResult = {
  success:        boolean;
  externalPostId?: string;
  error?:         string;
};

export async function postToSNS(
  platform: string,
  caption:  string,
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
