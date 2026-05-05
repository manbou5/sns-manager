"use client";

import { useEffect, useState, useCallback } from "react";

type Counts = {
  benchmarkPost: number;
  generatedContent: number;
  postQueue: number;
  performanceMetric: number;
  post: number;
};

const TABLE_LABELS: { key: keyof Counts; label: string; href: string }[] = [
  { key: "benchmarkPost",    label: "BenchmarkPost",    href: "/benchmark" },
  { key: "generatedContent", label: "GeneratedContent", href: "/content" },
  { key: "postQueue",        label: "PostQueue",        href: "/queue" },
  { key: "performanceMetric",label: "PerformanceMetric",href: "/performance" },
  { key: "post",             label: "Post (旧)",        href: "/posts" },
];

const ER_PREVIEW = [
  { title: "自然光ポートレート 夏", er: "9.0%",  platform: "X",         color: "text-green-700" },
  { title: "秋コーデ全身ショット",  er: "8.5%",  platform: "INSTAGRAM", color: "text-green-700" },
  { title: "カフェライフスタイル",  er: "5.2%",  platform: "X",         color: "text-yellow-700" },
  { title: "背景グリーンコーデ",    er: "3.0%",  platform: "INSTAGRAM", color: "text-orange-600" },
  { title: "試験的ミックス投稿",    er: "1.6%",  platform: "X",         color: "text-red-600" },
];

export default function DevToolsPage() {
  const [counts,   setCounts]   = useState<Counts | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [seeding,  setSeeding]  = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message,  setMessage]  = useState<{ text: string; ok: boolean } | null>(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/seed");
      if (res.status === 403) {
        setMessage({ text: "本番環境では使用できません", ok: false });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCounts(data.counts ?? null);
    } catch (e) {
      console.error("[fetchCounts]", e);
      setMessage({ text: "開発ツール情報の取得に失敗しました", ok: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const totalRows = counts
    ? Object.values(counts).reduce((s, n) => s + n, 0)
    : 0;

  const handleSeed = async () => {
    if (!confirm("サンプルデータを投入しますか？\n・BenchmarkPost 20件\n・GeneratedContent 5件\n・PostQueue 5件\n・PerformanceMetric 5件")) return;
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/seed", { method: "POST" });
      if (!res.ok && res.status !== 400) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessage({ text: data.message ?? "エラーが発生しました", ok: data.ok ?? false });
      if (data.ok) await fetchCounts();
    } catch (e) {
      console.error("[handleSeed]", e);
      setMessage({ text: "サンプルデータの投入に失敗しました", ok: false });
    } finally {
      setSeeding(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("⚠️ 全テーブルのデータを削除します。\nこの操作は元に戻せません。本当に実行しますか？")) return;
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/seed", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessage({ text: data.message ?? "削除しました", ok: data.ok ?? true });
      await fetchCounts();
    } catch (e) {
      console.error("[handleClear]", e);
      setMessage({ text: "データの削除に失敗しました", ok: false });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">🛠 開発ツール</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            開発環境専用 — 本番環境では全操作が無効になります
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 font-medium">
          DEV ONLY
        </span>
      </div>

      {/* ── メッセージ ── */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium border ${
            message.ok
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.ok ? "✅ " : "⚠️ "}{message.text}
        </div>
      )}

      {/* ── 現在のデータ件数 ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">現在のデータ件数</h3>
          <button
            onClick={fetchCounts}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ↻ 更新
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : counts ? (
          <div className="divide-y divide-gray-50">
            {TABLE_LABELS.map(({ key, label, href }) => (
              <div key={key} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-600">{label}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      counts[key] > 0 ? "text-gray-900" : "text-gray-300"
                    }`}
                  >
                    {counts[key].toLocaleString()} 件
                  </span>
                  <a
                    href={href}
                    className="text-xs text-brand-500 hover:underline"
                  >
                    確認 →
                  </a>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5 font-semibold">
              <span className="text-sm text-gray-800">合計</span>
              <span className={`text-sm tabular-nums ${totalRows > 0 ? "text-gray-900" : "text-gray-300"}`}>
                {totalRows.toLocaleString()} 件
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── 操作ボタン ── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">データ操作</h3>

        {/* サンプル投入 */}
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800">サンプルデータ投入</p>
            <p className="text-xs text-gray-500 mt-0.5">
              分析・検証用のサンプルデータを一括投入します。既存データがある場合はスキップされます。
            </p>
          </div>
          <div className="text-xs text-gray-600 space-y-0.5">
            <p>• BenchmarkPost 20件（@ai_fashion_pro / @digital_muse / @casual_snap）</p>
            <p>• GeneratedContent 5件 + PostQueue 5件 + PerformanceMetric 5件</p>
          </div>
          <button
            onClick={handleSeed}
            disabled={seeding || (counts !== null && totalRows > 0)}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {seeding ? "投入中..." : "✨ サンプルデータを投入する"}
          </button>
          {counts !== null && totalRows > 0 && (
            <p className="text-xs text-yellow-700">
              ⚠ 既存データがあります。先に全削除してから投入してください。
            </p>
          )}
        </div>

        {/* 全削除 */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-red-800">全データ削除（開発用）</p>
            <p className="text-xs text-red-600 mt-0.5">
              全テーブルのデータを削除します。元に戻せません。
            </p>
          </div>
          <button
            onClick={handleClear}
            disabled={clearing || totalRows === 0}
            className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {clearing ? "削除中..." : "🗑 全データを削除する"}
          </button>
        </div>
      </div>

      {/* ── サンプルデータ内容プレビュー ── */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-gray-900">PerformanceMetric サンプル内容</h3>
        <p className="text-xs text-gray-500">投入されるデータのER差（分析ダッシュボードで確認できます）</p>
        <div className="divide-y divide-gray-50">
          {ER_PREVIEW.map((row, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 tabular-nums w-4">#{i + 1}</span>
                <span className="text-sm text-gray-700">{row.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{row.platform}</span>
                <span className={`text-sm font-bold tabular-nums ${row.color}`}>{row.er}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          上位20%（1件）= ER 9.0%　上位30%（2件）= ER 8.5%以上
        </p>
      </div>

      {/* ── 確認フロー ── */}
      <div className="card space-y-2">
        <h3 className="font-semibold text-gray-900">投入後の確認フロー</h3>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li><a href="/benchmark" className="text-brand-600 hover:underline">ベンチマーク一覧</a> — 20件表示を確認</li>
          <li><a href="/benchmark/analytics" className="text-brand-600 hover:underline">ベンチマーク集計</a> — タグ・アカウント別集計を確認</li>
          <li><a href="/benchmark/recommendations" className="text-brand-600 hover:underline">投稿案推薦</a> — 高パフォーマンス投稿からの推薦を確認</li>
          <li><a href="/content" className="text-brand-600 hover:underline">生成コンテンツ</a> — 5件表示を確認</li>
          <li><a href="/queue" className="text-brand-600 hover:underline">投稿キュー</a> — posted 5件を確認</li>
          <li><a href="/performance" className="text-brand-600 hover:underline">実績管理</a> — ER差のある5件を確認</li>
          <li><a href="/performance/learning" className="text-brand-600 hover:underline">再学習ダッシュボード</a> — ER集計・上位投稿・プロンプト抽出を確認</li>
        </ol>
      </div>
    </div>
  );
}
