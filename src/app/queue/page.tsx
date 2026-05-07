"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useToast } from "@/components/Toast";
import type { PostQueueWithContent, QueueStatus } from "@/types";
import type { AutoPostResult } from "@/lib/autoPost";

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

// ─── 型 ─────────────────────────────────────────────────────────────────────

type AutoPostStatus = { due: number; upcoming: number; nextScheduledAt: string | null };
type ConfirmAction  = { id: string; action: "post" | "cancel" | "delete" };
type PostingMode    = { mode: "real" | "dummy"; enabled: boolean; configured: boolean; missingVars: string[] };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QueuePage() {
  const { toast } = useToast();
  const [items,         setItems]         = useState<PostQueueWithContent[]>([]);
  const [filterStatus,  setFilterStatus]  = useState("");
  const [loading,       setLoading]       = useState(true);
  const [posting,       setPosting]       = useState<string | null>(null);
  const [retrying,      setRetrying]      = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [autoRunning,   setAutoRunning]   = useState(false);
  const [autoStatus,    setAutoStatus]    = useState<AutoPostStatus | null>(null);
  const [postingMode,   setPostingMode]   = useState<PostingMode | null>(null);
  const [historyItems,  setHistoryItems]  = useState<PostQueueWithContent[]>([]);
  const [historyOpen,   setHistoryOpen]   = useState(false);

  // ── データ取得 ────────────────────────────────────────────────────────────

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

  const fetchAutoStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/queue/auto-post");
      if (!res.ok) return;
      const data = await res.json();
      setAutoStatus(data);
    } catch { /* サイレント失敗 */ }
  }, []);

  const fetchPostingMode = useCallback(async () => {
    try {
      const res = await fetch("/api/queue/posting-mode");
      if (!res.ok) return;
      const data = await res.json();
      setPostingMode(data);
    } catch { /* サイレント失敗 */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const [rPosted, rFailed] = await Promise.all([
        fetch("/api/queue?status=posted"),
        fetch("/api/queue?status=failed"),
      ]);
      const posted: PostQueueWithContent[] = rPosted.ok  ? await rPosted.json()  : [];
      const failed: PostQueueWithContent[] = rFailed.ok  ? await rFailed.json()  : [];
      const merged = [...posted, ...failed]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 20);
      setHistoryItems(merged);
    } catch { /* サイレント失敗 */ }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchAutoStatus();
    fetchPostingMode();
    fetchHistory();
  }, [fetchItems, fetchAutoStatus, fetchPostingMode, fetchHistory]);

  const queuedCount = items.filter((i) => i.status === "queued").length;
  const failedCount = items.filter((i) => i.status === "failed").length;

  // ── 自動投稿: 手動実行 ───────────────────────────────────────────────────

  const handleRunAutoPost = async () => {
    setAutoRunning(true);
    try {
      const res = await fetch("/api/queue/auto-post", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AutoPostResult & { ok: boolean; message?: string } = await res.json();

      if (!data.ok) {
        toast(data.message ?? "自動投稿に失敗しました", "error");
        return;
      }
      if (data.processed === 0) {
        toast("現在、投稿対象のキューがありません", "info");
      } else {
        toast(
          `自動投稿完了: 成功 ${data.succeeded}件 / 失敗 ${data.failed}件`,
          data.failed > 0 ? "error" : "success"
        );
      }
      await fetchItems();
      await fetchAutoStatus();
      await fetchHistory();
    } catch {
      toast("自動投稿の実行に失敗しました", "error");
    } finally {
      setAutoRunning(false);
    }
  };

  // ── 個別操作 ─────────────────────────────────────────────────────────────

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
      fetchHistory();
      fetchItems();
      fetchAutoStatus();
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
      fetchAutoStatus();
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
      fetchAutoStatus();
    } catch {
      toast("削除に失敗しました", "error");
    }
  };

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const res = await fetch(`/api/queue/${id}/retry`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? "再試行の設定に失敗しました", "error");
        return;
      }
      toast("再試行キューに追加しました。自動投稿で処理されます。", "success");
      fetchItems();
      fetchAutoStatus();
    } catch {
      toast("再試行の設定に失敗しました", "error");
    } finally {
      setRetrying(null);
    }
  };

  const execute = (id: string, action: "post" | "cancel" | "delete") => {
    if (action === "post")   handlePost(id);
    if (action === "cancel") handleCancel(id);
    if (action === "delete") handleDelete(id);
  };

  // ── インライン確認ボタン ─────────────────────────────────────────────────

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

  // ── レンダー ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl space-y-5">

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">投稿キュー</h2>
          <p className="text-sm text-gray-500 mt-0.5">生成コンテンツの SNS 投稿管理</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {/* 投稿モードバッジ */}
          {postingMode && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                postingMode.mode === "real"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-gray-100 text-gray-500 border-gray-200"
              }`}
              title={
                postingMode.mode === "real"
                  ? "X API v2 で実際に投稿されます"
                  : postingMode.enabled && !postingMode.configured
                  ? `環境変数が未設定: ${postingMode.missingVars.join(", ")}`
                  : "ログ出力のみ（SNS には送信されません）"
              }
            >
              <span className={`w-1.5 h-1.5 rounded-full ${postingMode.mode === "real" ? "bg-green-500" : "bg-gray-400"}`} />
              {postingMode.mode === "real" ? "本番投稿モード" : "ダミー投稿モード"}
            </span>
          )}
          {queuedCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
              <span className="font-semibold">{queuedCount}</span> 件待機中
            </span>
          )}
          {failedCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="font-semibold">{failedCount}</span> 件失敗
            </span>
          )}
          <button
            onClick={handleRunAutoPost}
            disabled={autoRunning}
            className="btn-primary text-sm disabled:opacity-60"
          >
            {autoRunning ? "実行中..." : "▶ 自動投稿実行"}
          </button>
          <Link href="/content" className="btn-secondary text-sm">
            コンテンツ一覧
          </Link>
        </div>
      </div>

      {/* 自動投稿ステータスバナー */}
      {autoStatus !== null && (autoStatus.due > 0 || autoStatus.upcoming > 0) && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 flex items-center justify-between gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            {autoStatus.due > 0 && (
              <span className="text-blue-700 font-medium">
                ⏰ {autoStatus.due}件 — 自動投稿待ち（期限到来）
              </span>
            )}
            {autoStatus.upcoming > 0 && (
              <span className="text-blue-600">
                📅 {autoStatus.upcoming}件 — 予約済み
              </span>
            )}
            {autoStatus.nextScheduledAt && (
              <span className="text-blue-500">
                次回: {format(new Date(autoStatus.nextScheduledAt), "M/d HH:mm")}
              </span>
            )}
          </div>
          <button
            onClick={handleRunAutoPost}
            disabled={autoRunning || autoStatus.due === 0}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {autoRunning ? "実行中..." : "今すぐ実行"}
          </button>
        </div>
      )}

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
                        <p className="text-red-500 text-xs mt-0.5 truncate" title={item.errorMessage}>
                          ⚠ {item.errorMessage}
                        </p>
                      )}
                      {/* 外部投稿ID */}
                      {(item as PostQueueWithContent & { externalPostId?: string | null }).externalPostId && (
                        <p className="text-gray-400 text-xs mt-0.5 truncate font-mono">
                          ID: {(item as PostQueueWithContent & { externalPostId?: string | null }).externalPostId}
                        </p>
                      )}
                    </td>

                    {/* PF */}
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                      {PLATFORM_LABELS[item.platform] ?? item.platform}
                    </td>

                    {/* 予定日時 */}
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                      {item.scheduledAt
                        ? format(new Date(item.scheduledAt), "M/d HH:mm")
                        : <span className="text-gray-300">—</span>}
                    </td>

                    {/* ステータス */}
                    <td className="px-4 py-4">
                      <QueueStatusBadge status={item.status} />
                    </td>

                    {/* 操作 */}
                    <td className="px-4 py-4">
                      <div className="flex gap-2 justify-end items-center flex-wrap">

                        {/* 待機中: 手動投稿 / キャンセル */}
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

                        {/* 失敗: 再試行 / 削除 */}
                        {item.status === "failed" && (
                          <>
                            <button
                              onClick={() => handleRetry(item.id)}
                              disabled={retrying === item.id}
                              className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {retrying === item.id ? "設定中..." : "↩ 再試行"}
                            </button>
                            <InlineConfirm
                              id={item.id}
                              action="delete"
                              label="削除"
                              btnClass="text-xs text-red-400 hover:text-red-600 transition-colors"
                            />
                          </>
                        )}

                        {/* キャンセル済み: 削除のみ */}
                        {item.status === "cancelled" && (
                          <InlineConfirm
                            id={item.id}
                            action="delete"
                            label="削除"
                            btnClass="text-xs text-red-400 hover:text-red-600 transition-colors"
                          />
                        )}

                        {/* 投稿済み: 実績入力リンク */}
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
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
            <span>{items.length} 件</span>
            <span className="text-gray-300">
              自動投稿: vercel.json cron / ローカル: node scripts/auto-poster.mjs
            </span>
          </div>
        </div>
      )}

      {/* ─── 実行履歴 ──────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-2">
            <span>実行履歴</span>
            <span className="text-xs font-normal text-gray-400">
              （投稿済み / 失敗 — 直近 20 件）
            </span>
          </span>
          <span className="text-gray-400 text-xs">{historyOpen ? "▲ 閉じる" : "▼ 開く"}</span>
        </button>

        {historyOpen && (
          historyItems.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">履歴がありません</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {historyItems.map((item) => {
                const isPosted = item.status === "posted";
                const ts = item.postedAt ?? item.updatedAt;
                return (
                  <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                    {/* ステータスドット */}
                    <span
                      className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${
                        isPosted ? "bg-green-500" : "bg-red-400"
                      }`}
                    />

                    {/* メイン情報 */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {item.generatedContent.title ?? "(タイトルなし)"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {PLATFORM_LABELS[item.platform] ?? item.platform}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            isPosted
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {isPosted ? "成功" : "失敗"}
                        </span>
                      </div>

                      {/* 投稿済み: externalPostId */}
                      {isPosted && item.externalPostId && (
                        <p className="text-xs text-gray-400 font-mono">
                          ID: {item.externalPostId}
                        </p>
                      )}

                      {/* 失敗: エラー理由 */}
                      {!isPosted && item.errorMessage && (
                        <p className="text-xs text-red-500 break-all">
                          {item.errorMessage}
                        </p>
                      )}
                    </div>

                    {/* タイムスタンプ */}
                    <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap pt-0.5">
                      {ts ? format(new Date(ts), "M/d HH:mm") : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>

    </div>
  );
}
