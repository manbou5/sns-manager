"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useToast } from "@/components/Toast";
import type { PerformanceMetricWithQueue } from "@/types";

// ─── 型 ─────────────────────────────────────────────────────────────────────

type SortField = "engagementRate" | "views" | "likes" | "measuredAt";
type SortDir   = "asc" | "desc";

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

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card space-y-2">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-8 w-14 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="card p-0 overflow-hidden animate-pulse">
      <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex gap-4">
        {[140, 40, 60, 60, 60, 60, 60, 60, 80, 70].map((w, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: w }} />
        ))}
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-gray-50">
          <div className="flex-1 space-y-1.5">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
          {[40, 50, 50, 50, 50, 50, 60, 60].map((w, j) => (
            <div key={j} className="h-4 bg-gray-100 rounded" style={{ width: w }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Sort header ─────────────────────────────────────────────────────────────

function SortTh({
  label, field, sortField, sortDir, onSort, className,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = field === sortField;
  return (
    <th className={className ?? "text-right px-4 py-3 text-gray-500 font-medium"}>
      <button onClick={() => onSort(field)} className="th-sort group justify-end w-full">
        {label}
        <span className={`text-xs ${active ? "text-brand-500" : "text-gray-300 group-hover:text-gray-400"}`}>
          {active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
        </span>
      </button>
    </th>
  );
}

// ─── SummaryCard ─────────────────────────────────────────────────────────────

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<PerformanceMetricWithQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("measuredAt");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      toast("実績データの取得に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const onSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;
      switch (sortField) {
        case "engagementRate": va = a.engagementRate; vb = b.engagementRate; break;
        case "views":          va = a.views;           vb = b.views;           break;
        case "likes":          va = a.likes;           vb = b.likes;           break;
        case "measuredAt":     va = a.measuredAt;      vb = b.measuredAt;      break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [metrics, sortField, sortDir]);

  const deleteMetric = async (id: string) => {
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/performance/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast("実績データを削除しました", "success");
      fetchMetrics();
    } catch {
      toast("削除に失敗しました", "error");
    }
  };

  // ── サマリー計算 ──────────────────────────────────────────────────────────
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
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">実績管理</h2>
          <p className="text-sm text-gray-500 mt-0.5">投稿済みコンテンツの SNS パフォーマンス記録</p>
        </div>
        <Link href="/queue?status=posted" className="btn-secondary text-sm">
          ← 投稿キュー
        </Link>
      </div>

      {/* サマリーカード */}
      {loading ? (
        <SummaryCardsSkeleton />
      ) : n > 0 ? (
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
      ) : null}

      {/* ベストパフォーマー */}
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

      {/* 実績一覧 */}
      {loading ? (
        <TableSkeleton />
      ) : metrics.length === 0 ? (
        <div className="card text-center py-14">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-600 font-medium">実績データがまだありません</p>
          <p className="text-gray-400 text-sm mt-1">
            投稿キューの「実績入力」ボタンから登録できます
          </p>
          <Link href="/queue" className="btn-primary inline-block mt-5 text-sm">
            投稿キューへ
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium">コンテンツ</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">PF</th>
                  <SortTh label="再生数" field="views"          sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <SortTh label="いいね" field="likes"          sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <th className="text-right px-4 py-3 text-gray-500 font-medium whitespace-nowrap">コメント</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">シェア</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">保存</th>
                  <SortTh label="ER%"    field="engagementRate" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <th className="text-right px-4 py-3 text-gray-500 font-medium whitespace-nowrap">フォロワー±</th>
                  <SortTh label="計測日" field="measuredAt" sortField={sortField} sortDir={sortDir} onSort={onSort} className="text-left px-4 py-3 text-gray-500 font-medium" />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedMetrics.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
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
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{m.platform}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-700">{fmt(m.views)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(m.likes)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(m.comments)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(m.shares)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmt(m.saves)}</td>
                    <td className={`px-4 py-3 text-right ${erColor(m.engagementRate)}`}>
                      {m.engagementRate.toFixed(2)}%
                    </td>
                    <td className={`px-4 py-3 text-right ${
                      m.followersGained > 0 ? "text-green-700"
                        : m.followersGained < 0 ? "text-red-600"
                        : "text-gray-400"
                    }`}>
                      {m.followersGained > 0 ? `+${m.followersGained}` : m.followersGained}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {format(new Date(m.measuredAt), "M/d HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end items-center">
                        <Link
                          href={`/performance/${m.id}/edit`}
                          className="text-brand-600 hover:underline whitespace-nowrap text-xs"
                        >
                          編集
                        </Link>
                        {confirmDeleteId === m.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => deleteMetric(m.id)}
                              className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                            >
                              確認
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(m.id)}
                            className="text-red-400 hover:text-red-600 whitespace-nowrap text-xs transition-colors"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {metrics.length} 件
          </div>
        </div>
      )}
    </div>
  );
}
