import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_STATUSES = new Set(["draft", "ready", "scheduled", "posted"]);
const VALID_MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "MIXED"]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const items = await prisma.generatedContent.findMany({
      where: {
        ...(status && VALID_STATUSES.has(status) ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(items);
  } catch (e) {
    console.error("[GET /api/content]", e);
    return NextResponse.json({ error: "コンテンツの取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      prompt,
      caption,
      hashtags,
      mediaType,
      mediaUrl,
      status,
      sourceBenchmarkPostId,
    } = body;

    if (!title?.trim() && !prompt?.trim() && !caption?.trim()) {
      return NextResponse.json(
        { error: "タイトル、プロンプト、キャプションのいずれかを入力してください" },
        { status: 400 }
      );
    }

    const item = await prisma.generatedContent.create({
      data: {
        title:                 title?.trim()    || null,
        prompt:                prompt?.trim()   || null,
        caption:               caption?.trim()  || null,
        hashtags:              hashtags?.trim() || null,
        mediaType:             VALID_MEDIA_TYPES.has(mediaType) ? mediaType : "IMAGE",
        mediaUrl:              mediaUrl?.trim() || null,
        status:                VALID_STATUSES.has(status) ? status : "draft",
        sourceBenchmarkPostId: sourceBenchmarkPostId?.trim() || null,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    console.error("[POST /api/content]", e);
    return NextResponse.json({ error: "コンテンツの作成に失敗しました" }, { status: 500 });
  }
}
