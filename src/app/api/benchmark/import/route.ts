import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCSV, buildColIndex, parseBenchmarkRow, type ParsedBenchmarkRow } from "@/lib/benchmarkCsv";
import type { BenchmarkImportError } from "@/types";

export async function POST(req: NextRequest) {
  // ── ファイル取得
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
    return NextResponse.json({ error: "ファイルの読み込みに失敗しました" }, { status: 400 });
  }

  // ── CSV パース
  const rows = parseCSV(text);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "CSVにデータ行がありません（ヘッダー + 1行以上必要）" },
      { status: 400 }
    );
  }

  // ── ヘッダー検証
  const colIndex = buildColIndex(rows[0]);
  if (!colIndex) {
    return NextResponse.json(
      {
        error: "必須カラムが不足しています",
        hint: "accountName, postUrl, postedAt, bodyText, mediaType, videoDuration, compositionNote, characterNote, aiReductionNote, likes, reposts, replies, views, growthReasonNote, growthReasonTags, applicationNote",
      },
      { status: 400 }
    );
  }

  // ── 行バリデーション
  const errors: BenchmarkImportError[] = [];
  const validRows: (ParsedBenchmarkRow & { _rowNum: number })[] = [];

  for (let i = 1; i < rows.length; i++) {
    const result = parseBenchmarkRow(rows[i], colIndex);
    if (!result.ok) {
      errors.push({
        row: i,
        accountName: rows[i][colIndex.accountName]?.trim() ?? "",
        message: result.errors.join(" / "),
      });
    } else {
      validRows.push({ ...result.data, _rowNum: i });
    }
  }

  if (validRows.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, errors });
  }

  // ── 重複検知（postUrl が同じレコードをスキップ）
  const urlsToCheck = validRows
    .map((r) => r.postUrl)
    .filter((u): u is string => !!u);

  const existingUrls = new Set<string>();
  if (urlsToCheck.length > 0) {
    const existing = await prisma.benchmarkPost.findMany({
      where: { postUrl: { in: urlsToCheck } },
      select: { postUrl: true },
    });
    existing.forEach((e) => { if (e.postUrl) existingUrls.add(e.postUrl); });
  }

  const duplicateErrors: BenchmarkImportError[] = [];
  const newRows: ParsedBenchmarkRow[] = [];

  for (const row of validRows) {
    if (row.postUrl && existingUrls.has(row.postUrl)) {
      duplicateErrors.push({
        row: row._rowNum,
        accountName: row.accountName,
        message: `重複: この投稿URL はすでに登録済みです (${row.postUrl})`,
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _rowNum, ...data } = row;
      newRows.push(data);
    }
  }

  // ── DB 一括作成
  if (newRows.length > 0) {
    try {
      await prisma.benchmarkPost.createMany({ data: newRows });
    } catch (e) {
      console.error("[POST /api/benchmark/import]", e);
      return NextResponse.json({ error: "データの保存に失敗しました" }, { status: 500 });
    }
  }

  const allErrors = [...errors, ...duplicateErrors].sort((a, b) => a.row - b.row);

  return NextResponse.json({
    imported: newRows.length,
    skipped:  duplicateErrors.length,
    errors:   allErrors,
  });
}
