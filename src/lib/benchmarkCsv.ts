/**
 * ベンチマーク分析 CSV ユーティリティ
 * - RFC 4180 準拠 CSV パーサー
 * - タグ エンコード / デコード ユーティリティ
 * - サンプル CSV 生成
 *
 * CSV ヘッダー仕様は一括解析CSV（bulkAnalyzeCsv.ts）と統一されています。
 * このファイルはサーバー・クライアント両側から import できます（Prisma 等の依存なし）。
 */

// ─── CSV パーサー ──────────────────────────────────────────────────────────────

/**
 * RFC 4180 準拠 CSV パーサー
 * - UTF-8 BOM 除去 / \r\n 統一
 * - "" によるダブルクォートエスケープに対応
 * - フィールド内改行に対応（ダブルクォート囲み必須）
 */
export function parseCSV(rawText: string): string[][] {
  const text = rawText
    .replace(/^﻿/, "")
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
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      i++;
    } else {
      cell += ch;
      i++;
    }
  }

  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);

  return rows;
}

// ─── タグ自動提案 ──────────────────────────────────────────────────────────────

export function suggestTagsFromContent(caption: string, mediaType: string): string[] {
  const suggested = new Set<string>();
  const t = caption.toLowerCase();

  if (/服|ドレス|コーデ|ファッション|衣装|ワンピ|スカート|水着|outfit/.test(t)) suggested.add("服装");
  if (/笑|嬉し|喜び|微笑|スマイル|表情|顔アップ|かわい|cute/.test(t))         suggested.add("表情");
  if (/背景|ロケ|屋外|屋内|スタジオ|海|山|街|空|夕焼け|夜景|室内|公園/.test(t)) suggested.add("背景");
  if (/構図|アングル|フレーミング|ポーズ|俯瞰|ローアングル|アップ/.test(t))    suggested.add("構図");
  if (caption.length > 30 || /[？?！!]/.test(caption))                        suggested.add("キャプション");
  if (/#/.test(caption))                                                        suggested.add("ハッシュタグ");
  if (mediaType === "VIDEO" || mediaType === "MIXED") {
    suggested.add("動画テンポ");
    suggested.add("カメラワーク");
  }

  return Array.from(suggested);
}

// ─── タグ ユーティリティ ───────────────────────────────────────────────────────

/** タグ配列を DB 保存用文字列にエンコード: ["構図", "表情"] → "|構図|表情|" */
export function encodeTags(tags: string[]): string | null {
  const cleaned = tags.map((t) => t.trim()).filter(Boolean);
  return cleaned.length > 0 ? `|${cleaned.join("|")}|` : null;
}

/** DB 保存用文字列をタグ配列にデコード: "|構図|表情|" → ["構図", "表情"] */
export function decodeTags(encoded: string | null | undefined): string[] {
  if (!encoded) return [];
  return encoded.split("|").filter(Boolean);
}

/** CSV の "|" 区切りタグ文字列をタグ配列に変換 */
export function parseTagsFromCsv(value: string): string[] {
  if (!value.trim()) return [];
  return value.split("|").map((t) => t.trim()).filter(Boolean);
}

// ─── CSV ヘッダー定義 ──────────────────────────────────────────────────────────
//
// 一括解析 CSV（bulkAnalyzeCsv.ts）と共通の 15 列を先頭に置き、
// ベンチマーク専用の任意列を後半に並べる。
//
// 列名変更（旧 → 新）:
//   bodyText        → caption
//   reposts         → shares
//   replies         → comments
//   growthReasonNote → growthReasonMemo

export const BENCHMARK_CSV_HEADERS = [
  // ── 一括解析CSVと共通（必須 11列 + 任意 4列）
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
  // ── ベンチマーク専用（すべて任意）
  "accountName",
  "postedAt",
  "videoDuration",
  "aiReductionNote",
  "growthReasonTags",
  "applicationNote",
] as const;

export type BenchmarkCsvHeader = (typeof BENCHMARK_CSV_HEADERS)[number];

// ─── 必須カラム ────────────────────────────────────────────────────────────────

const REQUIRED_COLS: BenchmarkCsvHeader[] = [
  "postUrl",
  "caption",
  "mediaType",
  "views",
  "likes",
  "comments",
  "shares",
  "growthReasonMemo",
  "compositionNote",
  "characterNote",
  "backgroundNote",
];

// ─── カラムインデックス構築 ────────────────────────────────────────────────────

/** ヘッダー行からカラムインデックスマップを構築する。必須列が不足している場合は null を返す。 */
export function buildColIndex(
  headerRow: string[]
): Record<BenchmarkCsvHeader, number> | null {
  const lower = headerRow.map((h) => h.toLowerCase());

  const missing = REQUIRED_COLS.filter((h) => !lower.includes(h.toLowerCase()));
  if (missing.length > 0) return null;

  const result = {} as Record<BenchmarkCsvHeader, number>;
  for (const h of BENCHMARK_CSV_HEADERS) {
    result[h] = lower.indexOf(h.toLowerCase()); // 任意列が無い場合は -1
  }
  return result;
}

/** 不足している必須カラム名を返す（エラーメッセージ用） */
export function getMissingRequiredCols(headerRow: string[]): string[] {
  const lower = headerRow.map((h) => h.toLowerCase());
  return REQUIRED_COLS.filter((h) => !lower.includes(h.toLowerCase()));
}

// ─── 行パーサー ────────────────────────────────────────────────────────────────

export type ParsedBenchmarkRow = {
  accountName:     string;
  postUrl:         string | null;
  postedAt:        Date | null;
  bodyText:        string | null;  // CSV: caption
  mediaType:       string;
  videoDuration:   string | null;
  compositionNote: string | null;
  characterNote:   string | null;
  backgroundNote:  string | null;
  aiReductionNote: string | null;
  likes:           number;
  reposts:         number;         // CSV: shares
  replies:         number;         // CSV: comments
  views:           number;
  growthReasonNote: string | null; // CSV: growthReasonMemo
  growthReasonTags: string | null;
  applicationNote: string | null;
};

export type RowParseResult =
  | { ok: true;  data: ParsedBenchmarkRow }
  | { ok: false; errors: string[] };

function parseNum(value: string): number | null {
  if (value === "") return 0;
  if (!/^\d+$/.test(value)) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const VALID_MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "MIXED"]);

/**
 * 1行のデータをバリデーション・変換する。
 *
 * CSV 列名 → DB フィールド名 マッピング:
 *   caption          → bodyText
 *   shares           → reposts
 *   comments         → replies
 *   growthReasonMemo → growthReasonNote
 */
export function parseBenchmarkRow(
  cells: string[],
  col: Record<BenchmarkCsvHeader, number>
): RowParseResult {
  const get = (h: BenchmarkCsvHeader): string => {
    const idx = col[h];
    return idx >= 0 ? (cells[idx]?.trim() ?? "") : "";
  };

  const errors: string[] = [];

  const accountName  = get("accountName") || "";
  const mediaTypeRaw = get("mediaType").toUpperCase() || "IMAGE";
  const mediaType    = VALID_MEDIA_TYPES.has(mediaTypeRaw) ? mediaTypeRaw : "IMAGE";

  // 数値フィールド（新列名で読む）
  const numFields: { col: BenchmarkCsvHeader; label: string }[] = [
    { col: "likes",    label: "likes"    },
    { col: "comments", label: "comments" },
    { col: "shares",   label: "shares"   },
    { col: "views",    label: "views"    },
  ];
  const nums: Record<string, number> = {};
  for (const { col: c, label } of numFields) {
    const n = parseNum(get(c));
    if (n === null) {
      errors.push(`${label} が無効な値です ("${get(c)}")`);
    } else {
      nums[label] = n;
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  // growthReasonTags: 任意。空の場合は caption + mediaType からルールベースで提案
  const rawTags  = parseTagsFromCsv(get("growthReasonTags"));
  const finalTags = rawTags.length > 0
    ? rawTags
    : suggestTagsFromContent(get("caption"), mediaType);

  return {
    ok: true,
    data: {
      accountName,
      postUrl:          get("postUrl")        || null,
      postedAt:         parseDate(get("postedAt")),
      bodyText:         get("caption")        || null,   // caption → bodyText (DB)
      mediaType,
      videoDuration:    get("videoDuration")  || null,
      compositionNote:  get("compositionNote") || null,
      characterNote:    get("characterNote")  || null,
      backgroundNote:   get("backgroundNote") || null,
      aiReductionNote:  get("aiReductionNote") || null,
      likes:            nums.likes,
      reposts:          nums.shares,    // shares   → reposts (DB)
      replies:          nums.comments,  // comments → replies (DB)
      views:            nums.views,
      growthReasonNote: get("growthReasonMemo") || null, // growthReasonMemo → growthReasonNote (DB)
      growthReasonTags: encodeTags(finalTags),
      applicationNote:  get("applicationNote") || null,
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

  // 列順: postUrl,platform,caption,mediaType,views,likes,comments,shares,saves,
  //       followersGained,er,growthReasonMemo,compositionNote,characterNote,backgroundNote,
  //       accountName,postedAt,videoDuration,aiReductionNote,growthReasonTags,applicationNote
  const rows = [
    [
      "https://x.com/sample/status/123456789",
      "X",
      "今日のコーデ🌸 シンプルだけど特別な一日。",
      "IMAGE",
      "35000",
      "1500",
      "20",
      "80",
      "",
      "",
      "",
      "顔のアップが効果的。投稿時間も良かった。",
      "縦構図・顔アップで視線誘導",
      "ショートヘア・白ワンピース・笑顔",
      "白基調のカフェ・自然光・ボケ背景",
      "@sample_account",
      "2025-06-12 20:00",
      "",
      "髪の毛に細かいハイライトを追加",
      "構図|表情",
      "同じ構図で夕方バージョンを試す",
    ],
    [
      "https://x.com/another/status/987654321",
      "X",
      "夏の光の中で🌞 風が気持ちよかった一日。",
      "VIDEO",
      "98000",
      "3200",
      "45",
      "150",
      "",
      "",
      "",
      "動画テンポが良く最後まで見られた",
      "縦パン→顔アップのカメラワーク",
      "ロングヘア・水着風・明るい笑顔",
      "海辺・水面の反射・自然光・開放感",
      "@another_account",
      "2025-06-10 12:00",
      "6秒",
      "水面の反射を追加してリアリティUP",
      "動画テンポ|カメラワーク|背景",
      "同様のカメラワークで室内バージョンを作成",
    ],
  ];

  const lines = rows.map((row) => row.map(quoteCell).join(",")).join("\n");
  return "﻿" + headers + "\n" + lines;
}
