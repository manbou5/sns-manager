import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_STATUSES = new Set(["draft", "ready", "scheduled", "posted"]);
const VALID_MEDIA_TYPES = new Set(["IMAGE", "VIDEO", "MIXED"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const item = await prisma.generatedContent.findUnique({
      where: { id: params.id },
    });
    if (!item) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (e) {
    console.error("[GET /api/content/[id]]", e);
    return NextResponse.json({ error: "コンテンツの取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.generatedContent.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

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

    const item = await prisma.generatedContent.update({
      where: { id: params.id },
      data: {
        ...(title       !== undefined ? { title:       title?.trim()    || null } : {}),
        ...(prompt      !== undefined ? { prompt:      prompt?.trim()   || null } : {}),
        ...(caption     !== undefined ? { caption:     caption?.trim()  || null } : {}),
        ...(hashtags    !== undefined ? { hashtags:    hashtags?.trim() || null } : {}),
        ...(mediaType   !== undefined ? { mediaType:   VALID_MEDIA_TYPES.has(mediaType) ? mediaType : existing.mediaType } : {}),
        ...(mediaUrl    !== undefined ? { mediaUrl:    mediaUrl?.trim() || null } : {}),
        ...(status      !== undefined ? { status:      VALID_STATUSES.has(status) ? status : existing.status } : {}),
        ...(sourceBenchmarkPostId !== undefined
          ? { sourceBenchmarkPostId: sourceBenchmarkPostId?.trim() || null }
          : {}),
      },
    });

    return NextResponse.json(item);
  } catch (e) {
    console.error("[PATCH /api/content/[id]]", e);
    return NextResponse.json({ error: "コンテンツの更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existing = await prisma.generatedContent.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    await prisma.generatedContent.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/content/[id]]", e);
    return NextResponse.json({ error: "コンテンツの削除に失敗しました" }, { status: 500 });
  }
}
