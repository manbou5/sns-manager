"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GROWTH_REASON_TAGS } from "@/types";
import type { BenchmarkPost, MediaType } from "@/types";
import { encodeTags, decodeTags } from "@/lib/benchmarkCsv";

interface Props {
  initial?: Partial<BenchmarkPost>;
  mode: "create" | "edit";
}

const MEDIA_TYPE_OPTIONS: { value: MediaType; label: string; icon: string }[] = [
  { value: "IMAGE", label: "画像",        icon: "🖼️" },
  { value: "VIDEO", label: "動画",        icon: "🎬" },
  { value: "MIXED", label: "画像+動画",   icon: "🔀" },
];

function toInputDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try {
    return new Date(isoStr).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

export function BenchmarkForm({ initial, mode }: Props) {
  const router = useRouter();

  const [accountName,      setAccountName]      = useState(initial?.accountName      ?? "");
  const [postUrl,          setPostUrl]           = useState(initial?.postUrl          ?? "");
  const [postedAt,         setPostedAt]          = useState(toInputDate(initial?.postedAt));
  const [bodyText,         setBodyText]          = useState(initial?.bodyText         ?? "");
  const [mediaType,        setMediaType]         = useState<MediaType>((initial?.mediaType as MediaType) ?? "IMAGE");
  const [videoDuration,    setVideoDuration]     = useState(initial?.videoDuration    ?? "");
  const [compositionNote,  setCompositionNote]   = useState(initial?.compositionNote  ?? "");
  const [characterNote,    setCharacterNote]     = useState(initial?.characterNote    ?? "");
  const [aiReductionNote,  setAiReductionNote]   = useState(initial?.aiReductionNote  ?? "");
  const [likes,            setLikes]             = useState(String(initial?.likes    ?? ""));
  const [reposts,          setReposts]           = useState(String(initial?.reposts  ?? ""));
  const [replies,          setReplies]           = useState(String(initial?.replies  ?? ""));
  const [views,            setViews]             = useState(String(initial?.views    ?? ""));
  const [growthReasonNote, setGrowthReasonNote]  = useState(initial?.growthReasonNote ?? "");
  const [selectedTags,     setSelectedTags]      = useState<string[]>(
    decodeTags(initial?.growthReasonTags)
  );
  const [applicationNote,  setApplicationNote]   = useState(initial?.applicationNote  ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!accountName.trim()) {
      setError("アカウント名は必須です");
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload = {
      accountName:     accountName.trim(),
      postUrl:         postUrl.trim()        || null,
      postedAt:        postedAt ? new Date(postedAt).toISOString() : null,
      bodyText:        bodyText.trim()       || null,
      mediaType,
      videoDuration:   videoDuration.trim()  || null,
      compositionNote: compositionNote.trim()  || null,
      characterNote:   characterNote.trim()    || null,
      aiReductionNote: aiReductionNote.trim()  || null,
      likes:    Number(likes)   || 0,
      reposts:  Number(reposts) || 0,
      replies:  Number(replies) || 0,
      views:    Number(views)   || 0,
      growthReasonNote: growthReasonNote.trim() || null,
      growthReasonTags: encodeTags(selectedTags),
      applicationNote:  applicationNote.trim()  || null,
    };

    try {
      const url  = mode === "create" ? "/api/benchmark" : `/api/benchmark/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      router.push("/benchmark");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  // テキストエリアの共通スタイル
  const ta = "input min-h-[80px] resize-y text-sm";

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── 基本情報 ── */}
      <section className="card space-y-4">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">
          基本情報
        </h3>

        <div>
          <label className="label">
            アカウント名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="input"
            placeholder="例: @ai_hiyo_"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>

        <div>
          <label className="label">投稿URL</label>
          <input
            type="url"
            className="input"
            placeholder="https://x.com/username/status/..."
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">投稿日時</label>
            <input
              type="datetime-local"
              className="input"
              value={postedAt}
              onChange={(e) => setPostedAt(e.target.value)}
            />
          </div>
          <div>
            <label className="label">メディア種別</label>
            <div className="flex gap-2 mt-1">
              {MEDIA_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMediaType(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    mediaType === opt.value
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(mediaType === "VIDEO" || mediaType === "MIXED") && (
          <div>
            <label className="label">動画尺</label>
            <input
              type="text"
              className="input"
              placeholder="例: 6秒 / 00:08"
              value={videoDuration}
              onChange={(e) => setVideoDuration(e.target.value)}
            />
          </div>
        )}
      </section>

      {/* ── 投稿内容 ── */}
      <section className="card space-y-4">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">
          投稿内容
        </h3>
        <div>
          <label className="label">投稿本文</label>
          <textarea
            className={ta}
            placeholder="参考アカウントの投稿テキストをそのまま貼り付け..."
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
        </div>
      </section>

      {/* ── 制作観察メモ ── */}
      <section className="card space-y-4">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">
          制作観察メモ
        </h3>
        <div>
          <label className="label">構図・カメラワーク</label>
          <textarea
            className={ta}
            placeholder="例: 縦パン→顔アップ、3秒で切り替え..."
            value={compositionNote}
            onChange={(e) => setCompositionNote(e.target.value)}
          />
        </div>
        <div>
          <label className="label">顔・表情・服装・背景</label>
          <textarea
            className={ta}
            placeholder="例: ショートヘア・白ワンピ・青空背景・笑顔..."
            value={characterNote}
            onChange={(e) => setCharacterNote(e.target.value)}
          />
        </div>
        <div>
          <label className="label">AI感を減らす工夫</label>
          <textarea
            className={ta}
            placeholder="例: 髪の毛の細かいハイライト、テクスチャの追加..."
            value={aiReductionNote}
            onChange={(e) => setAiReductionNote(e.target.value)}
          />
        </div>
      </section>

      {/* ── エンゲージメント数値 ── */}
      <section className="card space-y-4">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">
          エンゲージメント数値
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            { key: "likes",   label: "❤️ いいね数",   setter: setLikes,   val: likes   },
            { key: "reposts", label: "🔁 リポスト数", setter: setReposts, val: reposts },
            { key: "replies", label: "💬 返信数",      setter: setReplies, val: replies },
            { key: "views",   label: "👁 表示数",      setter: setViews,   val: views   },
          ] as const).map(({ key, label, setter, val }) => (
            <div key={key}>
              <label className="label text-xs">{label}</label>
              <input
                type="number"
                min="0"
                className="input"
                value={val}
                onChange={(e) => setter(e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── 分析メモ ── */}
      <section className="card space-y-4">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">
          分析メモ
        </h3>

        <div>
          <label className="label">伸びた理由タグ（複数選択可）</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {GROWTH_REASON_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          {selectedTags.length > 0 && (
            <p className="text-xs text-brand-600 mt-1">
              選択中: {selectedTags.join("、")}
            </p>
          )}
        </div>

        <div>
          <label className="label">伸びた理由メモ（自由記述）</label>
          <textarea
            className={ta}
            placeholder="例: 顔のアップが効果的で、投稿時間も夜8時と最適だった..."
            value={growthReasonNote}
            onChange={(e) => setGrowthReasonNote(e.target.value)}
          />
        </div>

        <div>
          <label className="label">自分の投稿への応用案</label>
          <textarea
            className={ta}
            placeholder="例: 同じ構図で夕方バージョンを試す。キャプションは問いかけ型に..."
            value={applicationNote}
            onChange={(e) => setApplicationNote(e.target.value)}
          />
        </div>
      </section>

      {/* ── 送信ボタン ── */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? "保存中..." : mode === "create" ? "登録する" : "更新する"}
        </button>
        <button onClick={() => router.back()} className="btn-secondary">
          キャンセル
        </button>
      </div>
    </div>
  );
}
