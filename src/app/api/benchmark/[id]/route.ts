import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { id: string } };

// ベンチマーク投稿 詳細取得
export async function GET(_: NextRequest, { params }: Params) {
  try {
    const post = await prisma.benchmarkPost.findUnique({
      where: { id: params.id },
    });
    if (!post) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    return NextResponse.json(post);
  } catch (e) {
    console.error("[GET /api/benchmark/[id]]", e);
    return NextResponse.json({ error: "ベンチマーク投稿の取得に失敗しました" }, { status: 500 });
  }
}

// ベンチマーク投稿 更新
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const exists = await prisma.benchmarkPost.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }

    const body = await req.json();

    const {
      accountName, postUrl, postedAt, bodyText,
      mediaType, videoDuration, compositionNote,
      characterNote, aiReductionNote,
      likes, reposts, replies, views,
      growthReasonNote, growthReasonTags, applicationNote,
    } = body;

    if (accountName !== undefined && !accountName?.trim()) {
      return NextResponse.json(
        { error: "accountName は空にできません" },
        { status: 400 }
      );
    }

    const updated = await prisma.benchmarkPost.update({
      where: { id: params.id },
      data: {
        ...(accountName     !== undefined ? { accountName:     accountName.trim()       } : {}),
        ...(postUrl         !== undefined ? { postUrl:         postUrl?.trim() || null  } : {}),
        ...(postedAt        !== undefined ? { postedAt:        postedAt ? new Date(postedAt) : null } : {}),
        ...(bodyText        !== undefined ? { bodyText:        bodyText?.trim() || null } : {}),
        ...(mediaType       !== undefined ? { mediaType                                 } : {}),
        ...(videoDuration   !== undefined ? { videoDuration:   videoDuration?.trim() || null } : {}),
        ...(compositionNote !== undefined ? { compositionNote: compositionNote?.trim() || null } : {}),
        ...(characterNote   !== undefined ? { characterNote:   characterNote?.trim() || null   } : {}),
        ...(aiReductionNote !== undefined ? { aiReductionNote: aiReductionNote?.trim() || null } : {}),
        ...(likes    !== undefined ? { likes:    Number(likes)    || 0 } : {}),
        ...(reposts  !== undefined ? { reposts:  Number(reposts)  || 0 } : {}),
        ...(replies  !== undefined ? { replies:  Number(replies)  || 0 } : {}),
        ...(views    !== undefined ? { views:    Number(views)    || 0 } : {}),
        ...(growthReasonNote !== undefined ? { growthReasonNote: growthReasonNote?.trim() || null } : {}),
        ...(growthReasonTags !== undefined ? { growthReasonTags: growthReasonTags || null        } : {}),
        ...(applicationNote  !== undefined ? { applicationNote:  applicationNote?.trim() || null  } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/benchmark/[id]]", e);
    return NextResponse.json({ error: "ベンチマーク投稿の更新に失敗しました" }, { status: 500 });
  }
}

// ベンチマーク投稿 削除
export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const exists = await prisma.benchmarkPost.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    }
    await prisma.benchmarkPost.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/benchmark/[id]]", e);
    return NextResponse.json({ error: "ベンチマーク投稿の削除に失敗しました" }, { status: 500 });
  }
}
