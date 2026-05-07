"use client";

import { useCallback, useRef, useState } from "react";
import type { VisionTagBatchItem, VisionTagResult } from "@/types";

// ─── 型 ──────────────────────────────────────────────────────────────────────

type ImageEntry = {
  file:     File;
  preview:  string;
  status:   "pending" | "processing" | "done" | "failed";
  result:   VisionTagResult | null;
  error:    string | null;
};

interface Props {
  /** モーダルを閉じるコールバック */
  onClose: () => void;
  /** 解析結果を適用するコールバック（単枚モード用） */
  onApply?: (result: VisionTagResult) => void;
  /** 解析結果をBenchmarkPostに直接保存する対象ID（任意） */
  benchmarkPostId?: string;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const MAX_FILES = 10;

// ─── コンポーネント ───────────────────────────────────────────────────────────

export default function BenchmarkVisionTagger({ onClose, onApply, benchmarkPostId }: Props) {
  const [entries,   setEntries]   = useState<ImageEntry[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── ファイル追加 ────────────────────────────────────────────────────────

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

  const removeEntry = (index: number) => {
    setEntries((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ── 解析実行 ───────────────────────────────────────────────────────────

  const runAnalysis = async (targets: number[]) => {
    if (targets.length === 0) return;
    setAnalyzing(true);

    // 対象を processing に
    setEntries((prev) =>
      prev.map((e, i) => (targets.includes(i) ? { ...e, status: "processing", error: null } : e))
    );

    try {
      const fd = new FormData();
      if (benchmarkPostId && targets.length === 1) {
        fd.append("benchmarkPostId", benchmarkPostId);
      }
      for (const i of targets) {
        fd.append("images", entries[i].file);
      }

      const res = await fetch("/api/benchmark/vision-tag", { method: "POST", body: fd });
      const data: { results?: VisionTagBatchItem[]; error?: string } = await res.json();

      if (!res.ok || !data.results) {
        const msg = data.error ?? "解析に失敗しました";
        setEntries((prev) =>
          prev.map((e, i) => (targets.includes(i) ? { ...e, status: "failed", error: msg } : e))
        );
        return;
      }

      // 結果をマージ（API の index は FormData の順序に対応）
      setEntries((prev) => {
        const next = [...prev];
        data.results!.forEach((r, apiIdx) => {
          const originalIdx = targets[apiIdx];
          if (originalIdx === undefined) return;
          if (r.result) {
            next[originalIdx] = { ...next[originalIdx], status: "done", result: r.result, error: null };
          } else {
            next[originalIdx] = { ...next[originalIdx], status: "failed", error: r.error ?? "解析失敗", result: null };
          }
        });
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ネットワークエラー";
      setEntries((prev) =>
        prev.map((e, i) => (targets.includes(i) ? { ...e, status: "failed", error: msg } : e))
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeAll = () => {
    const pending = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.status === "pending" || e.status === "failed")
      .map(({ i }) => i);
    runAnalysis(pending);
  };

  const handleRetry = (index: number) => runAnalysis([index]);

  // ── 適用 ─────────────────────────────────────────────────────────────

  const handleApply = (result: VisionTagResult) => {
    onApply?.(result);
    onClose();
  };

  // ── 状態集計 ──────────────────────────────────────────────────────────

  const pendingCount    = entries.filter((e) => e.status === "pending").length;
  const failedCount     = entries.filter((e) => e.status === "failed").length;
  const doneCount       = entries.filter((e) => e.status === "done").length;
  const canAnalyze      = (pendingCount > 0 || failedCount > 0) && !analyzing;

  // ── レンダー ─────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold">AI 自動タグ付け</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              画像を解析して growthReasonMemo / compositionNote / characterNote / backgroundNote を生成
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">✕</button>
        </div>

        {/* ボディ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ドロップゾーン */}
          {entries.length < MAX_FILES && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"
              }`}
            >
              <p className="text-sm font-medium text-gray-600">
                画像をドラッグ＆ドロップ、またはクリックして選択
              </p>
              <p className="text-xs text-gray-400 mt-1">
                JPEG / PNG / WebP / GIF　最大 {MAX_FILES} 枚・各 10MB まで
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

          {/* 画像リスト */}
          {entries.length > 0 && (
            <ul className="space-y-3">
              {entries.map((entry, i) => (
                <li key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                  {/* サムネイル + ステータス行 */}
                  <div className="flex items-center gap-3 p-3">
                    {/* サムネイル */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.preview}
                      alt={entry.file.name}
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0 bg-gray-100"
                    />

                    {/* ファイル名 + ステータス */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{entry.file.name}</p>
                      <StatusBadge status={entry.status} />
                      {entry.error && (
                        <p className="text-xs text-red-500 mt-0.5 break-all">{entry.error}</p>
                      )}
                    </div>

                    {/* アクション */}
                    <div className="flex gap-2 flex-shrink-0">
                      {entry.status === "failed" && (
                        <button
                          onClick={() => handleRetry(i)}
                          disabled={analyzing}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                        >
                          再試行
                        </button>
                      )}
                      {entry.status === "done" && entry.result && onApply && (
                        <button
                          onClick={() => handleApply(entry.result!)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                        >
                          フォームに反映
                        </button>
                      )}
                      {entry.status !== "processing" && (
                        <button
                          onClick={() => removeEntry(i)}
                          disabled={analyzing}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1.5"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 解析結果 */}
                  {entry.status === "done" && entry.result && (
                    <div className="border-t border-gray-100 px-3 pb-3 pt-2 grid grid-cols-1 gap-1.5 bg-gray-50">
                      {(
                        [
                          { key: "growthReasonMemo", label: "成長理由メモ" },
                          { key: "compositionNote",  label: "構図メモ"     },
                          { key: "characterNote",    label: "人物メモ"     },
                          { key: "backgroundNote",   label: "背景メモ"     },
                        ] as const
                      ).map(({ key, label }) => (
                        <div key={key} className="text-xs">
                          <span className="font-medium text-gray-500">{label}: </span>
                          <span className="text-gray-700">{entry.result![key] || "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* フッター */}
        <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3 bg-gray-50">
          <div className="text-xs text-gray-400">
            {doneCount > 0 && <span className="text-green-600 font-medium">{doneCount} 件完了</span>}
            {failedCount > 0 && <span className="text-red-500 font-medium ml-2">{failedCount} 件失敗</span>}
            {pendingCount > 0 && <span className="ml-2">{pendingCount} 件待機中</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">
              閉じる
            </button>
            <button
              onClick={handleAnalyzeAll}
              disabled={!canAnalyze}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {analyzing
                ? "解析中…"
                : failedCount > 0 && pendingCount === 0
                ? `↩ 失敗分を再試行 (${failedCount})`
                : `▶ 解析開始 (${pendingCount + failedCount} 枚)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ステータスバッジ ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ImageEntry["status"] }) {
  const map: Record<ImageEntry["status"], { label: string; className: string }> = {
    pending:    { label: "待機中",  className: "text-gray-400"   },
    processing: { label: "解析中…", className: "text-blue-500"   },
    done:       { label: "完了",   className: "text-green-600"  },
    failed:     { label: "失敗",   className: "text-red-500"    },
  };
  const { label, className } = map[status];
  return <span className={`text-xs font-medium ${className}`}>{label}</span>;
}
