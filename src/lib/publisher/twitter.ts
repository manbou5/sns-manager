/**
 * X (Twitter) 投稿モジュール
 *
 * ENABLE_REAL_X_POSTING=true の場合のみ X API v2 で実投稿を行います。
 * それ以外はダミー投稿（ログ出力のみ）として扱います。
 *
 * 必要な環境変数:
 *   X_API_KEY               — API Key (Consumer Key)
 *   X_API_SECRET            — API Secret (Consumer Secret)
 *   X_ACCESS_TOKEN          — Access Token (ユーザー認可済み)
 *   X_ACCESS_TOKEN_SECRET   — Access Token Secret
 *   ENABLE_REAL_X_POSTING   — "true" にすると実投稿モードになる
 */

import { createHmac, randomBytes } from "crypto";
import type { Post, PublishResult } from "@/types";

// ─── 型 ─────────────────────────────────────────────────────────────────────

/** postTweet の戻り値 (PublishResult と同一) */
export type TweetResult = PublishResult;

/** getXPostingMode の戻り値 */
export interface XPostingMode {
  /** ENABLE_REAL_X_POSTING=true かどうか */
  enabled: boolean;
  /** 全 4 つの環境変数が揃っているか */
  configured: boolean;
  /** 実際に使われるモード */
  mode: "real" | "dummy";
  /** 未設定の環境変数名リスト */
  missingVars: string[];
}

// ─── OAuth 1.0a ──────────────────────────────────────────────────────────────

const REQUIRED_VARS = [
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_TOKEN_SECRET",
] as const;

function enc(s: string): string {
  return encodeURIComponent(s);
}

/**
 * X API v2 向け OAuth 1.0a Authorization ヘッダーを生成する。
 * JSON ボディの POST リクエスト用（ボディパラメータは署名に含めない）。
 */
function buildOAuthHeader(method: string, url: string): string {
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

  // シグネチャーベース文字列を構築
  const paramStr = Object.keys(oauthParams)
    .sort()
    .map((k) => `${enc(k)}=${enc(oauthParams[k])}`)
    .join("&");

  const baseStr    = [method.toUpperCase(), enc(url), enc(paramStr)].join("&");
  const signingKey = `${enc(consumerSecret)}&${enc(accessTokenSecret)}`;
  const signature  = createHmac("sha1", signingKey).update(baseStr).digest("base64");

  return (
    "OAuth " +
    Object.entries({ ...oauthParams, oauth_signature: signature })
      .map(([k, v]) => `${enc(k)}="${enc(v)}"`)
      .join(", ")
  );
}

// ─── 実投稿 ─────────────────────────────────────────────────────────────────

const TWEETS_ENDPOINT = "https://api.twitter.com/2/tweets";

async function postRealTweet(text: string): Promise<TweetResult> {
  const authHeader = buildOAuthHeader("POST", TWEETS_ENDPOINT);

  let res: Response;
  try {
    res = await fetch(TWEETS_ENDPOINT, {
      method:  "POST",
      headers: {
        Authorization:  authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ネットワークエラー";
    console.error(`[twitter:real] 接続エラー: ${msg}`);
    return { success: false, error: `X API 接続エラー: ${msg}` };
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json() as { detail?: string; title?: string };
      detail = errBody.detail ?? errBody.title ?? detail;
    } catch { /* ignore */ }
    console.error(`[twitter:real] API エラー ${res.status}: ${detail}`);
    return { success: false, error: `X API エラー (${res.status}): ${detail}` };
  }

  const body = await res.json() as { data?: { id?: string } };
  const tweetId = body.data?.id;
  console.log(`[twitter:real] ✓ 投稿成功 tweetId=${tweetId}`);
  return { success: true, platformPostId: tweetId };
}

// ─── ダミー投稿 ──────────────────────────────────────────────────────────────

async function postDummyTweet(text: string): Promise<TweetResult> {
  const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text;
  console.log(`[twitter:dummy] 投稿内容: ${preview}`);
  await new Promise((r) => setTimeout(r, 200));
  return {
    success: true,
    platformPostId: `x_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
}

// ─── 公開 API ────────────────────────────────────────────────────────────────

/**
 * X にテキストを投稿する。
 * - ENABLE_REAL_X_POSTING=true かつ全環境変数が揃っている場合のみ実投稿。
 * - それ以外はダミー投稿（ログ出力のみ、SNS には送信しない）。
 */
export async function postTweet(text: string): Promise<TweetResult> {
  const realMode = process.env.ENABLE_REAL_X_POSTING === "true";

  if (!realMode) {
    return postDummyTweet(text);
  }

  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    const msg = `X API 環境変数が未設定です: ${missing.join(", ")}`;
    console.error(`[twitter] ${msg}`);
    return { success: false, error: msg };
  }

  return postRealTweet(text);
}

/**
 * 現在の X 投稿モードと設定状態を返す（UI 表示・API レスポンス用）。
 * サーバーサイドのみで呼び出すこと（環境変数へのアクセスが必要なため）。
 */
export function getXPostingMode(): XPostingMode {
  const enabled     = process.env.ENABLE_REAL_X_POSTING === "true";
  const missingVars = REQUIRED_VARS.filter((k) => !process.env[k]);
  const configured  = missingVars.length === 0;
  const mode: "real" | "dummy" = enabled && configured ? "real" : "dummy";
  return { enabled, configured, mode, missingVars };
}

// ── 後方互換: publisher/index.ts から呼ばれる publishToX ──────────────────────

export async function publishToX(post: Post): Promise<PublishResult> {
  const text = [post.caption, post.hashtags].filter(Boolean).join("\n");
  return postTweet(text);
}
