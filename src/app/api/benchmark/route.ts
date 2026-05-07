import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ベンチマーク投稿一覧取得
// クエリパラメータ: accountName, mediaType, tag
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountName = searchParams.get("accountName");
    const mediaType   = searchParams.get("mediaType");
    const tag         = searchParams.get("tag");

    const posts = await prisma.benchmarkPost.findMany({
      where: {
        ...(accountName ? { accountName: { equals: accountName } } : {}),
        ...(mediaType   ? { mediaType:   { equals: mediaType }   } : {}),
        ...(tag         ? { growthReasonTags: { contains: `|${tag}|` } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(posts);
  } catch (e) {
    console.error("[GET /api/benchmark]", e);
    return NextResponse.json({ error: "ベンチマークデータの取得に失敗しました" }, { status: 500 });
  }
}

// ベンチマーク投稿作成
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      accountName, postUrl, postedAt, bodyText,
      mediaType, videoDuration, compositionNote,
      characterNote, backgroundNote, aiReductionNote,
      likes, reposts, replies, views,
      growthReasonNote, growthReasonTags, applicationNote,
    } = body;

    if (!accountName?.trim()) {
      return NextResponse.json(
        { error: "accountName は必須です" },
        { status: 400 }
      );
    }

    const post = await prisma.benchmarkPost.create({
      data: {
        accountName:     accountName.trim(),
        postUrl:         postUrl?.trim()         || null,
        postedAt:        postedAt ? new Date(postedAt) : null,
        bodyText:        bodyText?.trim()         || null,
        mediaType:       mediaType                ?? "IMAGE",
        videoDuration:   videoDuration?.trim()    || null,
        compositionNote: compositionNote?.trim()  || null,
        characterNote:   characterNote?.trim()    || null,
        backgroundNote:  backgroundNote?.trim()   || null,
        aiReductionNote: aiReductionNote?.trim()  || null,
        likes:           Number(likes)    || 0,
        reposts:         Number(reposts)  || 0,
        replies:         Number(replies)  || 0,
        views:           Number(views)    || 0,
        growthReasonNote: growthReasonNote?.trim() || null,
        growthReasonTags: growthReasonTags         || null,
        applicationNote:  applicationNote?.trim()  || null,
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    console.error("[POST /api/benchmark]", e);
    return NextResponse.json({ error: "ベンチマークデータの作成に失敗しました" }, { status: 500 });
  }
}
