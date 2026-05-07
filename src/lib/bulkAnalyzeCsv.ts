/**
 * 画像一括解析 → CSV 生成ユーティリティ（クライアント専用）
 *
 * 要件で指定された CSV ヘッダー:
 * postUrl, platform, caption, mediaType, views, likes, comments, shares,
 * saves, followersGained, er, growthReasonMemo, compositionNote, characterNote, backgroundNote
 */

import type { VisionTagResult } from "@/types";

// ─── CSV ヘッダー ─────────────────────────────────────────────────────────────

export const BULK_CSV_HEADERS = [
  "postUrl",
  "platform",
  "caption",
  "mediaType",
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "followersGained",
  "er",
  "growthReasonMemo",
  "compositionNote",
  "characterNote",
  "backgroundNote",
] as const;

export type BulkCsvHeader = (typeof BULK_CSV_HEADERS)[number];

// ─── 型 ──────────────────────────────────────────────────────────────────────

export type BulkAnalyzeRow = {
  filename: string;
  result:   VisionTagResult | null;
};

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function quoteCell(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** ファイル名から拡張子を除いてキャプション用文字列を生成 */
export function filenameToCaption(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")   // 拡張子除去
    .replace(/[-_]+/g, " ")     // ハイフン・アンダースコアをスペースに
    .trim();
}

// ─── CSV 生成 ─────────────────────────────────────────────────────────────────

/**
 * 解析結果配列から CSV 文字列を生成する。
 * 失敗（result=null）の行は除外する。
 * UTF-8 BOM 付き（Excel 対応）。
 */
export function generateBulkAnalyzeCsv(rows: BulkAnalyzeRow[]): string {
  const headerLine = BULK_CSV_HEADERS.join(",");

  const dataLines = rows
    .filter((r): r is BulkAnalyzeRow & { result: VisionTagResult } => r.result !== null)
    .map(({ filename, result }) => {
      const cells: string[] = [
        "",                          // postUrl
        "",                          // platform
        filenameToCaption(filename), // caption
        "IMAGE",                     // mediaType
        "",                          // views
        "",                          // likes
        "",                          // comments
        "",                          // shares
        "",                          // saves
        "",                          // followersGained
        "",                          // er
        result.growthReasonMemo,     // growthReasonMemo
        result.compositionNote,      // compositionNote
        result.characterNote,        // characterNote
        result.backgroundNote,       // backgroundNote
      ];
      return cells.map(quoteCell).join(",");
    });

  return "﻿" + headerLine + "\n" + dataLines.join("\n");
}

// ─── ダウンロード ─────────────────────────────────────────────────────────────

export function downloadCsv(csv: string, filename = "benchmark_analysis.csv"): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
