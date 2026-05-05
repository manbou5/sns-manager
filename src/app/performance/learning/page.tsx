"use client";

import { useEffect, useState, useRef } from "react";
import type {
  LearningDashboardData,
  LearningTopPost,
  LearningPlatformStat,
  LearningMediaTypeStat,
} from "@/types";

const MEMO_KEY = "learning_memo";

// ─── サブコンポーネント ────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`card p-5 ${highlight ? "border-2 border-brand-400" : ""}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-brand-600" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ErBadge({ er }: { er: number }) {
  const color =
    er >= 5 ? "text-green-700 bg-green-50" :
    er >= 2 ? "text-yellow-700 bg-yellow-50" :
              "text-gray-600 bg-gray-100";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      ER {er.toFixed(2)}%
    </span>
  );
}

function TopPostCard({ post, rank }: { post: LearningTopPost; rank: number }) {
  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-300">#{rank}</span>
          <div>
            <p className="font-medium text-gray-900 text-sm">
              {post.title ?? <span className="text-gray-400 font-normal">タイトルなし</span>}
            </p>
            <p className="text-xs text-gray-400">{post.platform} · {post.mediaType}</p>
          </div>
        </div>
        <ErBadge er={post.engagementRate} />
      </div>
      {post.caption && (
        <p className="text-xs text-gray-600 line-clamp-2">{post.caption}</p>
      )}
      {post.prompt && (
        <details className="text-xs">
          <summary className="text-gray-400 cursor-pointer hover:text-gray-600">プロンプト表示</summary>
          <p className="mt-1 text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">{post.prompt}</p>
        </details>
      )}
      <p className="text-xs text-gray-400">
        👁 {post.views.toLocaleString()} &nbsp; ❤️ {post.likes.toLocaleString()}
      </p>
    </div>
  );
}

function PlatformTable({ rows }: { rows: LearningPlatformStat[] }) {
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">プラットフォーム</th>
            <th className="text-right px-4 py-3 text-gray-500 font-medium">件数</th>
            <th className="text-right px-4 py-3 text-gray-500 font-medium">平均 Views</th>
            <th className="text-right px-4 py-3 text-gray-500 font-medium">平均 Likes</th>
            <th className="text-right px-4 py-3 text-gray-500 font-medium">平均 ER</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => (
            <tr key={r.platform} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{r.platform}</td>
              <td className="px-4 py-3 text-right text-gray-600">{r.count}</td>
              <td className="px-4 py-3 text-right text-gray-600">{r.avgViews.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-gray-600">{r.avgLikes.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <ErBadge er={r.avgEngagementRate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MediaTypeTable({ rows }: { rows: LearningMediaTypeStat[] }) {
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 text-gray-500 font-medium">メディアタイプ</th>
            <th className="text-right px-4 py-3 text-gray-500 font-medium">件数</th>
            <th className="text-right px-4 py-3 text-gray-500 font-medium">平均 Views</th>
            <th className="text-right px-4 py-3 text-gray-500 font-medium">平均 Likes</th>
            <th className="text-right px-4 py-3 text-gray-500 font-medium">平均 ER</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => (
            <tr key={r.mediaType} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{r.mediaType}</td>
              <td className="px-4 py-3 text-right text-gray-600">{r.count}</td>
              <td className="px-4 py-3 text-right text-gray-600">{r.avgViews.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-gray-600">{r.avgLikes.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <ErBadge er={r.avgEngagementRate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── ページ ───────────────────────────────────────────────────────────────────

export default function LearningPage() {
  const [data,    setData]    = useState<LearningDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [memo,    setMemo]    = useState("");
  const memoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/performance/learning")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); })
      .catch((e) => { console.error("[learning]", e); })
      .finally(() => { setLoading(false); });
    setMemo(localStorage.getItem(MEMO_KEY) ?? "");
  }, []);

  const saveMemo = () => {
    localStorage.setItem(MEMO_KEY, memoRef.current?.value ?? "");
    setMemo(memoRef.current?.value ?? "");
    alert("メモを保存しました");
  };

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  }

  if (!data || data.totalMetrics === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <h2 className="text-2xl font-bold">再学習ダッシュボード</h2>
        <div className="card text-center py-12 text-gray-400">
          実績データがまだありません。投稿後に実績を入力してください。
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      {/* ── ヘッダー ── */}
      <div>
        <h2 className="text-2xl font-bold">🧠 再学習ダッシュボード</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          自アカウントの実績データをもとに次回投稿を改善するためのインサイト
        </p>
      </div>

      {/* ── サマリーカード ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard label="計測件数"         value={`${data.totalMetrics} 件`} />
        <SummaryCard label="平均 ER"           value={`${data.avgEngagementRate}%`} highlight />
        <SummaryCard label="平均 Views"        value={data.avgViews.toLocaleString()} />
        <SummaryCard label="平均 Likes"        value={data.avgLikes.toLocaleString()} />
        <SummaryCard
          label="累計フォロワー増"
          value={`+${data.totalFollowersGained.toLocaleString()}`}
          sub={`高 ER しきい値 ${data.highErThreshold}%`}
        />
      </div>

      {/* ── ER 上位投稿 ── */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-gray-800">ER 上位投稿 Top 5</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.topPosts.map((post, i) => (
            <TopPostCard key={post.metricId} post={post} rank={i + 1} />
          ))}
        </div>
      </section>

      {/* ── Platform / MediaType テーブル ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-gray-800">プラットフォーム別実績</h3>
          {data.platformStats.length > 0
            ? <PlatformTable rows={data.platformStats} />
            : <p className="text-sm text-gray-400">データなし</p>
          }
        </section>
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-gray-800">メディアタイプ別実績</h3>
          {data.mediaTypeStats.length > 0
            ? <MediaTypeTable rows={data.mediaTypeStats} />
            : <p className="text-sm text-gray-400">データなし</p>
          }
        </section>
      </div>

      {/* ── 高 ER プロンプト ── */}
      {data.highErPrompts.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-gray-800">
            高 ER 投稿に使われたプロンプト（上位 30%）
          </h3>
          <div className="space-y-2">
            {data.highErPrompts.map((p, i) => (
              <div key={i} className="card p-3 text-xs text-gray-700 whitespace-pre-wrap">
                {p}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 高 ER キャプション ── */}
      {data.highErCaptions.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-gray-800">
            高 ER 投稿のキャプション（上位 30%）
          </h3>
          <div className="space-y-2">
            {data.highErCaptions.map((c, i) => (
              <div key={i} className="card p-3 text-xs text-gray-700 whitespace-pre-wrap">
                {c}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 次回改善メモ ── */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold text-gray-800">次回改善メモ</h3>
        <div className="card p-4 space-y-3">
          <textarea
            ref={memoRef}
            defaultValue={memo}
            rows={6}
            placeholder="気づいたこと・次回試したいこと・改善ポイントを自由に記録..."
            className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-700"
          />
          <div className="flex justify-end">
            <button
              onClick={saveMemo}
              className="btn-primary text-sm"
            >
              メモを保存
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
