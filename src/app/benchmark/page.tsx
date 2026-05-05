"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { BenchmarkCsvImport } from "@/components/BenchmarkCsvImport";
import { decodeTags } from "@/lib/benchmarkCsv";
import { GROWTH_REASON_TAGS } from "@/types";
import type { BenchmarkPost, MediaType } from "@/types";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// ─── 定数 ──────────────────────────────────────────────────────────────────────

const MEDIA_ICONS: Record<MediaType, string> = {
  IMAGE: "🖼️",
  VIDEO: "🎬",
  MIXED: "🔀",
};

const MEDIA_LABELS: Record<MediaType, string> = {
  IMAGE: "画像",
  VIDEO: "動画",
  MIXED: "混合",
};

const TAG_COLORS: Record<string, string> = {
  構図:       "bg-blue-100 text-blue-700",
  表情:       "bg-pink-100 text-pink-700",
  服装:       "bg-purple-100 text-purple-700",
  背景:       "bg-green-100 text-green-700",
  動画テンポ: "bg-orange-100 text-orange-700",
  カメラワーク:"bg-cyan-100 text-cyan-700",
  キャプション:"bg-indigo-100 text-indigo-700",
  ハッシュタグ:"bg-teal-100 text-teal-700",
  投稿時間:   "bg-yellow-100 text-yellow-700",
  その他:     "bg-gray-100 text-gray-700",
};

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function engagementRate(post: BenchmarkPost): string {
  if (!post.views || post.views === 0) return "—";
  const rate = ((post.likes + post.reposts + post.replies) / post.views) * 100;
  return rate.toFixed(1) + "%";
}

function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  return n.toLocaleString();
}

// ─── コンポーネント ────────────────────────────────────────────────────────────

export default function BenchmarkPage() {
  const [allPosts,      setAllPosts]      = useState<BenchmarkPost[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);

  // フィルター状態
  const [filterAccount,   setFilterAccount]   = useState("");
  const [filterMediaType, setFilterMediaType] = useState<MediaType | "">("");
  const [filterTag,       setFilterTag]       = useState("");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/benchmark");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[fetchPosts]", e);
      setAllPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // 重複なしアカウント名一覧（フィルター選択肢）
  const accountNames = useMemo(
    () => Array.from(new Set(allPosts.map((p) => p.accountName))).sort(),
    [allPosts]
  );

  // クライアントサイドフィルター
  const filteredPosts = useMemo(() => {
    return allPosts.filter((p) => {
      if (filterAccount   && p.accountName !== filterAccount)    return false;
      if (filterMediaType && p.mediaType   !== filterMediaType)  return false;
      if (filterTag) {
        const tags = decodeTags(p.growthReasonTags);
        if (!tags.includes(filterTag)) return false;
      }
      return true;
    });
  }, [allPosts, filterAccount, filterMediaType, filterTag]);

  const hasFilter = filterAccount !== "" || filterMediaType !== "" || filterTag !== "";

  const handleDelete = async (id: string, accountName: string) => {
    if (!confirm(`「${accountName}」の投稿を削除しますか？`)) return;
    await fetch(`/api/benchmark/${id}`, { method: "DELETE" });
    fetchPosts();
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // タグ集計（フィルター前の全データ）
  const tagStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const post of allPosts) {
      for (const tag of decodeTags(post.growthReasonTags)) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return counts;
  }, [allPosts]);

  return (
    <div className="max-w-7xl space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">ベンチマーク分析</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            参考アカウントの投稿データを蓄積・分析
          </p>
        </div>
        <Link href="/benchmark/new" className="btn-primary">
          + 新規登録
        </Link>
      </div>

      {/* タグ集計バー */}
      {Object.keys(tagStats).length > 0 && (
        <div className="card py-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 mr-1">タグ集計:</span>
            {GROWTH_REASON_TAGS.filter((t) => tagStats[t]).map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag((prev) => (prev === tag ? "" : tag))}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                  ${filterTag === tag
                    ? "ring-2 ring-offset-1 ring-brand-500 " + (TAG_COLORS[tag] ?? "bg-gray-100 text-gray-700")
                    : (TAG_COLORS[tag] ?? "bg-gray-100 text-gray-700") + " hover:opacity-80"
                  }`}
              >
                {tag}
                <span className="opacity-70">{tagStats[tag]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CSVインポート */}
      <BenchmarkCsvImport onImportComplete={fetchPosts} />

      {/* フィルターバー */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* アカウント */}
        <select
          className="input w-auto min-w-[160px]"
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
        >
          <option value="">アカウント: すべて</option>
          {accountNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* メディア種別 */}
        <div className="flex gap-1">
          {(["", "IMAGE", "VIDEO", "MIXED"] as const).map((mt) => (
            <button
              key={mt}
              onClick={() => setFilterMediaType(mt as MediaType | "")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filterMediaType === mt
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {mt === "" ? "すべて" : `${MEDIA_ICONS[mt as MediaType]} ${MEDIA_LABELS[mt as MediaType]}`}
            </button>
          ))}
        </div>

        {/* タグ */}
        <select
          className="input w-auto min-w-[140px]"
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
        >
          <option value="">タグ: すべて</option>
          {GROWTH_REASON_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {tag} {tagStats[tag] ? `(${tagStats[tag]})` : ""}
            </option>
          ))}
        </select>

        {/* リセット */}
        {hasFilter && (
          <button
            onClick={() => {
              setFilterAccount("");
              setFilterMediaType("");
              setFilterTag("");
            }}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            ✕ フィルターリセット
          </button>
        )}

        <span className="ml-auto text-sm text-gray-500">
          {hasFilter
            ? `${filteredPosts.length} / ${allPosts.length} 件`
            : `全 ${allPosts.length} 件`}
        </span>
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="card text-center text-gray-400 py-12">読み込み中...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 mb-4">
            {hasFilter ? "条件に一致するデータがありません" : "データがまだありません"}
          </p>
          {!hasFilter && (
            <Link href="/benchmark/new" className="btn-primary inline-block">
              最初のデータを登録する
            </Link>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                <tr>
                  <th className="w-8 px-2 py-3"></th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">アカウント</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">投稿日時</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium">種別</th>
                  <th className="text-right px-3 py-3 text-gray-500 font-medium">❤️</th>
                  <th className="text-right px-3 py-3 text-gray-500 font-medium">🔁</th>
                  <th className="text-right px-3 py-3 text-gray-500 font-medium">👁</th>
                  <th className="text-right px-3 py-3 text-gray-500 font-medium whitespace-nowrap">ER%</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">タグ</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">伸び理由(抜粋)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => {
                  const tags = decodeTags(post.growthReasonTags);
                  const isExpanded = expandedId === post.id;

                  return (
                    <>
                      <tr
                        key={post.id}
                        onClick={() => toggleExpand(post.id)}
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${
                          isExpanded ? "bg-brand-50" : "hover:bg-gray-50"
                        }`}
                      >
                        {/* 展開ボタン */}
                        <td className="px-2 py-3 text-center text-gray-400 text-xs">
                          {isExpanded ? "▲" : "▼"}
                        </td>

                        {/* アカウント */}
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900 whitespace-nowrap">
                            {post.accountName}
                          </span>
                        </td>

                        {/* 投稿日時 */}
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {post.postedAt
                            ? format(new Date(post.postedAt), "M/d HH:mm", { locale: ja })
                            : "—"}
                        </td>

                        {/* メディア種別 */}
                        <td className="px-3 py-3 text-center text-lg">
                          <span title={MEDIA_LABELS[post.mediaType as MediaType]}>
                            {MEDIA_ICONS[post.mediaType as MediaType] ?? "🖼️"}
                          </span>
                          {post.videoDuration && (
                            <span className="text-xs text-gray-400 ml-1">
                              {post.videoDuration}
                            </span>
                          )}
                        </td>

                        {/* 数値 */}
                        <td className="px-3 py-3 text-right font-medium text-pink-600">
                          {fmt(post.likes)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">
                          {fmt(post.reposts)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">
                          {fmt(post.views)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-500 text-xs">
                          {engagementRate(post)}
                        </td>

                        {/* タグ */}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                  TAG_COLORS[tag] ?? "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-xs text-gray-400">+{tags.length - 3}</span>
                            )}
                          </div>
                        </td>

                        {/* 伸び理由抜粋 */}
                        <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                          <p className="truncate text-xs">
                            {post.growthReasonNote ?? "—"}
                          </p>
                        </td>

                        {/* 操作 */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-3 justify-end whitespace-nowrap">
                            {post.postUrl && (
                              <a
                                href={post.postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-brand-600 text-xs"
                              >
                                🔗
                              </a>
                            )}
                            <Link
                              href={`/benchmark/${post.id}/edit`}
                              className="text-brand-600 hover:underline text-xs"
                            >
                              編集
                            </Link>
                            <button
                              onClick={() => handleDelete(post.id, post.accountName)}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 展開行 */}
                      {isExpanded && (
                        <tr key={`${post.id}-expanded`} className="bg-brand-50 border-b border-brand-100">
                          <td colSpan={11} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {post.bodyText && (
                                <div className="md:col-span-2">
                                  <p className="text-xs font-medium text-gray-500 mb-1">投稿本文</p>
                                  <p className="text-gray-700 whitespace-pre-wrap bg-white rounded p-2 border border-brand-100">
                                    {post.bodyText}
                                  </p>
                                </div>
                              )}

                              {post.compositionNote && (
                                <NoteField label="構図・カメラワーク" value={post.compositionNote} />
                              )}
                              {post.characterNote && (
                                <NoteField label="顔・表情・服装・背景" value={post.characterNote} />
                              )}
                              {post.aiReductionNote && (
                                <NoteField label="AI感を減らす工夫" value={post.aiReductionNote} />
                              )}
                              {post.growthReasonNote && (
                                <NoteField label="伸びた理由メモ" value={post.growthReasonNote} />
                              )}
                              {post.applicationNote && (
                                <NoteField label="🌟 自分の投稿への応用案" value={post.applicationNote} accent />
                              )}

                              {/* タグ全表示 */}
                              {decodeTags(post.growthReasonTags).length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">伸びた理由タグ</p>
                                  <div className="flex flex-wrap gap-1">
                                    {decodeTags(post.growthReasonTags).map((tag) => (
                                      <span
                                        key={tag}
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          TAG_COLORS[tag] ?? "bg-gray-100 text-gray-700"
                                        }`}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 登録日 */}
                              <div className="md:col-span-2 text-right">
                                <span className="text-xs text-gray-400">
                                  登録: {format(new Date(post.createdAt), "yyyy/M/d HH:mm")}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        ※ 行をクリックすると詳細メモを展開できます
      </p>
    </div>
  );
}

// 展開行内のメモフィールド
function NoteField({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p
        className={`text-gray-700 text-sm whitespace-pre-wrap rounded p-2 border ${
          accent
            ? "bg-brand-50 border-brand-200 text-brand-800"
            : "bg-white border-gray-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
