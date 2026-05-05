import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LearningDashboardData } from "@/types";

type Metric = {
  id: string;
  followersGained: number;
  engagementRate: number;
  views: number;
  likes: number;
  measuredAt: Date;
  postQueue: {
    id: string;
    platform: string;
    generatedContent: {
      id: string;
      title: string | null;
      caption: string | null;
      prompt: string | null;
      mediaType: string;
    };
  };
};

type Acc = { count: number; sumViews: number; sumLikes: number; sumER: number };

export async function GET() {
  try {
  const metrics: Metric[] = await prisma.performanceMetric.findMany({
    include: {
      postQueue: {
        select: {
          id: true,
          platform: true,
          generatedContent: {
            select: {
              id: true,
              title: true,
              caption: true,
              prompt: true,
              mediaType: true,
            },
          },
        },
      },
    },
    orderBy: { engagementRate: "desc" },
  });

  const n = metrics.length;
  if (n === 0) {
    const empty: LearningDashboardData = {
      totalMetrics: 0,
      avgEngagementRate: 0,
      avgViews: 0,
      avgLikes: 0,
      totalFollowersGained: 0,
      highErThreshold: 0,
      platformStats: [],
      mediaTypeStats: [],
      topPosts: [],
      highErPrompts: [],
      highErCaptions: [],
    };
    return NextResponse.json(empty);
  }

  // ── Overall summary ──────────────────────────────────────────────────────
  const totalFollowersGained = metrics.reduce((s, m) => s + m.followersGained, 0);
  const avgEngagementRate =
    Math.round((metrics.reduce((s, m) => s + m.engagementRate, 0) / n) * 100) / 100;
  const avgViews = Math.round(metrics.reduce((s, m) => s + m.views, 0) / n);
  const avgLikes = Math.round(metrics.reduce((s, m) => s + m.likes, 0) / n);

  // ── Top posts (top 5 by ER) ───────────────────────────────────────────────
  const topPosts = metrics.slice(0, 5).map((m) => ({
    metricId: m.id,
    title: m.postQueue.generatedContent.title ?? null,
    caption: m.postQueue.generatedContent.caption ?? null,
    prompt: m.postQueue.generatedContent.prompt ?? null,
    mediaType: m.postQueue.generatedContent.mediaType,
    platform: m.postQueue.platform,
    views: m.views,
    likes: m.likes,
    engagementRate: m.engagementRate,
    measuredAt: m.measuredAt.toISOString(),
  }));

  // ── High-ER threshold (top 30%) ───────────────────────────────────────────
  const highErCount = Math.max(1, Math.ceil(n * 0.3));
  const highErMetrics = metrics.slice(0, highErCount);
  const highErThreshold = metrics[highErCount - 1].engagementRate;

  const highErPromptsSet = new Set<string>();
  for (const m of highErMetrics) {
    const p = m.postQueue.generatedContent.prompt;
    if (p) highErPromptsSet.add(p);
  }
  const highErPrompts = Array.from(highErPromptsSet);

  const highErCaptionsSet = new Set<string>();
  for (const m of highErMetrics) {
    const c = m.postQueue.generatedContent.caption;
    if (c) highErCaptionsSet.add(c);
  }
  const highErCaptions = Array.from(highErCaptionsSet);

  // ── Platform stats ────────────────────────────────────────────────────────
  const platformMap = new Map<string, Acc>();
  for (const m of metrics) {
    const key = m.postQueue.platform;
    const acc: Acc = platformMap.get(key) ?? { count: 0, sumViews: 0, sumLikes: 0, sumER: 0 };
    acc.count++;
    acc.sumViews += m.views;
    acc.sumLikes += m.likes;
    acc.sumER += m.engagementRate;
    platformMap.set(key, acc);
  }
  const platformStats = Array.from(platformMap.entries()).map(([platform, acc]) => ({
    platform,
    count: acc.count,
    avgViews: Math.round(acc.sumViews / acc.count),
    avgLikes: Math.round(acc.sumLikes / acc.count),
    avgEngagementRate: Math.round((acc.sumER / acc.count) * 100) / 100,
  }));

  // ── MediaType stats ───────────────────────────────────────────────────────
  const mediaMap = new Map<string, Acc>();
  for (const m of metrics) {
    const key = m.postQueue.generatedContent.mediaType;
    const acc: Acc = mediaMap.get(key) ?? { count: 0, sumViews: 0, sumLikes: 0, sumER: 0 };
    acc.count++;
    acc.sumViews += m.views;
    acc.sumLikes += m.likes;
    acc.sumER += m.engagementRate;
    mediaMap.set(key, acc);
  }
  const mediaTypeStats = Array.from(mediaMap.entries()).map(([mediaType, acc]) => ({
    mediaType,
    count: acc.count,
    avgViews: Math.round(acc.sumViews / acc.count),
    avgLikes: Math.round(acc.sumLikes / acc.count),
    avgEngagementRate: Math.round((acc.sumER / acc.count) * 100) / 100,
  }));

  const data: LearningDashboardData = {
    totalMetrics: n,
    avgEngagementRate,
    avgViews,
    avgLikes,
    totalFollowersGained,
    highErThreshold: Math.round(highErThreshold * 100) / 100,
    platformStats,
    mediaTypeStats,
    topPosts,
    highErPrompts,
    highErCaptions,
  };

  return NextResponse.json(data);
  } catch (e) {
    console.error("[GET /api/performance/learning]", e);
    return NextResponse.json({ error: "再学習データの取得に失敗しました" }, { status: 500 });
  }
}
