import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decodeTags } from "@/lib/benchmarkCsv";
import type {
  BenchmarkAnalyticsData,
  BenchmarkTagStat,
  BenchmarkAccountStat,
  BenchmarkMediaTypeStat,
  BenchmarkDurationStat,
  MediaType,
} from "@/types";

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function engagementRate(likes: number, reposts: number, replies: number, views: number): number {
  return views > 0 ? ((likes + reposts + replies) / views) * 100 : 0;
}

// 空レスポンス（データ0件時）
function emptyResponse(): BenchmarkAnalyticsData {
  return {
    totalPosts: 0,
    postsWithViews: 0,
    overallAvgViews: 0,
    overallAvgLikes: 0,
    overallAvgEngagementRate: 0,
    tagStats: [],
    accountStats: [],
    mediaTypeStats: [],
    durationStats: [],
  };
}

const MEDIA_LABELS: Record<string, string> = {
  IMAGE: "画像",
  VIDEO: "動画",
  MIXED: "画像+動画",
};

// ─── ルートハンドラー ──────────────────────────────────────────────────────────

export async function GET() {
  try {
  // 集計に必要なフィールドのみ取得（全レコード取得してJS側で集計）
  const posts = await prisma.benchmarkPost.findMany({
    select: {
      accountName:     true,
      mediaType:       true,
      videoDuration:   true,
      likes:           true,
      reposts:         true,
      replies:         true,
      views:           true,
      growthReasonTags: true,
    },
  });

  if (posts.length === 0) {
    return NextResponse.json(emptyResponse());
  }

  // ── サマリー集計 ──────────────────────────────────────────────────────────────
  const postsWithViews = posts.filter((p) => p.views > 0).length;
  const sumViews = posts.reduce((s, p) => s + p.views, 0);
  const sumLikes = posts.reduce((s, p) => s + p.likes, 0);
  const sumER    = posts.reduce(
    (s, p) => s + engagementRate(p.likes, p.reposts, p.replies, p.views),
    0
  );

  const n = posts.length;
  const overallAvgViews          = round1(sumViews / n);
  const overallAvgLikes          = round1(sumLikes / n);
  const overallAvgEngagementRate = round1(sumER / n);

  // ── タグ別集計 ────────────────────────────────────────────────────────────────
  type Accum = { count: number; views: number; likes: number; reposts: number; er: number };
  const tagMap = new Map<string, Accum>();

  for (const post of posts) {
    const tags = decodeTags(post.growthReasonTags);
    const er   = engagementRate(post.likes, post.reposts, post.replies, post.views);

    for (const tag of tags) {
      const prev = tagMap.get(tag) ?? { count: 0, views: 0, likes: 0, reposts: 0, er: 0 };
      tagMap.set(tag, {
        count:   prev.count + 1,
        views:   prev.views   + post.views,
        likes:   prev.likes   + post.likes,
        reposts: prev.reposts + post.reposts,
        er:      prev.er      + er,
      });
    }
  }

  const tagStats: BenchmarkTagStat[] = Array.from(tagMap.entries())
    .map(([tag, acc]) => ({
      tag,
      count:                acc.count,
      avgViews:             round1(acc.views   / acc.count),
      avgLikes:             round1(acc.likes   / acc.count),
      avgReposts:           round1(acc.reposts / acc.count),
      avgEngagementRate:    round1(acc.er      / acc.count),
    }))
    .sort((a, b) => b.avgViews - a.avgViews || b.count - a.count);

  // ── アカウント別集計 ──────────────────────────────────────────────────────────
  type AccumAcc = { count: number; views: number; likes: number; er: number };
  const accountMap = new Map<string, AccumAcc>();

  for (const post of posts) {
    const er   = engagementRate(post.likes, post.reposts, post.replies, post.views);
    const prev = accountMap.get(post.accountName) ?? { count: 0, views: 0, likes: 0, er: 0 };
    accountMap.set(post.accountName, {
      count: prev.count + 1,
      views: prev.views + post.views,
      likes: prev.likes + post.likes,
      er:    prev.er    + er,
    });
  }

  const accountStats: BenchmarkAccountStat[] = Array.from(accountMap.entries())
    .map(([accountName, acc]) => ({
      accountName,
      count:             acc.count,
      avgViews:          round1(acc.views / acc.count),
      avgLikes:          round1(acc.likes / acc.count),
      avgEngagementRate: round1(acc.er    / acc.count),
    }))
    .sort((a, b) => b.avgViews - a.avgViews);

  // ── メディア種別別集計 ────────────────────────────────────────────────────────
  type AccumMedia = { count: number; views: number; likes: number; er: number };
  const mediaMap = new Map<string, AccumMedia>();

  for (const post of posts) {
    const er   = engagementRate(post.likes, post.reposts, post.replies, post.views);
    const prev = mediaMap.get(post.mediaType) ?? { count: 0, views: 0, likes: 0, er: 0 };
    mediaMap.set(post.mediaType, {
      count: prev.count + 1,
      views: prev.views + post.views,
      likes: prev.likes + post.likes,
      er:    prev.er    + er,
    });
  }

  const MEDIA_ORDER = ["IMAGE", "VIDEO", "MIXED"];
  const mediaTypeStats: BenchmarkMediaTypeStat[] = Array.from(mediaMap.entries())
    .map(([mediaType, acc]) => ({
      mediaType: mediaType as MediaType,
      label:     MEDIA_LABELS[mediaType] ?? mediaType,
      count:             acc.count,
      avgViews:          round1(acc.views / acc.count),
      avgLikes:          round1(acc.likes / acc.count),
      avgEngagementRate: round1(acc.er    / acc.count),
    }))
    .sort(
      (a, b) =>
        MEDIA_ORDER.indexOf(a.mediaType) - MEDIA_ORDER.indexOf(b.mediaType)
    );

  // ── 動画尺別集計 ──────────────────────────────────────────────────────────────
  // videoDuration が設定されている投稿のみ対象
  type AccumDur = { count: number; views: number; likes: number };
  const durationMap = new Map<string, AccumDur>();

  for (const post of posts) {
    if (!post.videoDuration?.trim()) continue;
    const key  = post.videoDuration.trim();
    const prev = durationMap.get(key) ?? { count: 0, views: 0, likes: 0 };
    durationMap.set(key, {
      count: prev.count + 1,
      views: prev.views + post.views,
      likes: prev.likes + post.likes,
    });
  }

  const durationStats: BenchmarkDurationStat[] = Array.from(durationMap.entries())
    .map(([videoDuration, acc]) => ({
      videoDuration,
      count:    acc.count,
      avgViews: round1(acc.views / acc.count),
      avgLikes: round1(acc.likes / acc.count),
    }))
    .sort((a, b) => b.avgViews - a.avgViews);

  // ── レスポンス ────────────────────────────────────────────────────────────────
  const result: BenchmarkAnalyticsData = {
    totalPosts: n,
    postsWithViews,
    overallAvgViews,
    overallAvgLikes,
    overallAvgEngagementRate,
    tagStats,
    accountStats,
    mediaTypeStats,
    durationStats,
  };

  return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/benchmark/analytics]", e);
    return NextResponse.json({ error: "ベンチマーク集計の取得に失敗しました" }, { status: 500 });
  }
}
