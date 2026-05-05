"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { PerformanceMetricWithQueue } from "@/types";

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000)  return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

function erColor(er: number): string {
  if (er >= 5)  return "text-green-700 font-semibold";
  if (er >= 2)  return "text-yellow-700 font-semibold";
  return "text-gray-600";
}

function SummaryCard({
  label, value, sub, accent = false,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`card ${accent ? "border-brand-200 bg-brand-50" : ""}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? "text-brand-700" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── ページ ───────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const [metrics,  setMetrics]  = useState<PerformanceMetricWithQueue[]>([]);
  const [loading,  setLoading]  = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/performance");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetrics(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[fetchMetrics]", e);
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const deleteMetric = async (id: string) => {
    if (!confirm("この実績データを削除しますか？")) return;
    await fetch(`/api/performance/${id}`, { method: "DELETE" });
    fetchMetrics();
  };

  // ── サマリー計算 ─────────────────────────────────────────────────────────────
  const n = metrics.length;
  const avgViews = n > 0 ? Math.round(metrics.reduce((s, m) => s + m.views, 0) / n) : 0;
  const avgLikes = n > 0 ? Math.round(metrics.reduce((s, m) => s + m.likes, 0) / n) : 0;
  const avgER    = n > 0
    ? Math.round((metrics.reduce((s, m) => s + m.engagementRate, 0) / n) * 100) / 100
    : 0;
  const bestByViews = n > 0
    ? metrics.reduce((best, m) => m.views > best.views ? m : best)
    : null;

  return (
    <div className="max-w-5xl space-y-8">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">実績管理</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            投稿済みコンテンツの SNS パフォーマンス記録
          </p>
        </div>
        <Link href="/queue?status=posted" className="btn-secondary text-sm">
          ← 投稿キュー
        </Link>
      </div>

      {/* ── サマリーカード ── */}
      {!loading && n > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="計測件数"     value={`${n} 件`} />
          <SummaryCard label="平均再生数"   value={fmt(avgViews)} accent />
          <SummaryCard label="平均いいね数" value={fmt(avgLikes)} />
          <SummaryCard
            label="平均ER%"
            value={`${avgER.toFixed(2)}%`}
            sub="(いいね+コメント+シェア+保存) / 再生数"
          />
        </div>
      )}

      {/* ── ベストパフォーマー ── */}
      {!loading && bestByViews && (
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-xs font-semibold text-amber-600 mb-1">🏆 再生数トップ</p>
          <p className="font-semibold text-gray-900">
            {bestByViews.postQueue.generatedContent.title ?? "タイトルなし"}
          </p>
          <p className="text-sm text-gray-600 mt-0.5">
            {fmt(bestByViews.views)} 再生 ／ いいね {fmt(bestByViews.likes)} ／
            ER {bestByViews.engagementRate.toFixed(2)}%
          </p>
        </div>
      )}

      {/* ── 実績一覧 ── */}
      {loading ? (
        <div className="card text-center text-gray-400 py-12">読み込み中...</div>
      ) : metrics.length === 0 ? (
        <div className="card text-center py-12 space-y-3">
          <p className="text-gray-400">実績データがまだありません</p>
          <p className="text-gray-400 text-sm">
            投稿キューの「実績入力」ボタンから登録できます
          </p>
          <Link href="/queue" className="btn-primary inline-block text-sm">
            投稿キューへ
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">コンテンツ</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">PF</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">再生数</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">いいね</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">コメント</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">シェア</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">保存</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">ER%</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">フォロワー±</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">計測日</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {metrics.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 max-w-[180px]">
                    <p className="font-medium text-gray-900 truncate text-xs">
                      {m.postQueue.generatedContent.title ?? (
                        <span className="text-gray-400 font-normal">タイトルなし</span>
                      )}
                    </p>
                    {m.postQueue.generatedContent.caption && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate">
                        {m.postQueue.generatedContent.caption}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {m.platform}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-700">
                    {fmt(m.views)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(m.likes)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(m.comments)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(m.shares)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(m.saves)}</td>
                  <td className={`px-4 py-3 text-right ${erColor(m.engagementRate)}`}>
                    {m.engagementRate.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-3 text-right ${
                    m.followersGained > 0
                      ? "text-green-700"
                      : m.followersGained < 0
                      ? "text-red-600"
                      : "text-gray-400"
                  }`}>
                    {m.followersGained > 0 ? `+${m.followersGained}` : m.followersGained}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {format(new Date(m.measuredAt), "M/d HH:mm")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/performance/${m.id}/edit`}
                        className="text-brand-600 hover:underline whitespace-nowrap text-xs"
                      >
                        編集
                      </Link>
                      <button
                        onClick={() => deleteMetric(m.id)}
                        className="text-red-500 hover:underline whitespace-nowrap text-xs"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
