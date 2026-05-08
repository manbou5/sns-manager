import { NextResponse } from "next/server";
import { fetchTweetData } from "@/lib/tweetFetcher";

export async function POST(req: Request) {
  let url: string;
  try {
    const body = await req.json() as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "url を指定してください" }, { status: 400 });
    }
    url = body.url.trim();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  try {
    const data = await fetchTweetData(url);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
