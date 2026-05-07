#!/usr/bin/env node
/**
 * SNS Manager — 自動投稿ランナー (ローカル開発用)
 *
 * 使い方:
 *   node scripts/auto-poster.mjs
 *
 * 前提: npm run dev (Next.js) が別ターミナルで起動済みであること。
 * 本番では vercel.json の cron 設定が同等の処理を行います。
 *
 * 環境変数:
 *   BASE_URL      接続先 (デフォルト: http://localhost:3000)
 *   INTERVAL_SEC  実行間隔[秒] (デフォルト: 60)
 */

const BASE_URL     = process.env.BASE_URL     ?? "http://localhost:3000";
const INTERVAL_SEC = Number(process.env.INTERVAL_SEC ?? "60");
const INTERVAL_MS  = INTERVAL_SEC * 1000;

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function ts() {
  return new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

// ─── 自動投稿実行 ──────────────────────────────────────────────────────────────

async function runAutoPost() {
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/queue/auto-post`, { method: "POST" });
  } catch (err) {
    console.error(`[${ts()}] 接続エラー: ${err.message}`);
    console.error("  → npm run dev が起動しているか確認してください");
    return;
  }

  if (!res.ok) {
    console.error(`[${ts()}] HTTP ${res.status} — 自動投稿 API エラー`);
    return;
  }

  const data = await res.json();

  if (!data.ok) {
    console.error(`[${ts()}] API エラー: ${data.message}`);
    return;
  }

  if (data.processed === 0) {
    console.log(`[${ts()}] ─ 処理対象なし`);
    return;
  }

  console.log(
    `[${ts()}] ✓ 処理: ${data.processed}件  成功: ${data.succeeded}  失敗: ${data.failed}`
  );
  for (const item of data.items ?? []) {
    const icon = item.status === "posted" ? "  ✓" : "  ✗";
    const title = item.title ?? "(タイトルなし)";
    console.log(`${icon} [${item.platform}] ${title}`);
    if (item.externalPostId) console.log(`      externalPostId: ${item.externalPostId}`);
    if (item.error)          console.log(`      エラー: ${item.error}`);
  }
}

// ─── ステータス取得（起動時表示）──────────────────────────────────────────────

async function printStatus() {
  try {
    const res = await fetch(`${BASE_URL}/api/queue/auto-post`);
    if (!res.ok) return;
    const data = await res.json();
    console.log(
      `待機中: ${data.due ?? 0}件 (期限超過) / ${data.upcoming ?? 0}件 (予約済み)`
    );
    if (data.nextScheduledAt) {
      const d = new Date(data.nextScheduledAt);
      console.log(`次回予定: ${d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);
    }
  } catch {
    // 起動直後の接続エラーは無視
  }
}

// ─── エントリポイント ──────────────────────────────────────────────────────────

console.log("=".repeat(50));
console.log("SNS Manager — 自動投稿ランナー");
console.log(`接続先 : ${BASE_URL}`);
console.log(`実行間隔: ${INTERVAL_SEC}秒`);
console.log("停止   : Ctrl+C");
console.log("=".repeat(50));

await printStatus();

// 起動直後に即実行
await runAutoPost();

// 定期実行
setInterval(runAutoPost, INTERVAL_MS);
