"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import type { Post, PostStatus } from "@/types";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
} from "date-fns";
import { ja } from "date-fns/locale";

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<Post[]>([]);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[fetchPosts]", e);
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  // 月の最初の日の曜日オフセット（0=日曜）
  const startOffset = getDay(startOfMonth(currentMonth));

  const getPostsForDay = (day: Date) =>
    posts.filter(
      (p) =>
        (p.scheduledAt && isSameDay(new Date(p.scheduledAt), day)) ||
        (p.postedAt && isSameDay(new Date(p.postedAt), day))
    );

  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">投稿カレンダー</h2>
        <Link href="/posts/new" className="btn-primary">
          + 新規投稿作成
        </Link>
      </div>

      <div className="card">
        {/* カレンダーヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ←
          </button>
          <h3 className="text-lg font-semibold">
            {format(currentMonth, "yyyy年M月", { locale: ja })}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            →
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-medium py-2 ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* カレンダーグリッド */}
        <div className="grid grid-cols-7 gap-1">
          {/* 空白セル */}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24" />
          ))}

          {/* 日付セル */}
          {days.map((day) => {
            const dayPosts = getPostsForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`h-24 border rounded-lg p-1.5 overflow-hidden ${
                  isToday
                    ? "border-brand-400 bg-brand-50"
                    : "border-gray-100 hover:border-gray-200"
                }`}
              >
                <p
                  className={`text-xs font-medium mb-1 ${
                    isToday ? "text-brand-600" : "text-gray-500"
                  }`}
                >
                  {format(day, "d")}
                </p>
                <div className="space-y-0.5 overflow-hidden">
                  {dayPosts.slice(0, 3).map((post) => (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}/edit`}
                      className="block truncate text-xs bg-white border border-gray-100 rounded px-1 py-0.5 hover:border-brand-300 transition-colors"
                    >
                      <span className="mr-1">
                        {post.status === "POSTED"
                          ? "✅"
                          : post.status === "PENDING_CONFIRMATION"
                          ? "⏳"
                          : post.status === "FAILED"
                          ? "❌"
                          : "📅"}
                      </span>
                      {post.title ?? post.caption.slice(0, 10)}
                    </Link>
                  ))}
                  {dayPosts.length > 3 && (
                    <p className="text-xs text-gray-400 pl-1">
                      +{dayPosts.length - 3}件
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span>✅ 投稿済み</span>
        <span>⏳ 確認待ち</span>
        <span>📅 予約済み</span>
        <span>❌ 失敗</span>
      </div>
    </div>
  );
}
