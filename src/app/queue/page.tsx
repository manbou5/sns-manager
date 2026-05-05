"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { PostQueueWithContent, QueueStatus } from "@/types";

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QueueStatus, { label: string; className: string }> = {
  queued:    { label: "待機中",     className: "bg-yellow-100 text-yellow-700" },
  posted:    { label: "投稿済み",   className: "bg-green-100 text-green-700" },
  failed:    { label: "失敗",       className: "bg-red-100 text-red-700" },
  cancelled: { label: "キャンセル", className: "bg-gray-100 text-gray-500" },
};

const FILTER_OPTIONS = [
  { value: "",          label: "すべて" },
  { value: "queued",    label: "待機中" },
  { value: "posted",    label: "投稿済み" },
  { value: "failed",    label: "失敗" },
  { value: "cancelled", label: "キャンセル" },
];

const PLATFORM_LABELS: Record<string, string> = {
  X:         "X",
  INSTAGRAM: "Instagram",
  BOTH:      "両方",
};

// ─── サブコンポーネント ────────────────────────────────────────────────────────

function QueueStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as QueueStatus] ?? STATUS_CONFIG.queued;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── ページ ───────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const [items,        setItems]        = useState<PostQueueWithContent[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading,      setLoading]      = useState(true);
  const [posting,      setPosting]      = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus ? `/api/queue?status=${filterStatus}` : "/api/queue";
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

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // 疑似投稿
  const handlePost = async (id: string) => {
    if (!confirm("このコンテンツを「投稿済み」にしますか？\n（疑似投稿 — 実際の SNS には送信されません）")) return;
    setPosting(id);
    const res = await fetch(`/api/queue/${id}/post`, { method: "POST" });
    setPosting(null);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "エラーが発生しました");
      return;
    }
    fetchItems();
  };

  // キャンセル
  const handleCancel = async (id: string) => {
    if (!confirm("このキューをキャンセルしますか？")) return;
    await fetch(`/api/queue/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "cancelled" }),
    });
    fetchItems();
  };

  // 削除
  const handleDelete = async (id: string) => {
    if (!confirm("このキューを削除しますか？")) return;
    await fetch(`/api/queue/${id}`, { method: "DELETE" });
    fetchItems();
  };

  // 待機中件数（フィルター無関係に表示）
  const queuedCount = items.filter((i) => i.status === "queued").length;

  return (
    <div className="max-w-5xl space-y-6">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">投稿キュー</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            生成コンテンツの SNS 投稿管理
          </p>
        </div>
        <div className="flex gap-3">
          {queuedCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
              <span className="font-semibold">{queuedCount}</span> 件待機中
            </span>
          )}
          <Link href="/content" className="btn-secondary text-sm">
            コンテンツ一覧
          </Link>
        </div>
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

      {/* ── キュー一覧 ── */}
      {loading ? (
        <div className="card text-center text-gray-400 py-12">読み込み中...</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12 space-y-3">
          <p className="text-gray-400">
            {filterStatus
              ? `「${FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label}」のキューが見つかりません`
              : "キューが空です"}
          </p>
          <p className="text-gray-400 text-sm">
            コンテンツ一覧の「キュー追加」からコンテンツを登録できます
          </p>
          <Link href="/content" className="btn-primary inline-block text-sm">
            コンテンツ一覧へ
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">
                  コンテンツ
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  プラットフォーム
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  予定日時
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  ステータス
                </th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {/* コンテンツ */}
                  <td className="px-5 py-4 max-w-xs">
                    <p className="font-medium text-gray-900 truncate">
                      {item.generatedContent.title ?? (
                        <span className="text-gray-400 font-normal">タイトルなし</span>
                      )}
                    </p>
                    {item.generatedContent.caption && (
                      <p className="text-gray-400 text-xs mt-0.5 truncate">
                        {item.generatedContent.caption}
                      </p>
                    )}
                    {item.errorMessage && (
                      <p className="text-red-500 text-xs mt-0.5 truncate">
                        ⚠ {item.errorMessage}
                      </p>
                    )}
                  </td>

                  {/* プラットフォーム */}
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                    {PLATFORM_LABELS[item.platform] ?? item.platform}
                  </td>

                  {/* 予定日時 */}
                  <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                    {item.scheduledAt
                      ? format(new Date(item.scheduledAt), "M/d HH:mm")
                      : <span className="text-gray-400">—</span>}
                  </td>

                  {/* ステータス */}
                  <td className="px-4 py-4">
                    <QueueStatusBadge status={item.status} />
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-4">
                    <div className="flex gap-2 justify-end flex-wrap">
                      {item.status === "queued" && (
                        <>
                          <button
                            onClick={() => handlePost(item.id)}
                            disabled={posting === item.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            {posting === item.id ? "処理中..." : "投稿する"}
                          </button>
                          <button
                            onClick={() => handleCancel(item.id)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                          >
                            キャンセル
                          </button>
                        </>
                      )}
                      {(item.status === "cancelled" || item.status === "failed") && (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-xs text-red-500 hover:underline whitespace-nowrap"
                        >
                          削除
                        </button>
                      )}
                      {item.status === "posted" && (
                        <div className="flex gap-2 items-center justify-end flex-wrap">
                          <Link
                            href={`/performance/new?queueId=${item.id}`}
                            className="text-xs px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 whitespace-nowrap transition-colors"
                          >
                            📈 実績入力
                          </Link>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {item.updatedAt
                              ? format(new Date(item.updatedAt), "M/d HH:mm 投稿")
                              : "—"}
                          </span>
                        </div>
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
