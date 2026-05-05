"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GeneratedContent } from "@/types";

const PLATFORM_OPTIONS = [
  { value: "X",         label: "X (Twitter)" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "BOTH",      label: "両方" },
];

const MEDIA_ICONS: Record<string, string> = {
  IMAGE: "🖼️",
  VIDEO: "🎬",
  MIXED: "🔀",
};

interface QueueNewFormProps {
  contentId?: string;
}

export function QueueNewForm({ contentId }: QueueNewFormProps) {
  const router = useRouter();

  const [content,     setContent]     = useState<GeneratedContent | null>(null);
  const [loading,     setLoading]     = useState(!!contentId);
  const [platform,    setPlatform]    = useState("X");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!contentId) return;
    fetch(`/api/content/${contentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setContent(data);
        setLoading(false);
      });
  }, [contentId]);

  const handleSubmit = async () => {
    if (!contentId) {
      setError("コンテンツIDが指定されていません。コンテンツ一覧から追加してください。");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/queue", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        generatedContentId: contentId,
        platform,
        scheduledAt: scheduledAt || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "エラーが発生しました");
      setSubmitting(false);
      return;
    }

    router.push("/queue");
    router.refresh();
  };

  if (!contentId) {
    return (
      <div className="max-w-xl card text-center py-10 space-y-3">
        <p className="text-gray-500">コンテンツが指定されていません</p>
        <a href="/content" className="btn-primary inline-block text-sm">
          コンテンツ一覧へ
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-gray-400 py-12 text-center">読み込み中...</div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-xl card text-center py-10 space-y-3">
        <p className="text-red-500">コンテンツが見つかりません</p>
        <a href="/content" className="btn-secondary inline-block text-sm">
          コンテンツ一覧へ
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">投稿キューに追加</h2>
        <p className="text-sm text-gray-500 mt-1">
          プラットフォームと投稿予定日時を設定してキューに登録します
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── コンテンツ確認 ── */}
      <div className="card space-y-2 bg-gray-50">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          対象コンテンツ
        </p>
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">
            {MEDIA_ICONS[content.mediaType] ?? "📁"}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">
              {content.title ?? (
                <span className="text-gray-400 font-normal">タイトルなし</span>
              )}
            </p>
            {content.caption && (
              <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                {content.caption}
              </p>
            )}
            {content.hashtags && (
              <p className="text-xs text-gray-400 mt-1">{content.hashtags}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              ステータス:{" "}
              <span className="font-medium text-gray-600">{content.status}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── キュー設定 ── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">キュー設定</h3>

        <div>
          <label className="label">投稿プラットフォーム</label>
          <select
            className="input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {PLATFORM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">
            投稿予定日時{" "}
            <span className="text-gray-400 font-normal">（任意）</span>
          </label>
          <input
            type="datetime-local"
            className="input"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
          <p className="text-xs text-gray-400 mt-1">
            空欄の場合はすぐに「待機中」としてキューに追加されます
          </p>
        </div>
      </div>

      {/* ── 送信ボタン ── */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? "追加中..." : "キューに追加する"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
