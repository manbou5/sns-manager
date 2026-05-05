"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SafetyWarning } from "@/components/SafetyWarning";
import { checkSafety } from "@/lib/safety";
import type {
  Post,
  Genre,
  Platform,
  SafetyCheckResult,
  CaptionSuggestion,
} from "@/types";

interface PostFormProps {
  initial?: Partial<Post>;
  mode: "create" | "edit";
}

const GENRE_OPTIONS: { value: Genre; label: string }[] = [
  { value: "FASHION", label: "ファッション" },
  { value: "LIFESTYLE", label: "ライフスタイル" },
  { value: "PORTRAIT", label: "ポートレート" },
  { value: "GRAVURE_STYLE", label: "グラビア風" },
  { value: "OTHER", label: "その他" },
];

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "X", label: "X (Twitter)" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "BOTH", label: "両方" },
];

export function PostForm({ initial, mode }: PostFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [mediaPath, setMediaPath] = useState(initial?.mediaPath ?? "");
  const [platform, setPlatform] = useState<Platform>(
    (initial?.platform as Platform) ?? "X"
  );
  const [genre, setGenre] = useState<Genre>(
    (initial?.genre as Genre) ?? "LIFESTYLE"
  );
  const [hashtags, setHashtags] = useState(initial?.hashtags ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt
      ? new Date(initial.scheduledAt).toISOString().slice(0, 16)
      : ""
  );

  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null);
  const [suggestions, setSuggestions] = useState<CaptionSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // リアルタイム安全チェック
  useEffect(() => {
    const fullText = `${caption} ${hashtags}`;
    if (fullText.trim()) {
      setSafetyResult(checkSafety(fullText));
    } else {
      setSafetyResult(null);
    }
  }, [caption, hashtags]);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre, platform }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch (e) {
      console.error("[fetchSuggestions]", e);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [genre, platform]);

  const applySuggestion = (s: CaptionSuggestion) => {
    setCaption(s.text);
    setHashtags(s.hashtags.join(" "));
  };

  const handleSubmit = async (asDraft = false) => {
    if (!caption.trim()) {
      setError("キャプションを入力してください");
      return;
    }
    if (safetyResult && !safetyResult.passed) {
      setError("安全チェックエラーを解消してから投稿してください");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      title: title || null,
      caption,
      mediaPath: mediaPath || null,
      platform,
      genre,
      hashtags: hashtags || null,
      scheduledAt: !asDraft && scheduledAt ? scheduledAt : null,
    };

    try {
      let res: Response;
      if (mode === "create") {
        res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/posts/${initial!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            status: asDraft ? "DRAFT" : payload.scheduledAt ? "SCHEDULED" : "DRAFT",
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "エラーが発生しました");
        return;
      }

      router.push("/posts");
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

      {/* 基本情報 */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">基本情報</h3>

        <div>
          <label className="label">タイトル（管理用・任意）</label>
          <input
            type="text"
            className="input"
            placeholder="例: 7/1 夏コーデ投稿"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label">プラットフォーム</label>
          <select
            className="input"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
          >
            {PLATFORM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">ジャンル</label>
          <select
            className="input"
            value={genre}
            onChange={(e) => setGenre(e.target.value as Genre)}
          >
            {GENRE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">メディアパス（画像・動画ファイルパス）</label>
          <input
            type="text"
            className="input"
            placeholder="例: C:\Users\...\image.jpg"
            value={mediaPath}
            onChange={(e) => setMediaPath(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            ローカルファイルのパスを入力してください（API連携後に自動アップロード）
          </p>
        </div>
      </div>

      {/* キャプション */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">キャプション</h3>
          <button
            onClick={fetchSuggestions}
            disabled={loadingSuggestions}
            className="btn-secondary text-sm"
          >
            {loadingSuggestions ? "生成中..." : "✨ AI提案を取得"}
          </button>
        </div>

        {/* キャプション提案 */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">クリックで適用:</p>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => applySuggestion(s)}
                className="w-full text-left bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg p-3 text-sm transition-colors"
              >
                <p className="font-medium text-brand-700 text-xs mb-1">
                  [{s.style}]
                </p>
                <p className="text-gray-700">{s.text}</p>
                <p className="text-gray-400 text-xs mt-1 truncate">
                  {s.hashtags.join(" ")}
                </p>
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="label">
            キャプション本文{" "}
            <span className="text-gray-400 font-normal">({caption.length}文字)</span>
          </label>
          <textarea
            className="input min-h-[120px] resize-y"
            placeholder="投稿テキストを入力..."
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

        <SafetyWarning result={safetyResult} />
      </div>

      {/* 予約投稿 */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">投稿スケジュール</h3>
        <div>
          <label className="label">投稿予定日時（空欄の場合は下書き保存）</label>
          <input
            type="datetime-local"
            className="input"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
          />
        </div>
      </div>

      {/* 送信ボタン */}
      <div className="flex gap-3">
        <button
          onClick={() => handleSubmit(false)}
          disabled={submitting || (safetyResult !== null && !safetyResult.passed)}
          className="btn-primary"
        >
          {submitting
            ? "保存中..."
            : scheduledAt
            ? "予約保存する"
            : "下書きとして保存"}
        </button>
        {mode === "edit" && (
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="btn-secondary"
          >
            下書きとして保存
          </button>
        )}
        <button
          onClick={() => router.back()}
          className="btn-secondary"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
