"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GeneratedContent, ContentStatus, PromptOptimizeResult } from "@/types";

const MEDIA_TYPE_OPTIONS = [
  { value: "IMAGE", label: "画像" },
  { value: "VIDEO", label: "動画" },
  { value: "MIXED", label: "画像+動画" },
];

const STATUS_OPTIONS: { value: ContentStatus; label: string }[] = [
  { value: "draft",     label: "下書き" },
  { value: "ready",     label: "準備完了" },
  { value: "scheduled", label: "予約済み" },
  { value: "posted",    label: "投稿済み" },
];

interface ContentFormProps {
  initial?: Partial<GeneratedContent>;
  mode: "create" | "edit";
  initialPrompt?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
        copied
          ? "bg-green-50 border-green-300 text-green-700"
          : "bg-white border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600"
      }`}
    >
      {copied ? "✓ コピー済み" : "コピー"}
    </button>
  );
}

// ─── 最適プロンプト結果パネル ──────────────────────────────────────────────────

function OptimizeResultPanel({
  result,
  onApply,
}: {
  result: PromptOptimizeResult;
  onApply: (r: PromptOptimizeResult) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-brand-300 bg-brand-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-700">🤖 最適プロンプト生成結果</p>
        <button
          type="button"
          onClick={() => onApply(result)}
          className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors font-medium"
        >
          フォームに適用する
        </button>
      </div>

      {/* reason */}
      <p className="text-xs text-brand-600 bg-white rounded-lg px-3 py-2 border border-brand-200">
        💡 {result.reason}
      </p>

      {/* optimizedPrompt */}
      {result.optimizedPrompt && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">最適化プロンプト</p>
            <CopyButton text={result.optimizedPrompt} />
          </div>
          <pre className="text-xs text-gray-700 bg-white rounded-lg p-3 border border-gray-200 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono leading-relaxed">
            {result.optimizedPrompt}
          </pre>
        </div>
      )}

      {/* tags */}
      {result.recommendedTags.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">推薦ハッシュタグ</p>
            <CopyButton text={result.recommendedTags.join(" ")} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.recommendedTags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-white border border-brand-200 text-brand-700 font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* mediaType */}
      <p className="text-xs text-gray-600">
        推奨メディア種別：
        <span className="font-semibold ml-1 text-gray-800">{result.recommendedMediaType}</span>
        　分析対象：<span className="font-semibold">{result.basedOnCount}</span> 件（ER上位20%）
      </p>
    </div>
  );
}

// ─── メインフォーム ────────────────────────────────────────────────────────────

export function ContentForm({ initial, mode, initialPrompt }: ContentFormProps) {
  const router = useRouter();

  const [title,     setTitle]     = useState(initial?.title     ?? "");
  const [prompt,    setPrompt]    = useState(initial?.prompt    ?? initialPrompt ?? "");
  const [caption,   setCaption]   = useState(initial?.caption   ?? "");
  const [hashtags,  setHashtags]  = useState(initial?.hashtags  ?? "");
  const [mediaType, setMediaType] = useState(initial?.mediaType ?? "IMAGE");
  const [mediaUrl,  setMediaUrl]  = useState(initial?.mediaUrl  ?? "");
  const [status,    setStatus]    = useState<ContentStatus>(
    (initial?.status as ContentStatus) ?? "draft"
  );

  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [optimizing,      setOptimizing]      = useState(false);
  const [optimizeResult,  setOptimizeResult]  = useState<PromptOptimizeResult | null>(null);
  const [optimizeError,   setOptimizeError]   = useState<string | null>(null);

  // ── 最適プロンプト生成 ──────────────────────────────────────────────────────
  const handleOptimize = async () => {
    setOptimizing(true);
    setOptimizeError(null);
    setOptimizeResult(null);
    try {
      const res = await fetch("/api/prompt/optimize");
      if (!res.ok) throw new Error("APIエラー");
      const data: PromptOptimizeResult = await res.json();
      setOptimizeResult(data);
    } catch {
      setOptimizeError("最適化プロンプトの取得に失敗しました");
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyOptimize = (r: PromptOptimizeResult) => {
    if (r.optimizedPrompt) setPrompt(r.optimizedPrompt);
    if (r.recommendedTags.length > 0) setHashtags(r.recommendedTags.join(" "));
    if (r.recommendedMediaType) setMediaType(r.recommendedMediaType);
  };

  // ── 保存 ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (targetStatus?: ContentStatus) => {
    if (!title.trim() && !prompt.trim() && !caption.trim()) {
      setError("タイトル、プロンプト、キャプションのいずれかを入力してください");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      title:                 title     || null,
      prompt:                prompt    || null,
      caption:               caption   || null,
      hashtags:              hashtags  || null,
      mediaType,
      mediaUrl:              mediaUrl  || null,
      status:                targetStatus ?? status,
      sourceBenchmarkPostId: initial?.sourceBenchmarkPostId ?? null,
    };

    try {
      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/content/${initial!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "エラーが発生しました");
        return;
      }

      router.push("/content");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── 最適プロンプト生成パネル ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">AI プロンプト最適化</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              過去の実績データ（ER上位20%）をもとにプロンプトを自動生成します
            </p>
          </div>
          <button
            type="button"
            onClick={handleOptimize}
            disabled={optimizing}
            className="text-sm px-4 py-2 rounded-lg bg-brand-50 border border-brand-300 text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition-colors font-medium whitespace-nowrap"
          >
            {optimizing ? "生成中..." : "✨ 最適プロンプトを生成"}
          </button>
        </div>

        {optimizeError && (
          <p className="text-sm text-red-600">{optimizeError}</p>
        )}

        {optimizeResult && (
          <OptimizeResultPanel
            result={optimizeResult}
            onApply={handleApplyOptimize}
          />
        )}
      </div>

      {/* ── 基本情報 ── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">基本情報</h3>

        <div>
          <label className="label">タイトル（管理用・任意）</label>
          <input
            type="text"
            className="input"
            placeholder="例: 夏コーデ 構図パターンA"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">メディア種別</label>
            <select
              className="input"
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
            >
              {MEDIA_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">ステータス</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {initial?.sourceBenchmarkPostId && (
          <div>
            <label className="label">参照ベンチマーク投稿ID</label>
            <p className="text-sm text-gray-500 font-mono bg-gray-50 rounded px-3 py-2 break-all">
              {initial.sourceBenchmarkPostId}
            </p>
          </div>
        )}
      </div>

      {/* ── 生成AIプロンプト ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">生成AIプロンプト</h3>
          {prompt && <CopyButton text={prompt} />}
        </div>
        <div>
          <label className="label">プロンプト本文</label>
          <textarea
            className="input min-h-[160px] resize-y font-mono text-sm leading-relaxed"
            placeholder={"# AIキャラクター投稿 生成プロンプト案\n\n## キャラクター・表情\n...\n\n## 構図・背景\n..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            推薦機能から生成されたプロンプトをそのまま貼り付けて使用できます
          </p>
        </div>
      </div>

      {/* ── 投稿コンテンツ ── */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">投稿コンテンツ</h3>

        <div>
          <label className="label">
            キャプション本文{" "}
            <span className="text-gray-400 font-normal">
              （{caption.length}文字）
            </span>
          </label>
          <textarea
            className="input min-h-[120px] resize-y"
            placeholder="投稿に使うキャプションテキスト..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        <div>
          <label className="label">ハッシュタグ</label>
          <input
            type="text"
            className="input"
            placeholder="#AIイラスト #AI美女 #fashion"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
          />
        </div>

        <div>
          <label className="label">メディアURL（生成済み画像・動画のURL）</label>
          <input
            type="text"
            className="input"
            placeholder="https://..."
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            画像生成AIで出力したファイルのURLまたはパスを入力してください
          </p>
        </div>
      </div>

      {/* ── 送信ボタン ── */}
      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? "保存中..." : mode === "create" ? "作成する" : "保存する"}
        </button>
        {mode === "create" && (
          <button
            type="button"
            onClick={() => handleSubmit("draft")}
            disabled={submitting}
            className="btn-secondary"
          >
            下書きとして保存
          </button>
        )}
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
