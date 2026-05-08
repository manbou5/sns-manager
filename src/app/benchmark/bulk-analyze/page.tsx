"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { VisionTagBatchItem, VisionTagResult } from "@/types";
import {
  generateBulkAnalyzeCsv,
  downloadCsv,
  filenameToCaption,
  type BulkAnalyzeRow,
} from "@/lib/bulkAnalyzeCsv";

// ─── 定数 ────────────────────────────────────────────────────────────────────

const ACCEPT     = "image/jpeg,image/png,image/webp,image/gif";
const MAX_FILES  = 50;
const BATCH_SIZE = 5;

// ─── 型 ──────────────────────────────────────────────────────────────────────

type ImageStatus = "pending" | "processing" | "done" | "failed";

type ImageEntry = {
  file:       File;
  preview:    string;
  caption?:   string;
  postUrl?:   string;
  platform?:  string;
  mediaType?: string;
  views?:     number | null;
  likes?:     number | null;
  comments?:  number | null;
  shares?:    number | null;
  status:     ImageStatus;
  result:     VisionTagResult | null;
  error:      string | null;
};

type BatchItem = { index: number; file: File };

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function base64ToFile(base64: string, filename: string, mimeType: string): File {
  const bytes   = atob(base64);
  const arr     = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new File([arr], filename, { type: mimeType });
}

const X_RATE_LIMIT_MS = 3000;

// ─── ステータスバッジ ─────────────────────────────────────────────────────────

const STATUS_MAP: Record<ImageStatus, { label: string; className: string }> = {
  pending:    { label: "待機中",  className: "text-gray-400"  },
  processing: { label: "解析中…", className: "text-blue-500 animate-pulse" },
  done:       { label: "✓ 完了",  className: "text-green-600 font-semibold" },
  failed:     { label: "✗ 失敗",  className: "text-red-500"  },
};

function StatusBadge({ status }: { status: ImageStatus }) {
  const { label, className } = STATUS_MAP[status];
  return <span className={`text-xs ${className}`}>{label}</span>;
}

function MetricChip({ icon, value }: { icon: string; value: number | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[11px] bg-sky-50 border border-sky-100 text-sky-600">
      {icon}{" "}
      {value != null ? (
        <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
      ) : (
        <span className="text-gray-400 italic text-[10px]">未取得</span>
      )}
    </span>
  );
}

type MetricLike = { views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null };
function computeEr(e: MetricLike): string | null {
  const { views, likes, comments, shares } = e;
  if (views == null || views === 0) return null;
  const eng = (likes ?? 0) + (comments ?? 0) + (shares ?? 0);
  return ((eng / views) * 100).toFixed(2);
}

// ─── ページ ────────────────────────────────────────────────────────────────────

export default function BulkAnalyzePage() {
  const [entries,     setEntries]     = useState<ImageEntry[]>([]);
  const [running,     setRunning]     = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const [xUrl,        setXUrl]        = useState("");
  const [xExtracting, setXExtracting] = useState(false);
  const [xError,      setXError]      = useState<string | null>(null);
  const [xLastFetch,  setXLastFetch]  = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── 集計
  const total      = entries.length;
  const doneCount  = entries.filter((e) => e.status === "done").length;
  const failCount  = entries.filter((e) => e.status === "failed").length;
  const pendCount  = entries.filter((e) => e.status === "pending").length;
  const procCount  = entries.filter((e) => e.status === "processing").length;
  const progress   = total > 0 ? ((doneCount + failCount) / total) * 100 : 0;
  const canAnalyze = (pendCount > 0 || failCount > 0) && !running;
  const canDl      = doneCount > 0 && !running;

  // ── ファイル追加
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setEntries((prev) => {
      const remaining = MAX_FILES - prev.length;
      const added = arr.slice(0, remaining).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status:  "pending" as const,
        result:  null,
        error:   null,
      }));
      return [...prev, ...added];
    });
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => {
      const p = prev[idx].preview;
      if (p.startsWith("blob:")) URL.revokeObjectURL(p);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── バッチ処理
  const processBatch = async (batch: BatchItem[]) => {
    if (batch.length === 0) return;

    setEntries((prev) =>
      prev.map((e, i) =>
        batch.some((b) => b.index === i)
          ? { ...e, status: "processing" as const, error: null }
          : e
      )
    );

    try {
      const fd = new FormData();
      for (const { file } of batch) fd.append("images", file);

      const res = await fetch("/api/benchmark/vision-tag", { method: "POST", body: fd });
      const data: { results?: VisionTagBatchItem[]; error?: string } = await res.json();

      if (!res.ok || !data.results) {
        const msg = data.error ?? "解析に失敗しました";
        setEntries((prev) =>
          prev.map((e, i) =>
            batch.some((b) => b.index === i)
              ? { ...e, status: "failed" as const, error: msg }
              : e
          )
        );
        return;
      }

      setEntries((prev) => {
        const next = [...prev];
        data.results!.forEach((r, apiIdx) => {
          const originalIdx = batch[apiIdx]?.index;
          if (originalIdx === undefined) return;
          if (r.result) {
            next[originalIdx] = {
              ...next[originalIdx],
              status: "done",
              result: r.result,
              error:  null,
            };
          } else {
            next[originalIdx] = {
              ...next[originalIdx],
              status: "failed",
              error:  r.error ?? "解析失敗",
              result: null,
            };
          }
        });
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ネットワークエラー";
      setEntries((prev) =>
        prev.map((e, i) =>
          batch.some((b) => b.index === i)
            ? { ...e, status: "failed" as const, error: msg }
            : e
        )
      );
    }
  };

  // ── 全解析
  const handleAnalyzeAll = async () => {
    const targets: BatchItem[] = entries
      .map((e, i) => ({ index: i, file: e.file, status: e.status }))
      .filter(({ status }) => status === "pending" || status === "failed")
      .map(({ index, file }) => ({ index, file }));

    if (targets.length === 0) return;
    setRunning(true);

    for (let b = 0; b < targets.length; b += BATCH_SIZE) {
      await processBatch(targets.slice(b, b + BATCH_SIZE));
    }

    setRunning(false);
  };

  // ── 個別リトライ
  const handleRetry = async (idx: number) => {
    const entry = entries[idx];
    if (!entry) return;
    setRunning(true);
    await processBatch([{ index: idx, file: entry.file }]);
    setRunning(false);
  };

  // ── CSV ダウンロード
  const handleDownload = () => {
    const rows: BulkAnalyzeRow[] = entries
      .filter((e) => e.status === "done")
      .map((e) => ({
        filename:  e.file.name,
        caption:   e.caption,
        postUrl:   e.postUrl,
        platform:  e.platform,
        mediaType: e.mediaType,
        views:     e.views,
        likes:     e.likes,
        comments:  e.comments,
        shares:    e.shares,
        result:    e.result,
      }));
    const csv = generateBulkAnalyzeCsv(rows);
    const ts  = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadCsv(csv, `benchmark_bulk_${ts}.csv`);
  };

  // ── 全クリア
  const handleClear = () => {
    entries.forEach((e) => {
      if (e.preview.startsWith("blob:")) URL.revokeObjectURL(e.preview);
    });
    setEntries([]);
  };

  // ── X URL から画像取得
  const handleXExtract = async () => {
    const trimmed = xUrl.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (now - xLastFetch < X_RATE_LIMIT_MS) {
      setXError(`連続リクエストを防ぐため ${X_RATE_LIMIT_MS / 1000} 秒間隔を空けてください`);
      return;
    }

    setXExtracting(true);
    setXError(null);

    try {
      const res  = await fetch("/api/benchmark/x-extract", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: trimmed }),
      });
      type XExtractResponse = {
        tweetId?: string;
        postUrl?: string;
        caption?: string;
        metrics?: {
          likes: number | null; comments: number | null;
          shares: number | null; views: number | null;
          mediaType: string;
        };
        images?: { filename: string; base64: string; mimeType: string; previewDataUrl: string }[];
        error?: string;
      };
      const data: XExtractResponse = await res.json();

      if (!res.ok || !data.images) {
        setXError(data.error ?? "画像の取得に失敗しました");
        return;
      }

      setXLastFetch(Date.now());

      const newEntries: ImageEntry[] = data.images.map(({ filename, base64, mimeType, previewDataUrl }) => ({
        file:      base64ToFile(base64, filename, mimeType),
        preview:   previewDataUrl,
        caption:   data.caption ?? undefined,
        postUrl:   data.postUrl ?? undefined,
        platform:  "X",
        mediaType: data.metrics?.mediaType ?? "IMAGE",
        views:     data.metrics?.views    ?? null,
        likes:     data.metrics?.likes    ?? null,
        comments:  data.metrics?.comments ?? null,
        shares:    data.metrics?.shares   ?? null,
        status:    "pending" as const,
        result:    null,
        error:     null,
      }));

      setEntries((prev) => {
        const remaining = MAX_FILES - prev.length;
        return [...prev, ...newEntries.slice(0, remaining)];
      });

      setXUrl("");
    } catch (e) {
      setXError(e instanceof Error ? e.message : "ネットワークエラー");
    } finally {
      setXExtracting(false);
    }
  };

  // ─── レンダー ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-5">

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">画像一括解析 → CSV生成</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            複数画像を GPT-4o Vision で解析し、ベンチマーク CSV を自動生成します
          </p>
        </div>
        <Link href="/benchmark" className="btn-secondary text-sm">
          ← ベンチマーク
        </Link>
      </div>

      {/* X URL 入力 */}
      {total < MAX_FILES && (
        <div className="card space-y-2">
          <p className="text-sm font-semibold text-gray-700">
            𝕏 投稿 URL から画像を取得
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={xUrl}
              onChange={(e) => { setXUrl(e.target.value); setXError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleXExtract(); }}
              placeholder="https://x.com/username/status/1234567890"
              className="input flex-1 text-sm font-mono"
              disabled={xExtracting}
            />
            <button
              onClick={handleXExtract}
              disabled={!xUrl.trim() || xExtracting}
              className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
            >
              {xExtracting ? "取得中…" : "画像取得"}
            </button>
          </div>
          {xError && (
            <p className="text-xs text-red-500 leading-snug">{xError}</p>
          )}
          <p className="text-xs text-gray-400">
            ツイートのテキストがキャプション列に自動入力されます。X API の Read 権限と環境変数（X_API_KEY 等）が必要です。
          </p>
        </div>
      )}

      {/* ドロップゾーン */}
      {total < MAX_FILES && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors select-none ${
            dragOver
              ? "border-brand-500 bg-brand-50"
              : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"
          }`}
        >
          <div className="text-5xl mb-3">📁</div>
          <p className="font-semibold text-gray-700">
            画像をドラッグ＆ドロップ、またはクリックして選択
          </p>
          <p className="text-sm text-gray-400 mt-1.5">
            JPEG / PNG / WebP / GIF　最大 {MAX_FILES} 枚・各 10MB
          </p>
          <p className="text-xs text-gray-400 mt-1">
            ファイル名がキャプションの仮値として使用されます
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* 進捗パネル */}
      {total > 0 && (
        <div className="card space-y-3">

          {/* 件数バッジ行 */}
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="font-semibold text-gray-700">合計 {total} 枚</span>
            {doneCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium text-xs">
                ✓ 完了 {doneCount}
              </span>
            )}
            {procCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-600 font-medium text-xs animate-pulse">
                ⟳ 解析中 {procCount}
              </span>
            )}
            {failCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-600 font-medium text-xs">
                ✗ 失敗 {failCount}
              </span>
            )}
            {pendCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium text-xs">
                待機中 {pendCount}
              </span>
            )}
          </div>

          {/* プログレスバー */}
          {total > 0 && (running || doneCount + failCount > 0) && (
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: failCount > 0 && doneCount === 0
                    ? "#f87171"
                    : "linear-gradient(90deg, #7c3aed, #a78bfa)",
                }}
              />
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAnalyzeAll}
              disabled={!canAnalyze}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {running
                ? `解析中… (${doneCount + failCount} / ${total})`
                : failCount > 0 && pendCount === 0
                ? `↩ 失敗分を再試行 (${failCount}枚)`
                : `▶ 全て解析 (${pendCount + failCount}枚)`}
            </button>

            <button
              onClick={handleDownload}
              disabled={!canDl}
              className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              ⬇ CSV ダウンロード
              <span className="text-xs font-normal text-gray-400">({doneCount}件)</span>
            </button>

            <button
              onClick={handleClear}
              disabled={running}
              className="text-sm text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 ml-auto"
            >
              全てクリア
            </button>
          </div>
        </div>
      )}

      {/* CSV プレビュー情報 */}
      {doneCount > 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-500 space-y-1.5">
          <p className="font-medium text-gray-700">CSV 出力内容</p>
          <p className="font-mono break-all text-gray-400 leading-relaxed">
            <span className="text-sky-600 font-semibold">postUrl, platform, caption, mediaType, views, likes, comments, shares, er</span>
            {", saves, followersGained, "}
            <span className="text-violet-600 font-semibold">growthReasonMemo, compositionNote, characterNote, backgroundNote</span>
          </p>
          <div className="space-y-0.5">
            <p><span className="text-sky-600 font-semibold">青字</span> = X URL 取得分は自動入力。views がある場合は ER も自動計算。</p>
            <p><span className="text-violet-600 font-semibold">紫字</span> = AI 解析結果（Vision）。</p>
            <p>saves / followersGained は X API 非対応のため空欄。手動で補完してください。</p>
          </div>
        </div>
      )}

      {/* 画像グリッド */}
      {total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entries.map((entry, i) => (
            <div key={i} className="card p-0 overflow-hidden">

              {/* サムネイル + ステータス行 */}
              <div className="flex items-start gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.preview}
                  alt={entry.file.name}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-100"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {entry.platform && (
                      <span className="shrink-0 px-1 py-0.5 rounded bg-sky-100 text-sky-600 text-[10px] font-semibold leading-none">
                        {entry.platform}
                      </span>
                    )}
                    {entry.mediaType && (
                      <span className="shrink-0 px-1 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-medium leading-none">
                        {entry.mediaType}
                      </span>
                    )}
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {entry.file.name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {(entry.caption ?? filenameToCaption(entry.file.name)) || "(キャプションなし)"}
                  </p>
                  {/* X メトリクス */}
                  {entry.platform === "X" && (
                    <div className="flex flex-wrap gap-1">
                      <MetricChip icon="👍" value={entry.likes} />
                      <MetricChip icon="💬" value={entry.comments} />
                      <MetricChip icon="🔁" value={entry.shares} />
                      <MetricChip icon="👁" value={entry.views} />
                      {computeEr(entry) != null && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-emerald-50 border border-emerald-100 text-emerald-600 font-medium">
                          ER {computeEr(entry)}%
                        </span>
                      )}
                    </div>
                  )}
                  <StatusBadge status={entry.status} />
                  {entry.error && (
                    <p className="text-xs text-red-500 break-all leading-snug">
                      {entry.error}
                    </p>
                  )}
                </div>

                {/* アクション */}
                <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                  {entry.status === "failed" && (
                    <button
                      onClick={() => handleRetry(i)}
                      disabled={running}
                      className="text-xs px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      ↩ 再試行
                    </button>
                  )}
                  {entry.status !== "processing" && (
                    <button
                      onClick={() => removeEntry(i)}
                      disabled={running}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* AI 解析結果プレビュー */}
              {entry.status === "done" && entry.result && (
                <div className="border-t border-gray-100 px-3 pb-3 pt-2 bg-violet-50/50 grid grid-cols-1 gap-1">
                  {(
                    [
                      { key: "growthReasonMemo", label: "成長理由" },
                      { key: "compositionNote",  label: "構図"     },
                      { key: "characterNote",    label: "人物"     },
                      { key: "backgroundNote",   label: "背景"     },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="text-xs leading-snug">
                      <span className="font-medium text-violet-600 mr-1">{label}:</span>
                      <span className="text-gray-600">
                        {entry.result![key]
                          ? entry.result![key].slice(0, 80) + (entry.result![key].length > 80 ? "…" : "")
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 空状態 */}
      {total === 0 && (
        <div className="text-center py-16 text-gray-300">
          <div className="text-6xl mb-4">🖼️</div>
          <p className="text-base text-gray-400">上のエリアに画像をドロップしてください</p>
          <p className="text-sm text-gray-300 mt-1">
            最大 {MAX_FILES} 枚を {BATCH_SIZE} 枚ずつバッチ処理します
          </p>
        </div>
      )}
    </div>
  );
}
