"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import type { Post, PostStatus } from "@/types";
import { format } from "date-fns";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "すべて" },
  { value: "DRAFT", label: "下書き" },
  { value: "SCHEDULED", label: "予約済み" },
  { value: "PENDING_CONFIRMATION", label: "確認待ち" },
  { value: "POSTED", label: "投稿済み" },
  { value: "FAILED", label: "失敗" },
];

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus ? `/api/posts?status=${filterStatus}` : "/api/posts";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[fetchPosts]", e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const deletePost = async (id: string) => {
    if (!confirm("この投稿を削除しますか？")) return;
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    fetchPosts();
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">投稿一覧</h2>
        <Link href="/posts/new" className="btn-primary">
          + 新規投稿作成
        </Link>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
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

      {loading ? (
        <div className="card text-center text-gray-400 py-12">読み込み中...</div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400">投稿が見つかりません</p>
          <Link href="/posts/new" className="btn-primary inline-block mt-4">
            投稿を作成する
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">投稿</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">ステータス</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">プラットフォーム</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">予定日時</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 truncate max-w-xs">
                      {post.title ?? "タイトルなし"}
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate max-w-xs">
                      {post.caption}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={post.status as PostStatus} />
                  </td>
                  <td className="px-4 py-4 text-gray-600">{post.platform}</td>
                  <td className="px-4 py-4 text-gray-600">
                    {post.scheduledAt
                      ? format(new Date(post.scheduledAt), "M/d HH:mm")
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-3 justify-end">
                      <Link
                        href={`/posts/${post.id}/edit`}
                        className="text-brand-600 hover:underline"
                      >
                        編集
                      </Link>
                      {post.status !== "POSTED" && (
                        <button
                          onClick={() => deletePost(post.id)}
                          className="text-red-500 hover:underline"
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
