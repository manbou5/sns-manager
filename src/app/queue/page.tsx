"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useToast } from "@/components/Toast";
import type { PostQueueWithContent, QueueStatus } from "@/types";

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<QueueStatus, { label: string; className: string }> = {
  queued:    { label: "待機中",     className: "bg-yellow-100 text-yellow-700" },
  posted:    { label: "投稿済み",   className: "bg-green-100 text-green-700"  },
  failed:    { label: "失敗",       className: "bg-red-100 text-red-700"      },
  cancelled: { label: "キャンセル", className: "bg-gray-100 text-gray-500"   },
};

const FILTER_OPTIONS = [
  { value: "",          label: "すべて"       },
  { value: "queued",    label: "待機中"       },
  { value: "posted",    label: "投稿済み"     },
  { value: "failed",    label: "失敗"         },
  { value: "cancelled", label: "キャンセル"   },
];

const PLATFORM_LABELS: Record<string, string> = {
  X:         "X",
  INSTAGRAM: "Instagram",
  BOTH:      "両方",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="card p-0 overflow-hidden animate-pulse">
      <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex gap-6">
        {[160, 80, 80, 70].map((w, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: w }} />
        ))}
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
          <div className="flex-1 space-y-1.5">
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="h-4 w-16 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-5 w-14 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function QueueStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as QueueStatus] ?? STATUS_CONFIG.queued;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const { toast } = useToast();
  const [items,        setItems]        = useState<PostQueueWithContent[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading,      setLoading]      = useState(true);
  const [posting,      setPosting]      = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "post" | "cancel" | "delete" } | null>(null);

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
      toast("キュー一覧の取得に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const queuedCount = items.filter((i) => i.status === "queued").length;

  const handlePost = async (id: string) => {
    setConfirmAction(null);
    setPosting(id);
    try {
      const res = await fetch(`/api/queue/${id}/post`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? "投稿に失敗しました", "error");
        return;
      }
      toast("投稿済みに変更しました", "success");
      fetchItems();
    } catch {
      toast("投稿処理に失敗しました", "error");
    } finally {
      setPosting(null);
    }
  };

  const handleCancel = async (id: string) => {
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/queue/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast("キャンセルしました", "info");
      fetchItems();
    } catch {
      toast("キャンセルに失敗しました", "error");
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/queue/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast("削除しました", "success");
      fetchItems();
    } catch {
      toast("削除に失敗しました", "error");
    }
  };

  const execute = (id: string, action: "post" | "cancel" | "delete") => {
    if (action === "post")   handlePost(id);
    if (action === "cancel") handleCancel(id);
    if (action === "delete") handleDelete(id);
  };

  // インライン確認ボタン
  function InlineConfirm({
    id, action, label, btnClass,
  }: {
    id: string; action: "post" | "cancel" | "delete"; label: string; btnClass: string;
  }) {
    const active = confirmAction?.id === id && confirmAction.action === action;
    if (active) {
      return (
        <span className="flex items-center gap-1">
          <button
            onClick={() => execute(id, action)}
            disabled={action === "post" && posting === id}
            className="text-xs px-2 py-1 text-white rounded transition-colors disabled:opacity-50 bg-gray-700 hover:bg-gray-800"
          >
            確認
          </button>
          <button
            onClick={() => setConfirmAction(null)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </span>
      );
    }
    return (
      <button
        onClick={() => setConfirmAction({ id, action })}
        disabled={action === "post" && posting === id}
        className={btnClass}
      >
        {action === "post" && posting === id ? "処理中..." : label}
      </button>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">投稿キュー</h2>
          <p className="text-sm text-gray-500 mt-0.5">生成コンテンツの SNS 投稿管理</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
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

      {/* フィルター */}
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

      {/* テーブル */}
      {loading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-600 font-medium">
            {filterStatus
              ? `「${FILTER_OPTIONS.find((o) => o.value === filterStatus)?.label}」のキューが見つかりません`
              : "キューが空です"}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            コンテンツ一覧の「キュー追加」からコンテンツを登録できます
          </p>
          <Link href="/content" className="btn-primary inline-block mt-5 text-sm">
            コンテンツ一覧へ
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
                  <th className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap">予定日時</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">ステータス</th>
                  <th className="px-4 py-3 text-right text-gray-500 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
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

                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                      {PLATFORM_LABELS[item.platform] ?? item.platform}
                    </td>

                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                      {item.scheduledAt
                        ? format(new Date(item.scheduledAt), "M/d HH:mm")
                        : <span className="text-gray-300">—</span>}
                    </td>

                    <td className="px-4 py-4">
                      <QueueStatusBadge status={item.status} />
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex gap-2 justify-end items-center flex-wrap">
                        {item.status === "queued" && (
                          <>
                            <InlineConfirm
                              id={item.id}
                              action="post"
                              label="投稿する"
                              btnClass="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                            />
                            <InlineConfirm
                              id={item.id}
                              action="cancel"
                              label="キャンセル"
                              btnClass="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
                            />
                          </>
                        )}

                        {(item.status === "cancelled" || item.status === "failed") && (
                          <InlineConfirm
                            id={item.id}
                            action="delete"
                            label="削除"
                            btnClass="text-xs text-red-400 hover:text-red-600 transition-colors"
                          />
                        )}

                        {item.status === "posted" && (
                          <div className="flex gap-2 items-center flex-wrap justify-end">
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
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {items.length} 件
          </div>
        </div>
      )}
    </div>
  );
}
