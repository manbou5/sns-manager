import { NextRequest, NextResponse } from "next/server";
import { analyzeImages }             from "@/lib/visionTagger";
import { prisma }                    from "@/lib/db";
import type { VisionTagBatchItem }   from "@/types";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE_MB  = 10;
const MAX_FILES    = 10;

/**
 * POST /api/benchmark/vision-tag
 *
 * multipart/form-data:
 *   images[]         — 画像ファイル (1〜10 枚)
 *   benchmarkPostId  — (任意) 単枚解析時に結果を自動保存する対象 ID
 */
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が設定されていません。.env を確認してください。" },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart フォームの解析に失敗しました" }, { status: 400 });
  }

  const benchmarkPostId = formData.get("benchmarkPostId") as string | null;
  const rawFiles        = formData.getAll("images");
  const files           = rawFiles.filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "画像ファイルを 1 枚以上添付してください" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `一度に処理できるのは ${MAX_FILES} 枚までです` },
      { status: 400 }
    );
  }

  // 検証 & base64 変換
  const images: { base64: string; mimeType: string; name: string }[] = [];
  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `非対応の形式です: ${file.name} (${file.type || "不明"})` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `${file.name} が ${MAX_SIZE_MB}MB を超えています` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    images.push({ base64: buffer.toString("base64"), mimeType: file.type, name: file.name });
  }

  // AI 解析
  let rawResults: Awaited<ReturnType<typeof analyzeImages>>;
  try {
    rawResults = await analyzeImages(images.map(({ base64, mimeType }) => ({ base64, mimeType })));
  } catch (e) {
    console.error("[vision-tag] analyzeImages error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 解析中にエラーが発生しました" },
      { status: 500 }
    );
  }

  // レスポンス整形
  const results: VisionTagBatchItem[] = rawResults.map((r) => ({
    index:    r.index,
    filename: images[r.index]?.name ?? `image_${r.index + 1}`,
    result:   r.result,
    error:    r.error,
  }));

  // benchmarkPostId が指定されており、単枚で成功した場合は自動保存
  if (benchmarkPostId && results.length === 1 && results[0].result) {
    const r = results[0].result;
    try {
      await prisma.benchmarkPost.update({
        where: { id: benchmarkPostId },
        data: {
          growthReasonNote: r.growthReasonMemo || undefined,
          compositionNote:  r.compositionNote  || undefined,
          characterNote:    r.characterNote    || undefined,
          backgroundNote:   r.backgroundNote   || undefined,
        },
      });
    } catch (e) {
      console.error("[vision-tag] DB 保存エラー:", e);
      // 保存失敗でも解析結果は返す
    }
  }

  return NextResponse.json({ results });
}
