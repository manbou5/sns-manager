import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ─── 型定義 ────────────────────────────────────────────────────────────────────

interface ImportRowError {
  row: number;
  postId: string;
  message: string;
}

interface ValidatedRow {
  rowNum: number;
  postId: string;
  impressions: number;
  likes: number;
  reposts: number;
  clicks: number;
  followerGain: number;
}

// ─── ユーティリティ ────────────────────────────────────────────────────────────

// BOM除去 + 改行正規化してから行分割
function splitCSVLines(text: string): string[] {
  return text
    .replace(/^﻿/, "")   // UTF-8 BOM (Excelからの出力対策)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// カンマ区切りで分割（クォート除去）
function splitCSVRow(line: string): string[] {
  return line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
}

// 0以上の整数ならその値を、それ以外は null を返す
function toNonNegativeInt(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = parseInt(value.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ─── ルートハンドラー ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── ファイル取得 ──
  let text: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "CSVファイルが見つかりません (fieldname: file)" },
        { status: 400 }
      );
    }
    text = await (file as File).text();
  } catch {
    return NextResponse.json(
      { error: "ファイルの読み込みに失敗しました" },
      { status: 400 }
    );
  }

  // ── パース ──
  const lines = splitCSVLines(text);
  if (lines.length < 2) {
    return NextResponse.json(
      { error: "CSVにデータ行がありません。ヘッダー行 + 1行以上必要です。" },
      { status: 400 }
    );
  }

  const headers = splitCSVRow(lines[0]).map((h) => h.toLowerCase());

  // ベンチマーク CSV の誤アップロード検出
  const BENCHMARK_MARKERS = ["posturl", "growthreasonmemo"];
  if (BENCHMARK_MARKERS.some((m) => headers.includes(m))) {
    return NextResponse.json(
      {
        error:
          "このCSVはベンチマーク用です。/benchmark のCSVインポートで読み込んでください。",
        benchmarkCsv: true,
      },
      { status: 400 }
    );
  }

  // 必須カラムの存在確認
  const REQUIRED = ["postid", "impressions", "likes", "reposts", "clicks", "followersgained"];
  const missing = REQUIRED.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `必須カラムが不足しています: ${missing.join(", ")}`,
        hint: "ヘッダー行: postId,impressions,likes,reposts,clicks,followersGained",
      },
      { status: 400 }
    );
  }

  // カラムインデックスマップ
  const col = {
    postId:         headers.indexOf("postid"),
    impressions:    headers.indexOf("impressions"),
    likes:          headers.indexOf("likes"),
    reposts:        headers.indexOf("reposts"),
    clicks:         headers.indexOf("clicks"),
    followersGained: headers.indexOf("followersgained"),
  };

  // ── 行バリデーション ──
  const parseErrors: ImportRowError[] = [];
  // postId → 最後に登場した行データ（重複は後勝ち）
  const candidateMap = new Map<string, ValidatedRow>();

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVRow(lines[i]);
    const rowNum = i; // ヘッダーを 0 として、データは 1 始まり
    const postId = cells[col.postId]?.trim() ?? "";

    if (!postId) {
      parseErrors.push({ row: rowNum, postId: "", message: "postIdが空です" });
      continue;
    }

    // 数値フィールドバリデーション
    const numericFields = [
      { label: "impressions",    value: cells[col.impressions]    ?? "" },
      { label: "likes",          value: cells[col.likes]          ?? "" },
      { label: "reposts",        value: cells[col.reposts]        ?? "" },
      { label: "clicks",         value: cells[col.clicks]         ?? "" },
      { label: "followersGained", value: cells[col.followersGained] ?? "" },
    ];

    const fieldErrors: string[] = [];
    const nums: Record<string, number> = {};
    for (const { label, value } of numericFields) {
      const n = toNonNegativeInt(value);
      if (n === null) {
        fieldErrors.push(`${label} が無効な値です ("${value || "空"}")`);
      } else {
        nums[label] = n;
      }
    }

    if (fieldErrors.length > 0) {
      parseErrors.push({ row: rowNum, postId, message: fieldErrors.join(" / ") });
      continue;
    }

    candidateMap.set(postId, {
      rowNum,
      postId,
      impressions:  nums.impressions,
      likes:        nums.likes,
      reposts:      nums.reposts,
      clicks:       nums.clicks,
      followerGain: nums.followersGained,
    });
  }

  if (candidateMap.size === 0) {
    return NextResponse.json({ imported: 0, updated: 0, errors: parseErrors });
  }

  // ── postId 存在確認（一括クエリ）──
  const candidateIds = Array.from(candidateMap.keys());
  const existingPosts = await prisma.post.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true },
  });
  const validPostIdSet = new Set(existingPosts.map((p) => p.id));

  const upsertRows: ValidatedRow[] = [];
  for (const [postId, row] of Array.from(candidateMap.entries())) {
    if (!validPostIdSet.has(postId)) {
      parseErrors.push({ row: row.rowNum, postId, message: "存在しない postId です" });
    } else {
      upsertRows.push(row);
    }
  }

  // ── upsert 実行 ──
  let imported = 0;
  let updated = 0;

  // 既存の analytics を一括確認
  const existingAnalytics = await prisma.analytics.findMany({
    where: { postId: { in: upsertRows.map((r) => r.postId) } },
    select: { postId: true },
  });
  const existingAnalyticsSet = new Set(existingAnalytics.map((a) => a.postId));

  await prisma.$transaction(
    upsertRows.map((row) =>
      prisma.analytics.upsert({
        where: { postId: row.postId },
        create: {
          postId:      row.postId,
          impressions: row.impressions,
          likes:       row.likes,
          reposts:     row.reposts,
          clicks:      row.clicks,
          followerGain: row.followerGain,
        },
        update: {
          impressions: row.impressions,
          likes:       row.likes,
          reposts:     row.reposts,
          clicks:      row.clicks,
          followerGain: row.followerGain,
          updatedAt:   new Date(),
        },
      })
    )
  );

  for (const row of upsertRows) {
    if (existingAnalyticsSet.has(row.postId)) updated++;
    else imported++;
  }

  return NextResponse.json({
    imported,
    updated,
    errors: parseErrors.sort((a, b) => a.row - b.row),
  });
}
