"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type {
  BenchmarkAnalyticsData,
  BenchmarkTagStat,
  BenchmarkAccountStat,
  BenchmarkMediaTypeStat,
  BenchmarkDurationStat,
} from "@/types";

// ─── 定数 ──────────────────────────────────────────────────────────────────────

const MEDIA_ICONS: Record<string, string> = {
  IMAGE: "🖼️",
  VIDEO: "🎬",
  MIXED: "🔀",
};

const TAG_CHART_COLORS = [
  "#ec4899", "#8b5cf6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#3b82f6", "#84cc16",
  "#f97316", "#6b7280",
];

// ─── 小コンポーネント ──────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
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

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {count !== undefined && (
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {count}件
        </span>
      )}
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000)  return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

function EmptySection({ message }: { message: string }) {
  return (
    <p className="text-sm text-gray-400 text-center py-6">{message}</p>
  );
}

// ─── メインページ ──────────────────────────────────────────────────────────────

export default function BenchmarkAnalyticsPage() {
  const [data,    setData]    = useState<BenchmarkAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/benchmark/analytics")
      .then((r) => {
        if (!r.ok) throw new Error("APIエラー");
        return r.json();
      })
      .then((d: BenchmarkAnalyticsData) => { setData(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400 text-center py-20">集計中...</div>;
  }
  if (error) {
    return (
      <div className="text-red-500 text-center py-20">
        {error}
      </div>
    );
  }
  if (!data) return null;

  if (data.totalPosts === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <p className="text-gray-500 text-lg">ベンチマークデータがまだありません</p>
        <p className="text-gray-400 text-sm">
          投稿を登録すると、ここに集計結果が表示されます
        </p>
        <Link href="/benchmark/new" className="btn-primary inline-block">
          最初のデータを登録する
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">ベンチマーク集計</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            登録済みの参考アカウント投稿データの傾向分析
          </p>
        </div>
        <Link href="/benchmark" className="btn-secondary text-sm">
          ← 一覧に戻る
        </Link>
      </div>

      {/* ── サマリーカード ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="総登録数"
          value={`${data.totalPosts} 件`}
          sub={`うち再生数あり ${data.postsWithViews} 件`}
        />
        <SummaryCard
          label="平均再生数"
          value={fmt(data.overallAvgViews)}
          accent
        />
        <SummaryCard
          label="平均いいね数"
          value={fmt(data.overallAvgLikes)}
        />
        <SummaryCard
          label="平均ER%"
          value={`${data.overallAvgEngagementRate.toFixed(1)} %`}
          sub="(いいね+RT+返信) / 再生数"
        />
      </div>

      {/* ── タグ別集計 ── */}
      <div className="card space-y-4">
        <SectionHeader title="タグ別集計" count={data.tagStats.length} />

        {data.tagStats.length === 0 ? (
          <EmptySection message="タグが付いた投稿がありません" />
        ) : (
          <div className="space-y-6">
            {/* 横棒グラフ：平均再生数 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">タグ別 平均再生数</p>
              <ResponsiveContainer width="100%" height={Math.max(180, data.tagStats.length * 36)}>
                <BarChart
                  data={data.tagStats}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => fmt(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="tag"
                    tick={{ fontSize: 12 }}
                    width={72}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), "平均再生数"]}
                  />
                  <Bar dataKey="avgViews" radius={[0, 4, 4, 0]}>
                    {data.tagStats.map((_, i) => (
                      <Cell
                        key={i}
                        fill={TAG_CHART_COLORS[i % TAG_CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 詳細テーブル */}
            <TagStatsTable stats={data.tagStats} />
          </div>
        )}
      </div>

      {/* ── アカウント別集計 ── */}
      <div className="card">
        <SectionHeader title="アカウント別集計" count={data.accountStats.length} />
        {data.accountStats.length === 0 ? (
          <EmptySection message="データがありません" />
        ) : (
          <AccountStatsTable stats={data.accountStats} />
        )}
      </div>

      {/* ── メディア種別別集計 ── */}
      <div className="card space-y-4">
        <SectionHeader title="メディア種別別集計" />
        {data.mediaTypeStats.length === 0 ? (
          <EmptySection message="データがありません" />
        ) : (
          <div className="space-y-4">
            {/* カード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.mediaTypeStats.map((s) => (
                <div
                  key={s.mediaType}
                  className="border border-gray-100 rounded-lg p-4 text-sm"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">
                      {MEDIA_ICONS[s.mediaType] ?? "📁"}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">{s.label}</p>
                      <p className="text-xs text-gray-400">{s.count} 件</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <StatRow label="平均再生数" value={fmt(s.avgViews)} highlight />
                    <StatRow label="平均いいね" value={fmt(s.avgLikes)} />
                    <StatRow label="平均ER%"    value={`${s.avgEngagementRate.toFixed(1)}%`} />
                  </div>
                </div>
              ))}
            </div>

            {/* 比較テーブル */}
            <MediaTypeTable stats={data.mediaTypeStats} />
          </div>
        )}
      </div>

      {/* ── 動画尺別集計 ── */}
      {data.durationStats.length > 0 && (
        <div className="card">
          <SectionHeader
            title="動画尺別集計"
            count={data.durationStats.length}
          />
          <p className="text-xs text-gray-400 mb-3">
            ※ videoDuration が入力されている投稿のみ対象
          </p>
          <DurationStatsTable stats={data.durationStats} />
        </div>
      )}
    </div>
  );
}

// ─── テーブルサブコンポーネント ────────────────────────────────────────────────

const TH = "text-left px-3 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap";
const TD = "px-3 py-2.5 text-sm";
const TR = "border-b border-gray-50 hover:bg-gray-50";

function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={highlight ? "font-semibold text-brand-700" : "text-gray-700"}>
        {value}
      </span>
    </div>
  );
}

function TagStatsTable({ stats }: { stats: BenchmarkTagStat[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className={TH}>タグ</th>
            <th className={`${TH} text-right`}>件数</th>
            <th className={`${TH} text-right`}>平均再生数</th>
            <th className={`${TH} text-right`}>平均いいね</th>
            <th className={`${TH} text-right`}>平均RT</th>
            <th className={`${TH} text-right`}>平均ER%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.tag} className={TR}>
              <td className={TD}>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        TAG_CHART_COLORS[i % TAG_CHART_COLORS.length],
                    }}
                  />
                  <span className="font-medium text-gray-800">{s.tag}</span>
                </div>
              </td>
              <td className={`${TD} text-right text-gray-600`}>{s.count}</td>
              <td className={`${TD} text-right font-semibold text-brand-700`}>
                {fmt(s.avgViews)}
              </td>
              <td className={`${TD} text-right text-gray-700`}>
                {fmt(s.avgLikes)}
              </td>
              <td className={`${TD} text-right text-gray-600`}>
                {fmt(s.avgReposts)}
              </td>
              <td className={`${TD} text-right text-gray-600`}>
                {s.avgEngagementRate.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountStatsTable({ stats }: { stats: BenchmarkAccountStat[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className={TH}>アカウント</th>
            <th className={`${TH} text-right`}>件数</th>
            <th className={`${TH} text-right`}>平均再生数</th>
            <th className={`${TH} text-right`}>平均いいね</th>
            <th className={`${TH} text-right`}>平均ER%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.accountName} className={TR}>
              <td className={`${TD} font-medium text-gray-900`}>
                {s.accountName}
              </td>
              <td className={`${TD} text-right text-gray-600`}>{s.count}</td>
              <td className={`${TD} text-right font-semibold text-brand-700`}>
                {fmt(s.avgViews)}
              </td>
              <td className={`${TD} text-right text-gray-700`}>
                {fmt(s.avgLikes)}
              </td>
              <td className={`${TD} text-right text-gray-600`}>
                {s.avgEngagementRate.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MediaTypeTable({ stats }: { stats: BenchmarkMediaTypeStat[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className={TH}>メディア種別</th>
            <th className={`${TH} text-right`}>件数</th>
            <th className={`${TH} text-right`}>平均再生数</th>
            <th className={`${TH} text-right`}>平均いいね</th>
            <th className={`${TH} text-right`}>平均ER%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.mediaType} className={TR}>
              <td className={TD}>
                <span className="mr-2">{MEDIA_ICONS[s.mediaType]}</span>
                <span className="font-medium text-gray-800">{s.label}</span>
              </td>
              <td className={`${TD} text-right text-gray-600`}>{s.count}</td>
              <td className={`${TD} text-right font-semibold text-brand-700`}>
                {fmt(s.avgViews)}
              </td>
              <td className={`${TD} text-right text-gray-700`}>
                {fmt(s.avgLikes)}
              </td>
              <td className={`${TD} text-right text-gray-600`}>
                {s.avgEngagementRate.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DurationStatsTable({ stats }: { stats: BenchmarkDurationStat[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className={TH}>動画尺</th>
            <th className={`${TH} text-right`}>件数</th>
            <th className={`${TH} text-right`}>平均再生数</th>
            <th className={`${TH} text-right`}>平均いいね</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.videoDuration} className={TR}>
              <td className={`${TD} font-mono text-gray-800`}>
                {s.videoDuration}
              </td>
              <td className={`${TD} text-right text-gray-600`}>{s.count}</td>
              <td className={`${TD} text-right font-semibold text-brand-700`}>
                {fmt(s.avgViews)}
              </td>
              <td className={`${TD} text-right text-gray-700`}>
                {fmt(s.avgLikes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
