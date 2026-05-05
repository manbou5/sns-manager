import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseCSV, buildColIndex, parseBenchmarkRow, type ParsedBenchmarkRow } from "@/lib/benchmarkCsv";
import type { BenchmarkImportError } from "@/types";

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

  // ── CSV パース ──
  const rows = parseCSV(text);
  if (rows.length < 2) {
    return NextResponse.json(
      { error: "CSVにデータ行がありません（ヘッダー + 1行以上必要）" },
      { status: 400 }
    );
  }

  // ── ヘッダー検証 ──
  const colIndex = buildColIndex(rows[0]);
  if (!colIndex) {
    return NextResponse.json(
      {
        error: "必須カラムが不足しています",
        hint: `必要なカラム: accountName, postUrl, postedAt, bodyText, mediaType, videoDuration, compositionNote, characterNote, aiReductionNote, likes, reposts, replies, views, growthReasonNote, growthReasonTags, applicationNote`,
      },
      { status: 400 }
    );
  }

  // ── 行バリデーション ──
  const errors: BenchmarkImportError[] = [];
  const validRows: ParsedBenchmarkRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rowNum = i;
    const result = parseBenchmarkRow(rows[i], colIndex);
    if (!result.ok) {
      errors.push({
        row: rowNum,
        accountName: rows[i][colIndex.accountName]?.trim() ?? "",
        message: result.errors.join(" / "),
      });
    } else {
      validRows.push(result.data);
    }
  }

  if (validRows.length === 0) {
    return NextResponse.json({ imported: 0, errors });
  }

  // ── DB 一括作成（各行が新規レコード）──
  try {
    await prisma.benchmarkPost.createMany({ data: validRows });
  } catch (e) {
    console.error("[POST /api/benchmark/import]", e);
    return NextResponse.json({ error: "データの保存に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    imported: validRows.length,
    errors: errors.sort((a, b) => a.row - b.row),
  });
}
