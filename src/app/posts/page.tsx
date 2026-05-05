"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import type { Post, PostStatus } from "@/types";
import { format } from "date-fns";

// ─── 型 ─────────────────────────────────────────────────────────────────────

type SortField = "title" | "status" | "platform" | "scheduledAt" | "createdAt";
type SortDir   = "asc" | "desc";

const STATUS_OPTIONS = [
  { value: "",                       label: "すべて" },
  { value: "DRAFT",                  label: "下書き" },
  { value: "SCHEDULED",             label: "予約済み" },
  { value: "PENDING_CONFIRMATION",   label: "確認待ち" },
  { value: "POSTED",                 label: "投稿済み" },
  { value: "FAILED",                 label: "失敗" },
];

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="card p-0 overflow-hidden animate-pulse">
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex gap-6">
        {[120, 80, 60, 80].map((w, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: w }} />
        ))}
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-50">
          <div className="flex-1 space-y-1.5">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
          <div className="h-4 w-14 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-8 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Sort header ─────────────────────────────────────────────────────────────

function SortTh({
  label,
  field,
  sortField,
  sortDir,
  onSort,
  className = "text-left px-4 py-3 text-gray-500 font-medium",
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = field === sortField;
  return (
    <th className={className}>
      <button onClick={() => onSort(field)} className="th-sort group">
        {label}
        <span
          className={`text-xs transition-colors ${
            active ? "text-brand-500" : "text-gray-300 group-hover:text-gray-400"
          }`}
        >
          {active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
        </span>
      </button>
    </th>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PostsPage() {
  const { toast } = useToast();
  const [posts,        setPosts]        = useState<Post[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading,      setLoading]      = useState(true);
  const [sortField,    setSortField]    = useState<SortField>("createdAt");
  const [sortDir,      setSortDir]      = useState<SortDir>("desc");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
      toast("投稿一覧の取得に失敗しました", "error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, toast]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const onSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      let va = "";
      let vb = "";
      switch (sortField) {
        case "title":       va = a.title ?? ""; vb = b.title ?? ""; break;
        case "status":      va = a.status;       vb = b.status;       break;
        case "platform":    va = a.platform;     vb = b.platform;     break;
        case "scheduledAt": va = a.scheduledAt ?? ""; vb = b.scheduledAt ?? ""; break;
        case "createdAt":   va = a.createdAt;    vb = b.createdAt;    break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [posts, sortField, sortDir]);

  const deletePost = async (id: string) => {
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast("投稿を削除しました", "success");
      fetchPosts();
    } catch {
      toast("削除に失敗しました", "error");
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">投稿一覧</h2>
        <Link href="/posts/new" className="btn-primary text-sm">
          + 新規投稿作成
        </Link>
      </div>

      {/* ステータスフィルター */}
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

      {/* テーブル */}
      {loading ? (
        <TableSkeleton />
      ) : sortedPosts.length === 0 ? (
        <div className="card text-center py-14">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-600 font-medium">
            {filterStatus
              ? `「${STATUS_OPTIONS.find((o) => o.value === filterStatus)?.label}」の投稿がありません`
              : "投稿がまだありません"}
          </p>
          <p className="text-gray-400 text-sm mt-1">新規投稿を作成してみましょう</p>
          <Link href="/posts/new" className="btn-primary inline-block mt-5 text-sm">
            投稿を作成する
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <SortTh
                    label="投稿"
                    field="title"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={onSort}
                    className="text-left px-6 py-3 text-gray-500 font-medium"
                  />
                  <SortTh label="ステータス" field="status"     sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <SortTh label="PF"         field="platform"   sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <SortTh label="予定日時"   field="scheduledAt" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <SortTh label="作成日"     field="createdAt"  sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedPosts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 max-w-xs">
                      <p className="font-medium text-gray-900 truncate">
                        {post.title ?? (
                          <span className="text-gray-400 font-normal">タイトルなし</span>
                        )}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5 truncate">{post.caption}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <StatusBadge status={post.status as PostStatus} />
                    </td>
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{post.platform}</td>
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                      {post.scheduledAt
                        ? format(new Date(post.scheduledAt), "M/d HH:mm")
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-gray-400 text-xs whitespace-nowrap">
                      {format(new Date(post.createdAt), "M/d")}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-3 justify-end items-center">
                        <Link
                          href={`/posts/${post.id}/edit`}
                          className="text-brand-600 hover:underline text-xs"
                        >
                          編集
                        </Link>
                        {post.status !== "POSTED" && (
                          confirmDeleteId === post.id ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={() => deletePost(post.id)}
                                className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                              >
                                確認
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(post.id)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors"
                            >
                              削除
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {sortedPosts.length} 件
          </div>
        </div>
      )}
    </div>
  );
}
