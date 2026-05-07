import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeInsights } from "@/lib/benchmarkInsights";

export async function GET() {
  try {
    const posts = await prisma.benchmarkPost.findMany({
      select: {
        views:           true,
        likes:           true,
        reposts:         true,
        replies:         true,
        growthReasonTags: true,
      },
    });

    const result = computeInsights(posts);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/benchmark/insights]", e);
    return NextResponse.json(
      { error: "インサイト集計に失敗しました" },
      { status: 500 }
    );
  }
}
