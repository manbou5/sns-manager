"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PerformanceMetricWithQueue } from "@/types";

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function calcER(v: number, l: number, c: number, s: number, sa: number): number {
  if (v <= 0) return 0;
  return (l + c + s + sa) / v * 100;
}

const MEDIA_ICONS: Record<string, string> = {
  IMAGE: "🖼️",
  VIDEO: "🎬",
  MIXED: "🔀",
};

// キュー情報（create モード時に API から取得）
interface QueueSnapshot {
  id: string;
  platform: string;
  updatedAt: string;
  generatedContent: { title?: string | null; caption?: string | null; mediaType: string };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PerformanceFormProps {
  mode: "create" | "edit";
  queueId?: string;                       // create モード時に使用
  initial?: PerformanceMetricWithQueue;   // edit モード時に使用
}

// ─── コンポーネント ────────────────────────────────────────────────────────────

export function PerformanceForm({ mode, queueId, initial }: PerformanceFormProps) {
  const router = useRouter();

  const [queueInfo, setQueueInfo] = useState<QueueSnapshot | null>(
    initial
      ? {
          id:               initial.postQueue.id,
          platform:         initial.postQueue.platform,
          updatedAt:        initial.postQueue.updatedAt,
          generatedContent: initial.postQueue.generatedContent,
        }
      : null
  );
  const [loadingQueue, setLoadingQueue] = useState(mode === "create" && !!queueId);
  const [notFound,     setNotFound]     = useState(false);

  const [views,           setViews]           = useState(initial?.views           ?? 0);
  const [likes,           setLikes]           = useState(initial?.likes           ?? 0);
  const [comments,        setComments]        = useState(initial?.comments        ?? 0);
  const [shares,          setShares]          = useState(initial?.shares          ?? 0);
  const [saves,           setSaves]           = useState(initial?.saves           ?? 0);
  const [followersGained, setFollowersGained] = useState(initial?.followersGained ?? 0);
  const [measuredAt,      setMeasuredAt]      = useState(
    initial?.measuredAt
      ? new Date(initial.measuredAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const erPreview = calcER(views, likes, comments, shares, saves);

  // create モード: キュー情報を取得
  useEffect(() => {
    if (mode !== "create" || !queueId) return;
    fetch(`/api/queue/${queueId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setNotFound(true); }
        else {
          setQueueInfo({
            id:               data.id,
            platform:         data.platform,
            updatedAt:        data.updatedAt,
            generatedContent: data.generatedContent,
          });
        }
        setLoadingQueue(false);
      });
  }, [mode, queueId]);

  const handleSubmit = async () => {
    if (mode === "create" && !queueId) {
      setError("キューIDが指定されていません");
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload = {
      ...(mode === "create" ? { postQueueId: queueId } : {}),
      views,
      likes,
      comments,
      shares,
      saves,
      followersGained,
      measuredAt,
    };

    try {
      const url    = mode === "create" ? "/api/performance" : `/api/performance/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      router.push("/performance");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  // ── ガード ──────────────────────────────────────────────────────────────────

  if (mode === "create" && !queueId) {
    return (
      <div className="card max-w-xl text-center py-10 space-y-3">
        <p className="text-gray-500">キューIDが指定されていません</p>
        <a href="/queue" className="btn-secondary inline-block text-sm">投稿キューへ</a>
      </div>
    );
  }
  if (loadingQueue) {
    return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  }
  if (notFound) {
    return (
      <div className="card max-w-xl text-center py-10 space-y-3">
        <p className="text-red-500">指定されたキューが見つかりません</p>
        <a href="/queue" className="btn-secondary inline-block text-sm">投稿キューへ</a>
      </div>
    );
  }

  // ── フォーム本体 ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 対象投稿の確認 */}
      {queueInfo && (
        <div className="card bg-gray-50 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            対象投稿
          </p>
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">
              {MEDIA_ICONS[queueInfo.generatedContent.mediaType] ?? "📁"}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {queueInfo.generatedContent.title ?? (
                  <span className="font-normal text-gray-400">タイトルなし</span>
                )}
              </p>
              {queueInfo.generatedContent.caption && (
                <p className="text-sm text-gray-600 mt-0.5 truncate">
                  {queueInfo.generatedContent.caption}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                プラットフォーム:{" "}
                <span className="font-medium text-gray-600">{queueInfo.platform}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 実績数値入力 */}
      <div className="card space-y-5">
        <h3 className="font-semibold text-gray-900">実績数値</h3>

        <div>
          <label className="label">再生数 / インプレッション</label>
          <input
            type="number" min="0" className="input"
            value={views}
            onChange={(e) => setViews(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">いいね数</label>
            <input
              type="number" min="0" className="input"
              value={likes}
              onChange={(e) => setLikes(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="label">コメント数</label>
            <input
              type="number" min="0" className="input"
              value={comments}
              onChange={(e) => setComments(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="label">シェア / RT 数</label>
            <input
              type="number" min="0" className="input"
              value={shares}
              onChange={(e) => setShares(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div>
            <label className="label">保存数</label>
            <input
              type="number" min="0" className="input"
              value={saves}
              onChange={(e) => setSaves(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
        </div>

        <div>
          <label className="label">フォロワー増加数</label>
          <input
            type="number" className="input"
            value={followersGained}
            onChange={(e) => setFollowersGained(parseInt(e.target.value) || 0)}
          />
          <p className="text-xs text-gray-400 mt-1">マイナス値も入力可（フォロワー減少時）</p>
        </div>

        {/* ER プレビュー */}
        <div className={`rounded-lg px-4 py-3 flex items-center justify-between border ${
          erPreview >= 5
            ? "bg-green-50 border-green-200"
            : erPreview >= 2
            ? "bg-yellow-50 border-yellow-200"
            : "bg-brand-50 border-brand-200"
        }`}>
          <div>
            <p className={`text-sm font-medium ${
              erPreview >= 5 ? "text-green-800" : erPreview >= 2 ? "text-yellow-800" : "text-brand-800"
            }`}>
              エンゲージメント率（自動計算）
            </p>
            <p className={`text-xs mt-0.5 ${
              erPreview >= 5 ? "text-green-600" : erPreview >= 2 ? "text-yellow-600" : "text-brand-600"
            }`}>
              (いいね + コメント + シェア + 保存) ÷ 再生数 × 100
            </p>
          </div>
          <p className={`text-2xl font-bold ${
            erPreview >= 5 ? "text-green-700" : erPreview >= 2 ? "text-yellow-700" : "text-brand-700"
          }`}>
            {erPreview.toFixed(2)}%
          </p>
        </div>

        <div>
          <label className="label">計測日時</label>
          <input
            type="datetime-local" className="input"
            value={measuredAt}
            onChange={(e) => setMeasuredAt(e.target.value)}
          />
        </div>
      </div>

      {/* 送信ボタン */}
      <div className="flex gap-3">
        <button
          type="button" onClick={handleSubmit} disabled={submitting}
          className="btn-primary"
        >
          {submitting ? "保存中..." : mode === "create" ? "実績を登録する" : "保存する"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          キャンセル
        </button>
      </div>
    </div>
  );
}
