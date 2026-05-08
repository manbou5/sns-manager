/**
 * Twitter API v2 からツイートデータ（テキスト＋画像＋メトリクス）を取得するモジュール。
 * サーバーサイド専用。
 *
 * 認証方法（優先順位順）:
 *   1. X_BEARER_TOKEN が設定されていれば Bearer Token (App-only / OAuth 2.0) を使用
 *      → 設定が最も簡単。Twitter Developer Portal の 'Bearer Token' をコピーするだけ。
 *   2. X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET が揃っていれば
 *      OAuth 1.0a User Context を使用
 */

import { createHmac, randomBytes } from "crypto";
import type { MediaType, TweetMetrics } from "@/types";

// ─── 型 ──────────────────────────────────────────────────────────────────────

export interface TweetImage {
  filename:       string;
  base64:         string;
  mimeType:       string;
  previewDataUrl: string;
}

export interface TweetData {
  tweetId:  string;
  postUrl:  string;
  caption:  string;
  metrics:  TweetMetrics;
  images:   TweetImage[];
}

export type { TweetMetrics };

// ─── OAuth 1.0a (GET + クエリパラメータ付き) ─────────────────────────────────

function enc(s: string): string {
  return encodeURIComponent(s);
}

/**
 * GET リクエスト用 OAuth 1.0a Authorization ヘッダーを生成する。
 * queryParams を署名ベース文字列に含める点が POST 版と異なる。
 */
function buildGetOAuthHeader(
  url: string,
  queryParams: Record<string, string>
): string {
  const consumerKey       = process.env.X_API_KEY!;
  const consumerSecret    = process.env.X_API_SECRET!;
  const accessToken       = process.env.X_ACCESS_TOKEN!;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET!;

  const nonce     = randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        timestamp,
    oauth_token:            accessToken,
    oauth_version:          "1.0",
  };

  const allParams = { ...queryParams, ...oauthParams };
  const paramStr  = Object.entries(allParams)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${enc(k)}=${enc(v)}`)
    .join("&");

  const baseStr    = ["GET", enc(url), enc(paramStr)].join("&");
  const signingKey = `${enc(consumerSecret)}&${enc(accessTokenSecret)}`;
  const signature  = createHmac("sha1", signingKey).update(baseStr).digest("base64");

  return (
    "OAuth " +
    Object.entries({ ...oauthParams, oauth_signature: signature })
      .map(([k, v]) => `${enc(k)}="${enc(v)}"`)
      .join(", ")
  );
}

// ─── 認証ヘッダー（Bearer Token 優先） ───────────────────────────────────────

const OAUTH1_VARS = [
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_TOKEN_SECRET",
] as const;

function buildAuthHeader(
  url: string,
  queryParams: Record<string, string>
): string {
  if (process.env.X_BEARER_TOKEN) {
    return `Bearer ${process.env.X_BEARER_TOKEN}`;
  }
  return buildGetOAuthHeader(url, queryParams);
}

function checkCredentials(): void {
  if (process.env.X_BEARER_TOKEN) return;

  const missing = OAUTH1_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `X API の認証情報が未設定です。\n` +
      `【方法 1（簡単）】X_BEARER_TOKEN を .env.local に追加\n` +
      `  → Twitter Developer Portal の 'Keys and Tokens' からコピー\n` +
      `【方法 2】OAuth 1.0a の環境変数を全て設定: ${missing.join(", ")}`
    );
  }
}

// ─── ツイート ID 抽出 ─────────────────────────────────────────────────────────

export function extractTweetId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/status\/(\d+)/);
  if (urlMatch) return urlMatch[1];
  if (/^\d+$/.test(trimmed)) return trimmed;
  return null;
}

// ─── メディアタイプ判定 ───────────────────────────────────────────────────────

function determineMediaType(
  mediaList: { media_key: string; type: string }[],
  mediaKeys: string[]
): MediaType {
  if (mediaKeys.length === 0) return "IMAGE";
  const types = mediaKeys.map(
    (key) => mediaList.find((m) => m.media_key === key)?.type ?? "photo"
  );
  const hasVideo = types.some((t) => t === "video" || t === "animated_gif");
  const hasPhoto = types.some((t) => t === "photo");
  if (hasPhoto && hasVideo) return "MIXED";
  if (hasVideo) return "VIDEO";
  return "IMAGE";
}

// ─── レート制限（サーバー側簡易スロットル） ──────────────────────────────────

let lastFetchTime = 0;
const MIN_INTERVAL_MS = 1000;

async function rateLimit(): Promise<void> {
  const now     = Date.now();
  const elapsed = now - lastFetchTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastFetchTime = Date.now();
}

// ─── 画像ダウンロード ─────────────────────────────────────────────────────────

async function downloadImageAsBase64(
  imageUrl: string,
  index: number
): Promise<TweetImage> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`画像取得エラー (HTTP ${res.status}): ${imageUrl}`);
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const mimeType    = contentType.split(";")[0].trim();
  const ext         = mimeType === "image/png"  ? "png"
                    : mimeType === "image/webp" ? "webp"
                    : mimeType === "image/gif"  ? "gif"
                    : "jpg";

  const buffer         = await res.arrayBuffer();
  const base64         = Buffer.from(buffer).toString("base64");
  const filename       = `tweet_image_${index + 1}.${ext}`;
  const previewDataUrl = `data:${mimeType};base64,${base64}`;

  return { filename, base64, mimeType, previewDataUrl };
}

// ─── メイン ──────────────────────────────────────────────────────────────────

const TWEETS_BASE = "https://api.twitter.com/2/tweets";

/**
 * X (Twitter) API v2 でツイートデータを取得する。
 * テキスト・添付画像・パブリックメトリクスを返す。
 */
export async function fetchTweetData(input: string): Promise<TweetData> {
  const tweetId = extractTweetId(input);
  if (!tweetId) {
    throw new Error("X の投稿 URL または数字の ID を入力してください");
  }

  checkCredentials();
  await rateLimit();

  const queryParams: Record<string, string> = {
    expansions:     "attachments.media_keys",
    "media.fields": "url,preview_image_url,type,width,height",
    "tweet.fields": "text,public_metrics",
  };

  const queryString = new URLSearchParams(queryParams).toString();
  const endpoint    = `${TWEETS_BASE}/${tweetId}`;
  const fullUrl     = `${endpoint}?${queryString}`;
  const authHeader  = buildAuthHeader(endpoint, queryParams);

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    throw new Error(`X API への接続に失敗しました: ${msg}`);
  }

  if (res.status === 401 || res.status === 403) {
    let rawBody = "";
    try { rawBody = await res.text(); } catch { /* ignore */ }
    console.error(`[tweetFetcher] ${res.status} response:`, rawBody);

    const authMethod = process.env.X_BEARER_TOKEN ? "Bearer Token" : "OAuth 1.0a";
    throw new Error(
      `X API 認証エラー (${res.status}) [${authMethod}]\n` +
      `詳細: ${rawBody || "レスポンスなし"}\n\n` +
      `確認: /api/debug/x-auth-check で診断できます`
    );
  }
  if (res.status === 404) {
    throw new Error(
      "ツイートが見つかりません。URL・ID が正しいか、ツイートが削除されていないか確認してください。"
    );
  }
  if (res.status === 429) {
    throw new Error(
      "X API レート制限に達しました。しばらく待ってから再試行してください。"
    );
  }
  if (!res.ok) {
    let rawBody = "";
    try { rawBody = await res.text(); } catch { /* ignore */ }
    console.error(`[tweetFetcher] ${res.status} response:`, rawBody);
    throw new Error(`X API エラー (${res.status}): ${rawBody || "不明なエラー"}`);
  }

  type PublicMetrics = {
    retweet_count:     number;
    reply_count:       number;
    like_count:        number;
    quote_count:       number;
    impression_count?: number;
  };
  type MediaObject = {
    media_key: string; type: string;
    url?: string; preview_image_url?: string;
  };
  type ApiResponse = {
    data?: {
      id:           string;
      text:         string;
      attachments?: { media_keys?: string[] };
      public_metrics?: PublicMetrics;
    };
    includes?: { media?: MediaObject[] };
    errors?:   { detail?: string }[];
  };

  const body = await res.json() as ApiResponse;

  if (!body.data) {
    const errDetail = body.errors?.[0]?.detail ?? "不明なエラー";
    throw new Error(`ツイートデータの取得に失敗しました: ${errDetail}`);
  }

  const caption    = body.data.text ?? "";
  const mediaList  = body.includes?.media ?? [];
  const mediaKeys  = body.data.attachments?.media_keys ?? [];
  const pm         = body.data.public_metrics;

  const metrics: TweetMetrics = {
    likes:     pm?.like_count        ?? null,
    comments:  pm?.reply_count       ?? null,
    shares:    pm?.retweet_count     ?? null,
    views:     pm?.impression_count  ?? null,
    mediaType: determineMediaType(mediaList, mediaKeys),
  };

  const imageUrls: string[] = mediaKeys
    .map((key) => {
      const m = mediaList.find((x) => x.media_key === key);
      if (!m) return null;
      return m.type === "photo"
        ? (m.url ?? null)
        : (m.preview_image_url ?? null);
    })
    .filter((u): u is string => u !== null);

  if (imageUrls.length === 0) {
    throw new Error(
      "このツイートには画像が含まれていません。画像付きのツイート URL を入力してください。"
    );
  }

  const images = await Promise.all(
    imageUrls.map((url, i) => downloadImageAsBase64(url, i))
  );

  // postUrl: 入力が URL ならそのまま。ID のみなら構築する
  const postUrl = input.trim().includes("/status/")
    ? input.trim()
    : `https://x.com/i/web/status/${tweetId}`;

  return { tweetId, postUrl, caption, metrics, images };
}
