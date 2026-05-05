"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
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

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<Stats>({
    draft: 0,
    scheduled: 0,
    pending: 0,
    posted: 0,
    failed: 0,
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

  // スケジューラーチェック（失敗してもページ表示には影響させない）
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

    // 1分ごとにスケジューラーを実行
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
        console.error("[confirmPost]", res.status);
        return;
      }
      const data = await res.json();

      if (res.status === 409 && data.requiresForce) {
        const ok = confirm(
          `⚠️ ${data.warning.message}\n\nそれでも投稿しますか？`
        );
        if (ok) await confirmPost(postId, true);
      } else {
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
    fetchPosts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        読み込み中...
      </div>
    );
  }

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

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="text-gray-500 text-sm mt-1">
          {format(new Date(), "yyyy年M月d日 (EEEE)", { locale: ja })}
        </p>
      </div>

      {/* ステータス統計 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "下書き", count: stats.draft, color: "text-gray-600", bg: "bg-gray-50" },
          { label: "予約済み", count: stats.scheduled, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "確認待ち", count: stats.pending, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "投稿済み", count: stats.posted, color: "text-green-600", bg: "bg-green-50" },
          { label: "失敗", count: stats.failed, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`card ${bg} border-0`}>
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-3xl font-bold ${color} mt-1`}>{count}</p>
          </div>
        ))}
      </div>

      {/* 確認待ち投稿キュー */}
      {pendingPosts.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50">
          <h3 className="font-semibold text-yellow-800 mb-4">
            ⏳ 確認待ち投稿 ({pendingPosts.length}件)
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
                    予定: {post.scheduledAt
                      ? format(new Date(post.scheduledAt), "M/d HH:mm")
                      : "—"}
                    　プラットフォーム: {post.platform}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
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
          <div className="text-center py-8 text-gray-400">
            <p>投稿がまだありません</p>
            <Link href="/posts/new" className="btn-primary inline-block mt-4 text-sm">
              最初の投稿を作成する
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {posts.slice(0, 8).map((post) => (
              <div key={post.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
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
                  className="text-xs text-gray-400 hover:text-brand-600 shrink-0"
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
