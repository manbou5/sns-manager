"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GROWTH_REASON_TAGS } from "@/types";
import type { BenchmarkPost, MediaType, VisionTagResult } from "@/types";
import { encodeTags, decodeTags, suggestTagsFromContent } from "@/lib/benchmarkCsv";
import dynamic from "next/dynamic";

const BenchmarkVisionTagger = dynamic(
  () => import("@/components/BenchmarkVisionTagger"),
  { ssr: false }
);

interface Props {
  initial?: Partial<BenchmarkPost>;
  mode: "create" | "edit";
}

const MEDIA_TYPE_OPTIONS: { value: MediaType; label: string; icon: string }[] = [
  { value: "IMAGE", label: "画像",      icon: "🖼️" },
  { value: "VIDEO", label: "動画",      icon: "🎬" },
  { value: "MIXED", label: "画像+動画", icon: "🔀" },
];

const PREDEFINED = GROWTH_REASON_TAGS as readonly string[];

function toInputDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  try { return new Date(isoStr).toISOString().slice(0, 16); } catch { return ""; }
}

export function BenchmarkForm({ initial, mode }: Props) {
  const router = useRouter();

  // ── 基本フィールド
  const [postUrl,       setPostUrl]       = useState(initial?.postUrl       ?? "");
  const [accountName,   setAccountName]   = useState(initial?.accountName   ?? "");
  const [postedAt,      setPostedAt]      = useState(toInputDate(initial?.postedAt));
  const [bodyText,      setBodyText]      = useState(initial?.bodyText      ?? "");
  const [mediaType,     setMediaType]     = useState<MediaType>((initial?.mediaType as MediaType) ?? "IMAGE");
  const [videoDuration, setVideoDuration] = useState(initial?.videoDuration ?? "");

  // ── エンゲージメント（views・likes を上位に）
  const [views,   setViews]   = useState(String(initial?.views   ?? ""));
  const [likes,   setLikes]   = useState(String(initial?.likes   ?? ""));
  const [reposts, setReposts] = useState(String(initial?.reposts ?? ""));
  const [replies, setReplies] = useState(String(initial?.replies ?? ""));

  // ── タグ（定義済み + カスタム）
  const initDecoded    = decodeTags(initial?.growthReasonTags);
  const [selectedTags,   setSelectedTags]   = useState<string[]>(initDecoded.filter((t) => PREDEFINED.includes(t)));
  const [customTags,     setCustomTags]     = useState<string[]>(initDecoded.filter((t) => !PREDEFINED.includes(t)));
  const [customTagInput, setCustomTagInput] = useState("");
  const [suggestedTags,  setSuggestedTags]  = useState<string[]>([]);

  // ── 分析メモ
  const [growthReasonNote, setGrowthReasonNote] = useState(initial?.growthReasonNote ?? "");
  const [applicationNote,  setApplicationNote]  = useState(initial?.applicationNote  ?? "");

  // ── 制作観察メモ（折りたたみ）
  const [showDetail,      setShowDetail]      = useState(
    !!(initial?.compositionNote || initial?.characterNote || initial?.backgroundNote || initial?.aiReductionNote)
  );
  const [compositionNote, setCompositionNote] = useState(initial?.compositionNote ?? "");
  const [characterNote,   setCharacterNote]   = useState(initial?.characterNote   ?? "");
  const [backgroundNote,  setBackgroundNote]  = useState(initial?.backgroundNote  ?? "");
  const [aiReductionNote, setAiReductionNote] = useState(initial?.aiReductionNote ?? "");

  const [showVisionTagger, setShowVisionTagger] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const allSelectedTags = [...selectedTags, ...customTags];

  // ── タグ操作
  const toggleTag = (tag: string) =>
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const handleSuggestTags = () => {
    const suggested = suggestTagsFromContent(bodyText, mediaType);
    setSuggestedTags(suggested);
  };

  const applySuggestedTag = (tag: string) => {
    if (PREDEFINED.includes(tag)) {
      toggleTag(tag);
    } else if (!customTags.includes(tag)) {
      setCustomTags((prev) => [...prev, tag]);
    } else {
      setCustomTags((prev) => prev.filter((t) => t !== tag));
    }
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (!tag) return;
    setCustomTagInput("");
    if (PREDEFINED.includes(tag)) {
      setSelectedTags((prev) => prev.includes(tag) ? prev : [...prev, tag]);
    } else if (!customTags.includes(tag)) {
      setCustomTags((prev) => [...prev, tag]);
    }
  };

  // ── 送信
  const handleSubmit = async () => {
    if (!accountName.trim()) { setError("アカウント名は必須です"); return; }
    setSubmitting(true);
    setError(null);

    const payload = {
      accountName:      accountName.trim(),
      postUrl:          postUrl.trim()         || null,
      postedAt:         postedAt ? new Date(postedAt).toISOString() : null,
      bodyText:         bodyText.trim()        || null,
      mediaType,
      videoDuration:    videoDuration.trim()   || null,
      compositionNote:  compositionNote.trim()  || null,
      characterNote:    characterNote.trim()    || null,
      backgroundNote:   backgroundNote.trim()   || null,
      aiReductionNote:  aiReductionNote.trim()  || null,
      likes:            Number(likes)    || 0,
      reposts:          Number(reposts)  || 0,
      replies:          Number(replies)  || 0,
      views:            Number(views)    || 0,
      growthReasonNote: growthReasonNote.trim() || null,
      growthReasonTags: encodeTags(allSelectedTags),
      applicationNote:  applicationNote.trim()  || null,
    };

    try {
      const url    = mode === "create" ? "/api/benchmark" : `/api/benchmark/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res    = await fetch(url, {
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

  const handleVisionApply = (result: VisionTagResult) => {
    if (result.growthReasonMemo) setGrowthReasonNote(result.growthReasonMemo);
    if (result.compositionNote)  setCompositionNote(result.compositionNote);
    if (result.characterNote)    setCharacterNote(result.characterNote);
    if (result.backgroundNote)   setBackgroundNote(result.backgroundNote);
    setShowDetail(true);
  };

  const ta = "input min-h-[80px] resize-y text-sm";

  return (
    <div className="max-w-2xl space-y-6">
      {showVisionTagger && (
        <BenchmarkVisionTagger
          onClose={() => setShowVisionTagger(false)}
          onApply={handleVisionApply}
          benchmarkPostId={mode === "edit" ? initial?.id : undefined}
        />
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── 投稿情報 */}
      <section className="card space-y-4">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">投稿情報</h3>

        {/* postUrl を最上部に */}
        <div>
          <label className="label">投稿URL</label>
          <input
            type="url"
            className="input"
            placeholder="https://x.com/username/status/..."
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
          />
          {postUrl && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-600 hover:underline mt-1 inline-block"
            >
              投稿を開く →
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <label className="label">投稿日時</label>
            <input
              type="datetime-local"
              className="input"
              value={postedAt}
              onChange={(e) => setPostedAt(e.target.value)}
            />
          </div>
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

      {/* ── キャプション + エンゲージメント */}
      <section className="card space-y-4">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">
          投稿内容・エンゲージメント
        </h3>

        <div>
          <label className="label">キャプション（投稿本文）</label>
          <textarea
            className={ta}
            placeholder="参考アカウントの投稿テキストをそのまま貼り付け..."
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            { key: "views",   label: "👁 表示数",     setter: setViews,   val: views,   primary: true  },
            { key: "likes",   label: "❤️ いいね数",  setter: setLikes,   val: likes,   primary: true  },
            { key: "reposts", label: "🔁 リポスト数", setter: setReposts, val: reposts, primary: false },
            { key: "replies", label: "💬 返信数",     setter: setReplies, val: replies, primary: false },
          ] as const).map(({ key, label, setter, val, primary }) => (
            <div key={key}>
              <label className={`label text-xs ${primary ? "font-semibold" : ""}`}>{label}</label>
              <input
                type="number"
                min="0"
                className={`input ${primary ? "ring-1 ring-brand-200 focus:ring-brand-400" : ""}`}
                value={val}
                onChange={(e) => setter(e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── タグ・分析 */}
      <section className="card space-y-4">
        <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">タグ・分析</h3>

        {/* タグ選択 + 自動提案 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">伸びた理由タグ（複数選択可）</label>
            <button
              type="button"
              onClick={handleSuggestTags}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
            >
              ✨ タグを自動提案
            </button>
          </div>

          {/* 自動提案バナー */}
          {suggestedTags.length > 0 && (
            <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700 font-medium mb-2">
                💡 キャプション・メディア種別から提案（クリックで選択/解除）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedTags.map((tag) => {
                  const selected = allSelectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => applySuggestedTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        selected
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-white text-amber-700 border-amber-300 hover:bg-amber-100"
                      }`}
                    >
                      {selected ? "✓ " : ""}{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 定義済みタグ */}
          <div className="flex flex-wrap gap-2">
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

          {/* カスタムタグ表示 */}
          {customTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {customTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-purple-100 text-purple-700 border border-purple-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setCustomTags((prev) => prev.filter((t) => t !== tag))}
                    className="text-purple-400 hover:text-purple-700 leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* カスタムタグ入力 */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              className="input flex-1 text-sm"
              placeholder="独自タグを追加（例: 夜投稿、冬コーデ）Enter で追加"
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
            />
            <button type="button" onClick={addCustomTag} className="btn-secondary text-sm px-4">
              追加
            </button>
          </div>

          {allSelectedTags.length > 0 && (
            <p className="text-xs text-brand-600 mt-2">選択中: {allSelectedTags.join("、")}</p>
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

      {/* ── 制作観察メモ（折りたたみ） */}
      <section className="card">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="flex-1 flex items-center justify-between text-left"
          >
            <h3 className="font-semibold text-gray-900">
              制作観察メモ{" "}
              <span className="text-xs font-normal text-gray-400 ml-1">（任意）</span>
            </h3>
            <span className="text-gray-400 text-sm">{showDetail ? "▲ 閉じる" : "▼ 開く"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowVisionTagger(true)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
            title="画像をAIで解析して4項目を自動生成"
          >
            ✨ AI 自動タグ付け
          </button>
        </div>

        {showDetail && (
          <div className="mt-4 space-y-4">
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
              <label className="label">背景・空間メモ</label>
              <textarea
                className={ta}
                placeholder="例: 白基調のカフェ、自然光・ボケ背景が印象的..."
                value={backgroundNote}
                onChange={(e) => setBackgroundNote(e.target.value)}
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
          </div>
        )}
      </section>

      {/* ── 送信 */}
      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
          {submitting ? "保存中..." : mode === "create" ? "登録する" : "更新する"}
        </button>
        <button onClick={() => router.back()} className="btn-secondary">
          キャンセル
        </button>
      </div>
    </div>
  );
}
