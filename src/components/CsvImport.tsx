"use client";

import { useRef, useState } from "react";

// ─── 型定義 ────────────────────────────────────────────────────────────────────

interface ImportRowError {
  row: number;
  postId: string;
  message: string;
}

interface ImportResult {
  imported: number;
  updated: number;
  errors: ImportRowError[];
}

interface PreviewRow {
  postId: string;
  impressions: string;
  likes: string;
  reposts: string;
  clicks: string;
  followersGained: string;
}

// ─── サンプルCSVダウンロード ───────────────────────────────────────────────────

function downloadSampleCSV() {
  const content = [
    "postId,impressions,likes,reposts,clicks,followersGained",
    "YOUR_POST_ID_HERE,1500,80,15,40,3",
    "ANOTHER_POST_ID,3200,220,45,90,12",
  ].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analytics_import_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── クライアントサイドCSVプレビュー ─────────────────────────────────────────

function parsePreview(text: string): PreviewRow[] | null {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return null;

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["postid", "impressions", "likes", "reposts", "clicks", "followersgained"];
  if (required.some((h) => !headers.includes(h))) return null;

  const col = {
    postId:          headers.indexOf("postid"),
    impressions:     headers.indexOf("impressions"),
    likes:           headers.indexOf("likes"),
    reposts:         headers.indexOf("reposts"),
    clicks:          headers.indexOf("clicks"),
    followersGained: headers.indexOf("followersgained"),
  };

  return lines.slice(1, 6).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      postId:          cells[col.postId]          ?? "",
      impressions:     cells[col.impressions]     ?? "",
      likes:           cells[col.likes]           ?? "",
      reposts:         cells[col.reposts]         ?? "",
      clicks:          cells[col.clicks]          ?? "",
      followersGained: cells[col.followersGained] ?? "",
    };
  });
}

// ─── コンポーネント ────────────────────────────────────────────────────────────

interface Props {
  onImportComplete: () => void;
}

export function CsvImport({ onImportComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setFatalError(null);
    setPreview(null);
    setPreviewError(null);

    if (!selected) return;

    if (!selected.name.endsWith(".csv")) {
      setPreviewError("CSVファイル (.csv) を選択してください");
      return;
    }

    const text = await selected.text();
    const rows = parsePreview(text);

    // 総データ行数
    const allLines = text
      .replace(/^﻿/, "")
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    setTotalRows(Math.max(0, allLines.length - 1));

    if (!rows) {
      setPreviewError(
        "CSVの形式が正しくありません。必須カラム: postId, impressions, likes, reposts, clicks, followersGained"
      );
      return;
    }
    setPreview(rows);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setFatalError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/analytics/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setFatalError(data.error ?? "インポートに失敗しました");
        return;
      }
      setResult(data as ImportResult);
      if (data.imported > 0 || data.updated > 0) {
        onImportComplete();
      }
    } catch {
      setFatalError("通信エラーが発生しました");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setPreviewError(null);
    setResult(null);
    setFatalError(null);
    setTotalRows(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">📥 CSVで一括インポート</h3>
        <button
          onClick={downloadSampleCSV}
          className="text-xs text-brand-600 hover:underline"
        >
          サンプルCSVをダウンロード
        </button>
      </div>

      <p className="text-sm text-gray-500">
        CSVカラム順:{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
          postId, impressions, likes, reposts, clicks, followersGained
        </code>
      </p>

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

      {/* プレビューエラー */}
      {previewError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {previewError}
        </div>
      )}

      {/* プレビューテーブル */}
      {preview && !result && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            プレビュー（先頭5行）/ 全 {totalRows} 行
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["postId", "impressions", "likes", "reposts", "clicks", "followersGained"].map(
                    (h) => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-medium">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-700 max-w-[140px] truncate">
                      {row.postId}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.impressions}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.likes}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.reposts}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.clicks}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.followersGained}</td>
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
          {/* サマリー */}
          <div
            className={`rounded-lg p-4 border ${
              result.errors.length === 0
                ? "bg-green-50 border-green-200"
                : "bg-yellow-50 border-yellow-200"
            }`}
          >
            <p
              className={`font-semibold text-sm ${
                result.errors.length === 0 ? "text-green-700" : "text-yellow-700"
              }`}
            >
              {result.errors.length === 0 ? "✅ インポート完了" : "⚠️ 一部エラーあり"}
            </p>
            <div className="flex gap-6 mt-2 text-sm text-gray-600">
              <span>
                新規登録:{" "}
                <strong className="text-green-700">{result.imported} 件</strong>
              </span>
              <span>
                更新:{" "}
                <strong className="text-blue-700">{result.updated} 件</strong>
              </span>
              <span>
                エラー:{" "}
                <strong className="text-red-700">{result.errors.length} 件</strong>
              </span>
            </div>
          </div>

          {/* エラー詳細 */}
          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">エラー詳細:</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div
                    key={i}
                    className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-red-600 font-medium">
                      {err.row}行目
                    </span>
                    {err.postId && (
                      <span className="text-gray-500 ml-2">
                        postId: <code>{err.postId}</code>
                      </span>
                    )}
                    <span className="text-red-700 ml-2">— {err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleReset} className="btn-secondary text-sm">
            別のファイルをインポート
          </button>
        </div>
      )}

      {/* インポートボタン */}
      {file && preview && !result && (
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-primary"
          >
            {importing
              ? "インポート中..."
              : `${totalRows} 件をインポートする`}
          </button>
          <button onClick={handleReset} className="btn-secondary">
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
