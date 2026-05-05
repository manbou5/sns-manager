import { NextResponse } from "next/server";
import { seedDevData, clearDevData, getDataCounts } from "@/lib/devSeed";

function devOnly() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "このエンドポイントは開発環境専用です" },
      { status: 403 }
    );
  }
  return null;
}

export async function GET() {
  const guard = devOnly();
  if (guard) return guard;
  try {
    const counts = await getDataCounts();
    return NextResponse.json({ counts });
  } catch (e) {
    console.error("[GET /api/dev/seed]", e);
    return NextResponse.json({ error: "データ件数の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST() {
  const guard = devOnly();
  if (guard) return guard;
  try {
    const result = await seedDevData();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    console.error("[POST /api/dev/seed]", e);
    return NextResponse.json({ ok: false, message: "サンプルデータの投入に失敗しました" }, { status: 500 });
  }
}

export async function DELETE() {
  const guard = devOnly();
  if (guard) return guard;
  try {
    const result = await clearDevData();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[DELETE /api/dev/seed]", e);
    return NextResponse.json({ ok: false, message: "データの削除に失敗しました" }, { status: 500 });
  }
}
