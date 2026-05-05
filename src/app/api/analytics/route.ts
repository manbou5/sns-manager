import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 全分析データ取得（集計用）
export async function GET() {
  try {
    const analytics = await prisma.analytics.findMany({
      include: {
        post: {
          select: {
            id: true,
            title: true,
            genre: true,
            platform: true,
            scheduledAt: true,
            postedAt: true,
            caption: true,
          },
        },
      },
      orderBy: { recordedAt: "desc" },
    });

    return NextResponse.json(analytics);
  } catch (e) {
    console.error("[GET /api/analytics]", e);
    return NextResponse.json({ error: "分析データの取得に失敗しました" }, { status: 500 });
  }
}
