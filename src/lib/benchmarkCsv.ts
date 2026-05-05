/**
 * ベンチマーク分析 CSV ユーティリティ
 * - RFC 4180 準拠 CSV パーサー（フィールド内カンマ・改行・ダブルクォートに対応）
 * - タグ エンコード / デコード ユーティリティ
 * - サンプル CSV 生成
 *
 * このファイルはサーバー・クライアント両側から import できる（Prisma 等の依存なし）
 */

// ─── CSV パーサー ──────────────────────────────────────────────────────────────

/**
 * RFC 4180 準拠 CSV パーサー
 * - UTF-8 BOM 除去
 * - \r\n / \r / \n を統一
 * - "" によるダブルクォートエスケープに対応
 * - フィールド内改行に対応（ダブルクォート囲み必須）
 */
export function parseCSV(rawText: string): string[][] {
  const text = rawText
    .replace(/^﻿/, "") // UTF-8 BOM 除去
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // "" → " (エスケープされたクォート)
        cell += '"';
        i += 2;
      } else {
        inQuotes = !inQuotes;
        i++;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      i++;
    } else if (ch === "\n" && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c !== "")) {
        rows.push(row);
      }
      row = [];
      i++;
    } else {
      cell += ch;
      i++;
    }
  }

  // 最終行の処理（末尾に改行がない場合）
  row.push(cell.trim());
  if (row.some((c) => c !== "")) {
    rows.push(row);
  }

  return rows;
}

// ─── タグ ユーティリティ ───────────────────────────────────────────────────────

/**
 * タグ配列を DB 保存用文字列にエンコード
 * ["構図", "表情"] → "|構図|表情|"
 * [] → null
 */
export function encodeTags(tags: string[]): string | null {
  const cleaned = tags.map((t) => t.trim()).filter(Boolean);
  return cleaned.length > 0 ? `|${cleaned.join("|")}|` : null;
}

/**
 * DB 保存用文字列をタグ配列にデコード
 * "|構図|表情|" → ["構図", "表情"]
 * null → []
 */
export function decodeTags(encoded: string | null | undefined): string[] {
  if (!encoded) return [];
  return encoded.split("|").filter(Boolean);
}

/**
 * CSV の "|" 区切りタグ文字列をタグ配列に変換（CSV 読み取り時）
 * "構図|表情" → ["構図", "表情"]
 */
export function parseTagsFromCsv(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ─── CSV ヘッダー定義 ──────────────────────────────────────────────────────────

export const BENCHMARK_CSV_HEADERS = [
  "accountName",
  "postUrl",
  "postedAt",
  "bodyText",
  "mediaType",
  "videoDuration",
  "compositionNote",
  "characterNote",
  "aiReductionNote",
  "likes",
  "reposts",
  "replies",
  "views",
  "growthReasonNote",
  "growthReasonTags",
  "applicationNote",
] as const;

export type BenchmarkCsvHeader = (typeof BENCHMARK_CSV_HEADERS)[number];

// ─── 行パーサー ────────────────────────────────────────────────────────────────

type ColIndex = Record<BenchmarkCsvHeader, number>;

/** ヘッダー行からカラムインデックスマップを構築 */
export function buildColIndex(headerRow: string[]): ColIndex | null {
  const lower = headerRow.map((h) => h.toLowerCase());
  const result = {} as ColIndex;
  for (const h of BENCHMARK_CSV_HEADERS) {
    const idx = lower.indexOf(h.toLowerCase());
    if (idx === -1) return null;
    result[h] = idx;
  }
  return result;
}

export type ParsedBenchmarkRow = {
  accountName: string;
  postUrl: string | null;
  postedAt: Date | null;
  bodyText: string | null;
  mediaType: string;
  videoDuration: string | null;
  compositionNote: string | null;
  characterNote: string | null;
  aiReductionNote: string | null;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  growthReasonNote: string | null;
  growthReasonTags: string | null;
  applicationNote: string | null;
};

export type RowParseResult =
  | { ok: true; data: ParsedBenchmarkRow }
  | { ok: false; errors: string[] };

/** 0以上の整数を返す。空文字は0扱い。不正な値は null */
function parseNum(value: string): number | null {
  if (value === "") return 0;
  if (!/^\d+$/.test(value)) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 日付文字列を Date に変換 */
function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const VALID_MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "MIXED"]);

/** 1行のデータをバリデーション・変換する */
export function parseBenchmarkRow(
  cells: string[],
  col: ColIndex
): RowParseResult {
  const get = (h: BenchmarkCsvHeader) => cells[col[h]]?.trim() ?? "";

  const errors: string[] = [];

  const accountName = get("accountName");
  if (!accountName) errors.push("accountName が空です");

  const mediaTypeRaw = get("mediaType").toUpperCase() || "IMAGE";
  const mediaType = VALID_MEDIA_TYPES.has(mediaTypeRaw) ? mediaTypeRaw : "IMAGE";

  const numFields = ["likes", "reposts", "replies", "views"] as const;
  const nums: Record<string, number> = {};
  for (const f of numFields) {
    const n = parseNum(get(f));
    if (n === null) {
      errors.push(`${f} が無効な値です ("${get(f)}")`);
    } else {
      nums[f] = n;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const rawTags = parseTagsFromCsv(get("growthReasonTags"));

  return {
    ok: true,
    data: {
      accountName,
      postUrl: get("postUrl") || null,
      postedAt: parseDate(get("postedAt")),
      bodyText: get("bodyText") || null,
      mediaType,
      videoDuration: get("videoDuration") || null,
      compositionNote: get("compositionNote") || null,
      characterNote: get("characterNote") || null,
      aiReductionNote: get("aiReductionNote") || null,
      likes: nums.likes,
      reposts: nums.reposts,
      replies: nums.replies,
      views: nums.views,
      growthReasonNote: get("growthReasonNote") || null,
      growthReasonTags: encodeTags(rawTags),
      applicationNote: get("applicationNote") || null,
    },
  };
}

// ─── サンプル CSV 生成 ─────────────────────────────────────────────────────────

function quoteCell(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateBenchmarkSampleCsv(): string {
  const headers = BENCHMARK_CSV_HEADERS.join(",");
  const rows = [
    [
      "@sample_account",
      "https://x.com/sample/status/123456789",
      "2025-06-12 20:00",
      "今日のコーデ🌸 シンプルだけど特別な一日。",
      "IMAGE",
      "",
      "縦構図・顔アップで視線誘導",
      "ショートヘア・白ワンピース・青空背景",
      "髪の毛に細かいハイライトを追加",
      "1500",
      "80",
      "20",
      "35000",
      "顔のアップが効果的。投稿時間も良かった。",
      "構図|表情",
      "同じ構図で夕方バージョンを試す",
    ],
    [
      "@another_account",
      "https://x.com/another/status/987654321",
      "2025-06-10 12:00",
      "夏の光の中で🌞 風が気持ちよかった一日。",
      "VIDEO",
      "6秒",
      "縦パン→顔アップのカメラワーク",
      "ロングヘア・水着風・海辺",
      "水面の反射を追加してリアリティUP",
      "3200",
      "150",
      "45",
      "98000",
      "動画テンポが良く最後まで見られた",
      "動画テンポ|カメラワーク|背景",
      "同様のカメラワークで室内バージョンを作成",
    ],
  ];

  const lines = rows
    .map((row) => row.map(quoteCell).join(","))
    .join("\n");

  // Excel対応のためUTF-8 BOMを付与
  return "﻿" + headers + "\n" + lines;
}
