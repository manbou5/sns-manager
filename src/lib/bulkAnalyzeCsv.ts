/**
 * 画像一括解析 → CSV 生成ユーティリティ（クライアント専用）
 *
 * CSV ヘッダー（固定順）:
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
  filename:          string;
  caption?:          string;
  postUrl?:          string;
  platform?:         string;
  mediaType?:        string;
  views?:            number | null;
  likes?:            number | null;
  comments?:         number | null;
  shares?:           number | null;
  saves?:            number | null;
  followersGained?:  number | null;
  result:            VisionTagResult | null;
};

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function quoteCell(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function numCell(v: number | null | undefined): string {
  return v != null ? String(v) : "";
}

/** ファイル名から拡張子を除いてキャプション用文字列を生成 */
export function filenameToCaption(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

/**
 * ER を計算する。
 * views がある場合: (likes + comments + shares + saves) / views * 100
 * views がない場合: "" を返す
 */
function calcEr(row: BulkAnalyzeRow): string {
  const { views, likes, comments, shares, saves } = row;
  if (views == null || views === 0) return "";
  const engagement =
    (likes   ?? 0) +
    (comments ?? 0) +
    (shares   ?? 0) +
    (saves    ?? 0);
  return ((engagement / views) * 100).toFixed(2);
}

// ─── CSV 生成 ─────────────────────────────────────────────────────────────────

/**
 * 解析結果配列から CSV 文字列を生成する。
 * result=null の行は除外する。
 * UTF-8 BOM 付き（Excel 対応）。
 */
export function generateBulkAnalyzeCsv(rows: BulkAnalyzeRow[]): string {
  const headerLine = BULK_CSV_HEADERS.join(",");

  const dataLines = rows
    .filter((r): r is BulkAnalyzeRow & { result: VisionTagResult } => r.result !== null)
    .map((row) => {
      const {
        filename, caption, postUrl, platform, mediaType,
        views, likes, comments, shares, saves, followersGained,
        result,
      } = row;

      const cells: string[] = [
        postUrl  ?? "",
        platform ?? "",
        caption  ?? filenameToCaption(filename),
        mediaType ?? "IMAGE",
        numCell(views),
        numCell(likes),
        numCell(comments),
        numCell(shares),
        numCell(saves),
        numCell(followersGained),
        calcEr(row),
        result.growthReasonMemo,
        result.compositionNote,
        result.characterNote,
        result.backgroundNote,
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
