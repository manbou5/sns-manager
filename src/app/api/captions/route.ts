import { NextRequest, NextResponse } from "next/server";
import { generateCaptions } from "@/lib/caption-generator";
import type { Genre } from "@/types";

// キャプション生成API
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { genre, platform } = body as { genre: Genre; platform: string };

  if (!genre) {
    return NextResponse.json({ error: "genreは必須です" }, { status: 400 });
  }

  const suggestions = generateCaptions(genre, platform ?? "X", 3);
  return NextResponse.json({ suggestions });
}
