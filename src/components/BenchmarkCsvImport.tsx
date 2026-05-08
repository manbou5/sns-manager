"use client";

import { useRef, useState } from "react";
import { parseCSV, generateBenchmarkSampleCsv } from "@/lib/benchmarkCsv";
import type { BenchmarkImportError } from "@/types";

interface ImportResult {
  imported: number;
  skipped:  number;
  errors:   BenchmarkImportError[];
}

// プレビューで表示するカラム（一括解析CSVと共通の主要列）
const PREVIEW_COLS = [
  { key: "caption",          label: "キャプション" },
  { key: "mediaType",        label: "メディア"     },
  { key: "views",            label: "表示数"       },
  { key: "likes",            label: "いいね"       },
  { key: "growthReasonMemo", label: "成長メモ"     },
] as const;

interface Props {
  onImportComplete: () => void;
}

export function BenchmarkCsvImport({ onImportComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen,      setIsOpen]      = useState(false);
  const [file,        setFile]        = useState<File | null>(null);
  const [preview,     setPreview]     = useState<string[][]>([]);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [totalRows,   setTotalRows]   = useState(0);
  const [parseError,  setParseError]  = useState<string | null>(null);
  const [importing,   setImporting]   = useState(false);
  const [result,      setResult]      = useState<ImportResult | null>(null);
  const [fatalError,  setFatalError]  = useState<string | null>(null);

  const downloadSample = () => {
    const content = generateBenchmarkSampleCsv();
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "benchmark_import_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setFatalError(null);
    setParseError(null);
    setPreview([]);

    if (!selected) return;
    if (!selected.name.endsWith(".csv")) {
      setParseError("CSVファイル (.csv) を選択してください");
      return;
    }

    const text = await selected.text();
    const rows = parseCSV(text);

    if (rows.length < 2) {
      setParseError("CSVにデータ行がありません");
      return;
    }

    const headers      = rows[0];
    const lowerHeaders = headers.map((h) => h.toLowerCase());

    const REQUIRED = [
      "posturl", "caption", "mediatype",
      "views", "likes", "comments", "shares",
      "growthreasonmemo", "compositionnote", "characternote", "backgroundnote",
    ];
    const missing = REQUIRED.filter((r) => !lowerHeaders.includes(r));
    if (missing.length > 0) {
      setParseError(`必須カラムが不足しています: ${missing.join(", ")}`);
      return;
    }

    const indices = PREVIEW_COLS.map((c) => lowerHeaders.indexOf(c.key.toLowerCase()));
    setPreviewCols(PREVIEW_COLS.map((c) => c.label));

    const previewRows = rows.slice(1, 4).map((row) =>
      indices.map((i) => row[i] ?? "")
    );
    setPreview(previewRows);
    setTotalRows(rows.length - 1);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setFatalError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res  = await fetch("/api/benchmark/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setFatalError(data.error ?? "インポートに失敗しました");
        return;
      }
      setResult(data as ImportResult);
      if ((data as ImportResult).imported > 0) onImportComplete();
    } catch {
      setFatalError("通信エラーが発生しました");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview([]);
    setPreviewCols([]);
    setResult(null);
    setFatalError(null);
    setParseError(null);
    setTotalRows(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const errorCount    = result ? result.errors.filter((e) => !e.message.startsWith("重複:")).length : 0;
  const duplicateCount = result ? result.skipped : 0;

  return (
    <div className="card">
      {/* トグルヘッダー */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-semibold text-gray-900">📥 CSVで一括インポート</span>
        <span className="text-gray-400 text-sm">{isOpen ? "▲ 閉じる" : "▼ 開く"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          {/* フォーマット説明 */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1.5">
            <p className="font-medium text-gray-700">CSVフォーマット（一括解析CSVと共通仕様）</p>
            <p className="font-mono break-all text-gray-500 leading-relaxed">
              <span className="text-gray-800 font-semibold">必須:</span>{" "}
              postUrl, caption, mediaType, views, likes, comments, shares,
              growthReasonMemo, compositionNote, characterNote, backgroundNote
            </p>
            <p className="font-mono break-all text-gray-400 leading-relaxed">
              <span className="font-semibold">任意:</span>{" "}
              platform, saves, followersGained, er, accountName, postedAt,
              videoDuration, aiReductionNote, growthReasonTags, applicationNote
            </p>
            <div className="space-y-0.5 text-gray-500">
              <p>※ 一括解析CSV（画像一括解析 → CSV生成）をそのまま読み込めます。</p>
              <p>※ <code>growthReasonTags</code> は <code>|</code> 区切り（例: <code>構図|表情</code>）。省略時はキャプションから自動提案。</p>
              <p>※ <code>postUrl</code> が既存レコードと一致する行は重複としてスキップされます。</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={downloadSample} className="btn-secondary text-sm">
              📄 サンプルCSVをダウンロード
            </button>
          </div>

          {/* ファイル選択 */}
          {!result && (
            <div>
              <label className="label">CSVファイルを選択</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700
                  hover:file:bg-brand-100 cursor-pointer"
              />
            </div>
          )}

          {/* フォーマットエラー */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {/* プレビューテーブル */}
          {preview.length > 0 && !result && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                プレビュー（先頭3行・主要5カラム表示）/ 全 {totalRows} 行
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {previewCols.map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2 text-gray-700 max-w-[160px] truncate">
                            {cell || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 致命的エラー */}
          {fatalError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {fatalError}
            </div>
          )}

          {/* インポート結果 */}
          {result && (
            <div className="space-y-3">
              {/* サマリーカード */}
              <div className={`rounded-lg p-4 border ${
                errorCount === 0 && duplicateCount === 0
                  ? "bg-green-50 border-green-200"
                  : errorCount === 0
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              }`}>
                <p className={`font-semibold text-sm mb-3 ${
                  errorCount === 0 && duplicateCount === 0
                    ? "text-green-700"
                    : errorCount === 0
                    ? "text-yellow-700"
                    : "text-red-700"
                }`}>
                  {errorCount === 0 && duplicateCount === 0
                    ? "✅ インポート完了"
                    : errorCount === 0
                    ? "⚠️ スキップあり（重複）"
                    : "❌ エラーあり"}
                </p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center rounded-lg bg-green-100 py-2">
                    <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                    <p className="text-xs text-green-600 mt-0.5">✅ 登録成功</p>
                  </div>
                  <div className="text-center rounded-lg bg-yellow-100 py-2">
                    <p className="text-2xl font-bold text-yellow-700">{duplicateCount}</p>
                    <p className="text-xs text-yellow-600 mt-0.5">⚠️ 重複スキップ</p>
                  </div>
                  <div className="text-center rounded-lg bg-red-100 py-2">
                    <p className="text-2xl font-bold text-red-700">{errorCount}</p>
                    <p className="text-xs text-red-600 mt-0.5">❌ エラー</p>
                  </div>
                </div>
              </div>

              {/* エラー詳細 */}
              {result.errors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">失敗・スキップ一覧</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {result.errors.map((err, i) => {
                      const isDuplicate = err.message.startsWith("重複:");
                      return (
                        <div
                          key={i}
                          className={`rounded px-3 py-2 text-xs border ${
                            isDuplicate
                              ? "bg-yellow-50 border-yellow-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          <span className={`font-mono font-medium ${isDuplicate ? "text-yellow-700" : "text-red-600"}`}>
                            {err.row}行目
                          </span>
                          {err.accountName && (
                            <span className="text-gray-500 ml-2">{err.accountName}</span>
                          )}
                          <span className={`ml-2 ${isDuplicate ? "text-yellow-700" : "text-red-700"}`}>
                            — {err.message}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button onClick={handleReset} className="btn-secondary text-sm">
                別のファイルをインポート
              </button>
            </div>
          )}

          {/* インポートボタン */}
          {file && preview.length > 0 && !result && (
            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="btn-primary"
              >
                {importing ? "インポート中..." : `${totalRows} 件を登録する`}
              </button>
              <button onClick={handleReset} className="btn-secondary">
                キャンセル
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
