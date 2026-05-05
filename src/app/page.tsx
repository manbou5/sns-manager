"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import type { Post, PostStatus } from "@/types";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

type Stats = {
  draft: number;
  scheduled: number;
  pending: number;
  posted: number;
  failed: number;
};

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="max-w-5xl space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="card space-y-2">
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-8 w-10 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="card space-y-3">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-t border-gray-50">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-4 flex-1 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quick actions ───────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { href: "/posts/new",  label: "新規投稿作成",     icon: "✏️",  desc: "下書き・予約投稿"    },
  { href: "/queue",      label: "投稿キュー確認",   icon: "🚀",  desc: "待機中の投稿を管理"  },
  { href: "/content/new",label: "コンテンツ生成",  icon: "✨",  desc: "AIで文章を生成"      },
  { href: "/performance",label: "実績入力",        icon: "📊",  desc: "SNSパフォーマンス記録"},
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({
    draft: 0, scheduled: 0, pending: 0, posted: 0, failed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setFetchError(false);
    try {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Post[] = await res.json();
      setPosts(data);
      setPendingPosts(data.filter((p) => p.status === "PENDING_CONFIRMATION"));
      setStats({
        draft:     data.filter((p) => p.status === "DRAFT").length,
        scheduled: data.filter((p) => p.status === "SCHEDULED").length,
        pending:   data.filter((p) => p.status === "PENDING_CONFIRMATION").length,
        posted:    data.filter((p) => p.status === "POSTED").length,
        failed:    data.filter((p) => p.status === "FAILED").length,
      });
    } catch (e) {
      console.error("[fetchPosts]", e);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const runScheduler = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduler", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.updated > 0) fetchPosts();
    } catch (e) {
      console.error("[runScheduler]", e);
    }
  }, [fetchPosts]);

  useEffect(() => {
    fetchPosts();
    runScheduler();
    const interval = setInterval(runScheduler, 60_000);
    return () => clearInterval(interval);
  }, [fetchPosts, runScheduler]);

  const confirmPost = async (postId: string, force = false) => {
    setConfirming(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forcePost: force }),
      });
      if (!res.ok && res.status !== 409) {
        toast("投稿の確認に失敗しました", "error");
        return;
      }
      const data = await res.json();
      if (res.status === 409 && data.requiresForce) {
        const ok = window.confirm(`⚠️ ${data.warning.message}\n\nそれでも投稿しますか？`);
        if (ok) await confirmPost(postId, true);
      } else {
        toast("投稿を確認しました", "success");
        fetchPosts();
      }
    } finally {
      setConfirming(null);
    }
  };

  const rejectPost = async (postId: string) => {
    await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT" }),
    });
    toast("下書きに戻しました", "info");
    fetchPosts();
  };

  if (loading) return <DashboardSkeleton />;

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500 font-medium">読み込みに失敗しました</p>
        <button
          onClick={() => { setLoading(true); fetchPosts(); }}
          className="btn-secondary text-sm"
        >
          再試行
        </button>
      </div>
    );
  }

  const STAT_CARDS = [
    { label: "下書き",   count: stats.draft,     color: "text-gray-700",   bg: "bg-gray-50",   border: "border-gray-200" },
    { label: "予約済み", count: stats.scheduled,  color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
    { label: "確認待ち", count: stats.pending,    color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200" },
    { label: "投稿済み", count: stats.posted,     color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
    { label: "失敗",     count: stats.failed,     color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* ヘッダー */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), "yyyy年M月d日 (EEEE)", { locale: ja })}
        </p>
      </div>

      {/* ステータス統計カード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {STAT_CARDS.map(({ label, count, color, bg, border }) => (
          <div
            key={label}
            className={`rounded-xl border ${border} ${bg} p-4`}
          >
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`text-3xl font-bold ${color} mt-1 tabular-nums`}>{count}</p>
          </div>
        ))}
      </div>

      {/* クイックアクション */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(({ href, label, icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="card hover:shadow-md hover:border-brand-200 transition-all group p-4 space-y-1"
          >
            <span className="text-2xl">{icon}</span>
            <p className="font-semibold text-gray-900 text-sm group-hover:text-brand-700 transition-colors">
              {label}
            </p>
            <p className="text-xs text-gray-400">{desc}</p>
          </Link>
        ))}
      </div>

      {/* 確認待ち投稿 */}
      {pendingPosts.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50">
          <h3 className="font-semibold text-yellow-800 mb-4 flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-yellow-400 text-white text-xs rounded-full font-bold">
              {pendingPosts.length}
            </span>
            確認待ち投稿
          </h3>
          <div className="space-y-3">
            {pendingPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-lg p-4 border border-yellow-200 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {post.title ?? "タイトルなし"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {post.caption}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    予定:{" "}
                    {post.scheduledAt
                      ? format(new Date(post.scheduledAt), "M/d HH:mm")
                      : "—"}
                    　PF: {post.platform}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => confirmPost(post.id)}
                    disabled={confirming === post.id}
                    className="btn-primary text-sm"
                  >
                    {confirming === post.id ? "処理中..." : "✓ 投稿する"}
                  </button>
                  <button
                    onClick={() => rejectPost(post.id)}
                    className="btn-secondary text-sm"
                  >
                    下書きに戻す
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 直近の投稿 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">直近の投稿</h3>
          <Link href="/posts" className="text-sm text-brand-600 hover:underline">
            すべて見る →
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 font-medium">投稿がまだありません</p>
            <p className="text-gray-400 text-sm mt-1">最初の投稿を作成してみましょう</p>
            <Link href="/posts/new" className="btn-primary inline-block mt-4 text-sm">
              投稿を作成する
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {posts.slice(0, 8).map((post) => (
              <div key={post.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={post.status as PostStatus} />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {post.title ?? post.caption.slice(0, 40)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {post.platform} ·{" "}
                    {post.scheduledAt
                      ? `予定: ${format(new Date(post.scheduledAt), "M/d HH:mm")}`
                      : `作成: ${format(new Date(post.createdAt), "M/d HH:mm")}`}
                  </p>
                </div>
                <Link
                  href={`/posts/${post.id}/edit`}
                  className="text-xs text-gray-400 hover:text-brand-600 shrink-0 transition-colors"
                >
                  編集
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
