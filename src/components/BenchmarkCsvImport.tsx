"use client";

import { useRef, useState } from "react";
import { parseCSV, generateBenchmarkSampleCsv } from "@/lib/benchmarkCsv";
import type { BenchmarkImportError } from "@/types";

interface ImportResult {
  imported: number;
  errors: BenchmarkImportError[];
}

// プレビューで表示するカラム（16列全部は多すぎるので主要5列のみ）
const PREVIEW_COLS = [
  "accountName",
  "mediaType",
  "likes",
  "views",
  "growthReasonTags",
] as const;

interface Props {
  onImportComplete: () => void;
}

export function BenchmarkCsvImport({ onImportComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen,     setIsOpen]     = useState(false);
  const [file,       setFile]       = useState<File | null>(null);
  const [preview,    setPreview]    = useState<string[][]>([]);      // [rows][cols] of preview values
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [totalRows,  setTotalRows]  = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState<ImportResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

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

    const headers = rows[0];
    const lowerHeaders = headers.map((h) => h.toLowerCase());

    // 必須カラムの存在確認（全16カラム）
    const REQUIRED = [
      "accountname","posturl","postedat","bodytext","mediatype","videoduration",
      "compositionnote","characternote","aireductionnote","likes","reposts",
      "replies","views","growthreasonnote","growthreasontags","applicationnote"
    ];
    const missing = REQUIRED.filter((r) => !lowerHeaders.includes(r));
    if (missing.length > 0) {
      setParseError(`必須カラムが不足: ${missing.join(", ")}`);
      return;
    }

    // プレビュー用インデックス
    const previewColIndices = PREVIEW_COLS.map((c) =>
      lowerHeaders.indexOf(c.toLowerCase())
    );
    const previewHeaderLabels = PREVIEW_COLS.map((c) => c);
    setPreviewHeaders(previewHeaderLabels);

    const previewRows = rows.slice(1, 4).map((row) =>
      previewColIndices.map((i) => row[i] ?? "")
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
      if (data.imported > 0) onImportComplete();
    } catch {
      setFatalError("通信エラーが発生しました");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview([]);
    setPreviewHeaders([]);
    setResult(null);
    setFatalError(null);
    setParseError(null);
    setTotalRows(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="card">
      {/* トグルヘッダー */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-semibold text-gray-900">
          📥 CSVで一括インポート
        </span>
        <span className="text-gray-400 text-sm">{isOpen ? "▲ 閉じる" : "▼ 開く"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          {/* フォーマット説明 */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">CSVフォーマット（16カラム）</p>
            <p className="font-mono break-all">
              accountName, postUrl, postedAt, bodyText, mediaType, videoDuration,
              compositionNote, characterNote, aiReductionNote, likes, reposts,
              replies, views, growthReasonNote, <strong>growthReasonTags</strong>, applicationNote
            </p>
            <p className="mt-1">
              ※ <code>growthReasonTags</code> は <code>|</code> 区切り（例: <code>構図|表情</code>）
            </p>
            <p>
              ※ テキストにカンマが含まれる場合はダブルクォートで囲んでください
            </p>
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
                      {previewHeaders.map((h) => (
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
              <div
                className={`rounded-lg p-4 border ${
                  result.errors.length === 0
                    ? "bg-green-50 border-green-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <p className={`font-semibold text-sm ${
                  result.errors.length === 0 ? "text-green-700" : "text-yellow-700"
                }`}>
                  {result.errors.length === 0 ? "✅ インポート完了" : "⚠️ 一部エラーあり"}
                </p>
                <div className="flex gap-6 mt-2 text-sm text-gray-600">
                  <span>登録: <strong className="text-green-700">{result.imported} 件</strong></span>
                  <span>エラー: <strong className="text-red-700">{result.errors.length} 件</strong></span>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <div key={i} className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs">
                      <span className="font-mono text-red-600 font-medium">{err.row}行目</span>
                      {err.accountName && (
                        <span className="text-gray-500 ml-2">{err.accountName}</span>
                      )}
                      <span className="text-red-700 ml-2">— {err.message}</span>
                    </div>
                  ))}
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
