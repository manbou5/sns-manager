"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { GeneratedContent, ContentStatus } from "@/types";

// ─── ステータス設定 ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ContentStatus, { label: string; className: string }> = {
  draft:     { label: "下書き",   className: "bg-gray-100 text-gray-600" },
  ready:     { label: "準備完了", className: "bg-green-100 text-green-700" },
  scheduled: { label: "予約済み", className: "bg-blue-100 text-blue-700" },
  posted:    { label: "投稿済み", className: "bg-purple-100 text-purple-700" },
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "",          label: "すべて" },
  { value: "draft",     label: "下書き" },
  { value: "ready",     label: "準備完了" },
  { value: "scheduled", label: "予約済み" },
  { value: "posted",    label: "投稿済み" },
];

const MEDIA_ICONS: Record<string, string> = {
  IMAGE: "🖼️",
  VIDEO: "🎬",
  MIXED: "🔀",
};

function ContentStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as ContentStatus] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── ページ ───────────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [items,        setItems]        = useState<GeneratedContent[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading,      setLoading]      = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus ? `/api/content?status=${filterStatus}` : "/api/content";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[fetchItems]", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const deleteItem = async (id: string) => {
    if (!confirm("このコンテンツを削除しますか？")) return;
    await fetch(`/api/content/${id}`, { method: "DELETE" });
    fetchItems();
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">生成コンテンツ</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            AIプロンプト・投稿案のコンテンツバンク
          </p>
        </div>
        <Link href="/content/new" className="btn-primary">
          + 新規作成
        </Link>
      </div>

      {/* ── ステータスフィルター ── */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterStatus(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterStatus === opt.value
                ? "bg-brand-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── コンテンツ一覧 ── */}
      {loading ? (
        <div className="card text-center text-gray-400 py-12">読み込み中...</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12 space-y-3">
          <p className="text-gray-400">
            {filterStatus
              ? `「${FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label}」のコンテンツが見つかりません`
              : "コンテンツがまだありません"}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/content/new" className="btn-primary inline-block">
              コンテンツを作成する
            </Link>
            <Link href="/benchmark/recommendations" className="btn-secondary inline-block">
              推薦結果から作成
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">
                  タイトル / キャプション
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  ステータス
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  メディア
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  作成日
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 max-w-xs">
                    <p className="font-medium text-gray-900 truncate">
                      {item.title ?? (
                        <span className="text-gray-400 font-normal">タイトルなし</span>
                      )}
                    </p>
                    {item.caption ? (
                      <p className="text-gray-400 text-xs mt-0.5 truncate">
                        {item.caption}
                      </p>
                    ) : item.prompt ? (
                      <p className="text-gray-400 text-xs mt-0.5 truncate font-mono">
                        📋 {item.prompt.replace(/^#.*\n*/m, "").trim().slice(0, 60)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <ContentStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4 text-lg">
                    {MEDIA_ICONS[item.mediaType] ?? "📁"}
                    <span className="text-xs text-gray-400 ml-1">{item.mediaType}</span>
                  </td>
                  <td className="px-4 py-4 text-gray-500 whitespace-nowrap">
                    {format(new Date(item.createdAt), "M/d HH:mm")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-3 justify-end flex-wrap">
                      {item.status !== "posted" && (
                        <Link
                          href={`/queue/new?contentId=${item.id}`}
                          className="text-xs px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 whitespace-nowrap transition-colors"
                        >
                          📅 キュー追加
                        </Link>
                      )}
                      <Link
                        href={`/content/${item.id}/edit`}
                        className="text-brand-600 hover:underline whitespace-nowrap"
                      >
                        編集
                      </Link>
                      {item.status !== "posted" && (
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-red-500 hover:underline whitespace-nowrap"
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
      )}
    </div>
  );
}
