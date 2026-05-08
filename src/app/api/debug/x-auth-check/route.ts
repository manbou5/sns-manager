/**
 * X API 認証デバッグエンドポイント（開発環境専用）
 * GET /api/debug/x-auth-check
 *
 * 確認内容:
 *   1. 環境変数の存在と先頭/末尾プレビュー
 *   2. OAuth 1.0a で GET /2/users/me を呼び出して認証確認
 *   3. Bearer Token が設定されていれば GET /2/tweets/20 を呼び出して確認
 *   4. サーバー時刻（OAuth timestamp のズレ確認用）
 *
 * 秘密鍵の全文はログ・レスポンスに含まれません。
 */

import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

// ─── 内部ユーティリティ ────────────────────────────────────────────────────────

function enc(s: string): string {
  return encodeURIComponent(s);
}

function buildOAuth1Header(
  method: string,
  url: string,
  queryParams: Record<string, string> = {}
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

function tryJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

function maskSecret(value: string | undefined) {
  if (!value) return { present: false, preview: null, length: 0 };
  const preview = value.length > 9
    ? `${value.slice(0, 5)}...${value.slice(-4)}`
    : "****";
  return { present: true, preview, length: value.length };
}

// ─── ルートハンドラー ─────────────────────────────────────────────────────────

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "このエンドポイントは開発環境専用です" },
      { status: 403 }
    );
  }

  // ── 1. 環境変数チェック
  const ENV_NAMES = [
    "X_API_KEY",
    "X_API_SECRET",
    "X_ACCESS_TOKEN",
    "X_ACCESS_TOKEN_SECRET",
    "X_BEARER_TOKEN",
  ] as const;

  const env = Object.fromEntries(
    ENV_NAMES.map((name) => [name, maskSecret(process.env[name])])
  );

  // ── 2. サーバー時刻（OAuth timestamp 検証用）
  const serverTime = {
    unixTimestamp: Math.floor(Date.now() / 1000),
    iso:           new Date().toISOString(),
    note:          "OAuth timestamp はサーバー時刻の ±5 分以内である必要があります",
  };

  // ── 3. OAuth 1.0a テスト: GET /2/users/me（クエリパラメータなし・シンプル）
  const OAUTH1_VARS = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"] as const;
  const hasOAuth1   = OAUTH1_VARS.every((k) => !!process.env[k]);

  let oauth1Test: Record<string, unknown>;
  if (!hasOAuth1) {
    const missing = OAUTH1_VARS.filter((k) => !process.env[k]);
    oauth1Test = {
      skipped: true,
      reason:  `環境変数が未設定: ${missing.join(", ")}`,
    };
  } else {
    const endpoint = "https://api.twitter.com/2/users/me";
    try {
      const authHeader = buildOAuth1Header("GET", endpoint);
      const res        = await fetch(endpoint, {
        headers: { Authorization: authHeader },
        cache: "no-store",
      });
      const rawBody = await res.text();

      oauth1Test = {
        endpoint,
        status:           res.status,
        ok:               res.ok,
        body:             tryJson(rawBody),
        // シグネチャ値のみマスク（ヘッダー形式確認用）
        authHeaderPreview: authHeader
          .replace(/oauth_signature="[^"]*"/, 'oauth_signature="***MASKED***"')
          .slice(0, 250),
      };
    } catch (e) {
      oauth1Test = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── 4. Bearer Token テスト: GET /2/tweets/20（ID=20 は @jack の最初のツイート）
  const bearerToken = process.env.X_BEARER_TOKEN;

  let bearerTest: Record<string, unknown>;
  if (!bearerToken) {
    bearerTest = {
      skipped: true,
      reason:  "X_BEARER_TOKEN が未設定",
      hint: [
        "Bearer Token は OAuth 1.0a 不要でツイートを読み込める簡単な方法です。",
        "Twitter Developer Portal の 'Keys and Tokens' > 'Bearer Token' からコピーして",
        ".env.local に X_BEARER_TOKEN=\"...\" を追加してください。",
      ].join(" "),
    };
  } else {
    const endpoint = "https://api.twitter.com/2/tweets/20";
    try {
      const res     = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        cache: "no-store",
      });
      const rawBody = await res.text();

      bearerTest = {
        endpoint,
        status: res.status,
        ok:     res.ok,
        body:   tryJson(rawBody),
      };
    } catch (e) {
      bearerTest = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json(
    { env, serverTime, oauth1Test, bearerTest },
    { status: 200 }
  );
}
