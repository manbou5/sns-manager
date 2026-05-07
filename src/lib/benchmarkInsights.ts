/**
 * ベンチマーク深層分析ロジック
 *
 * Prisma・HTTP 依存なし。API ルートから呼ばれるサーバー専用モジュール。
 * - タグ別強化集計 (top30%出現率・全体比)
 * - 勝ちタグ / 低パフォーマンスタグ
 * - タグ組み合わせ分析
 */

import { decodeTags } from "@/lib/benchmarkCsv";
import type {
  BenchmarkTagInsight,
  BenchmarkTagCombo,
  BenchmarkInsightsData,
} from "@/types";

// ─── 型 ─────────────────────────────────────────────────────────────────────

export type InsightPost = {
  views: number;
  likes: number;
  reposts: number;
  replies: number;
  growthReasonTags: string | null;
};

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function r1(n: number) { return Math.round(n * 10) / 10; }
function r2(n: number) { return Math.round(n * 100) / 100; }

function er(p: InsightPost): number {
  return p.views > 0 ? ((p.likes + p.reposts + p.replies) / p.views) * 100 : 0;
}

// ─── メイン計算 ──────────────────────────────────────────────────────────────

export function computeInsights(posts: InsightPost[]): BenchmarkInsightsData {
  const n = posts.length;

  const empty: BenchmarkInsightsData = {
    totalPosts: 0,
    overallAvgViews: 0,
    overallAvgEngagementRate: 0,
    top30pctThreshold: 0,
    winnerTags: [],
    loserTags: [],
    tagCombos: [],
    allTagStats: [],
  };
  if (n === 0) return empty;

  // ── 全体サマリー
  const overallAvgViews = r1(posts.reduce((s, p) => s + p.views, 0) / n);
  const overallAvgER    = r2(posts.reduce((s, p) => s + er(p), 0) / n);

  // ── 上位30%インデックス（同数views は同一扱い）
  const sortedByViews = [...posts]
    .map((p, i) => ({ views: p.views, idx: i }))
    .sort((a, b) => b.views - a.views);

  const top30pctCount     = Math.max(1, Math.ceil(n * 0.3));
  const top30pctThreshold = sortedByViews[top30pctCount - 1]?.views ?? 0;
  const top30pctIndices   = new Set<number>(
    sortedByViews.slice(0, top30pctCount).map((p) => p.idx)
  );

  // ── タグ別集計
  type TagAccum = {
    count: number; views: number; likes: number;
    reposts: number; erSum: number; top30n: number;
  };
  const tagMap = new Map<string, TagAccum>();

  for (let idx = 0; idx < posts.length; idx++) {
    const post   = posts[idx];
    const tags   = decodeTags(post.growthReasonTags);
    const erVal  = er(post);
    const inTop30 = top30pctIndices.has(idx);

    for (const tag of tags) {
      const prev = tagMap.get(tag) ?? {
        count: 0, views: 0, likes: 0, reposts: 0, erSum: 0, top30n: 0,
      };
      tagMap.set(tag, {
        count:  prev.count  + 1,
        views:  prev.views  + post.views,
        likes:  prev.likes  + post.likes,
        reposts:prev.reposts + post.reposts,
        erSum:  prev.erSum  + erVal,
        top30n: prev.top30n + (inTop30 ? 1 : 0),
      });
    }
  }

  const allTagStats: BenchmarkTagInsight[] = Array.from(tagMap.entries())
    .map(([tag, acc]) => {
      const avgViews = r1(acc.views / acc.count);
      const avgER    = r2(acc.erSum / acc.count);
      return {
        tag,
        count:               acc.count,
        avgViews,
        avgLikes:            r1(acc.likes   / acc.count),
        avgEngagementRate:   avgER,
        top30pctRate:        r2(acc.top30n  / acc.count),
        vsOverallViews:      overallAvgViews > 0 ? r2(avgViews / overallAvgViews) : 1,
        vsOverallER:         overallAvgER    > 0 ? r2(avgER    / overallAvgER)    : 1,
      };
    })
    .sort((a, b) => b.avgViews - a.avgViews || b.count - a.count);

  // ── 勝ちタグ (全体比 > 1.0、上位5件)
  const winnerTags = allTagStats
    .filter((t) => t.vsOverallViews > 1.0)
    .sort((a, b) => b.vsOverallViews - a.vsOverallViews)
    .slice(0, 5);

  // ── 低パフォーマンスタグ (全体比 < 1.0 かつ 2件以上、下位5件)
  const loserTags = allTagStats
    .filter((t) => t.vsOverallViews < 1.0 && t.count >= 2)
    .sort((a, b) => a.vsOverallViews - b.vsOverallViews)
    .slice(0, 5);

  // ── タグ組み合わせ分析
  const tagCombos = computeTagCombos(posts, tagMap);

  return {
    totalPosts: n,
    overallAvgViews,
    overallAvgEngagementRate: overallAvgER,
    top30pctThreshold,
    winnerTags,
    loserTags,
    tagCombos,
    allTagStats,
  };
}

// ─── タグ組み合わせ ──────────────────────────────────────────────────────────

function computeTagCombos(
  posts: InsightPost[],
  tagMap: Map<string, { count: number; views: number }>
): BenchmarkTagCombo[] {
  type ComboAccum = {
    count: number; views: number; likes: number; erSum: number;
  };
  const comboMap = new Map<string, ComboAccum>();

  for (const post of posts) {
    const tags = decodeTags(post.growthReasonTags);
    if (tags.length < 2) continue;

    const erVal = er(post);
    const sorted = [...tags].sort();

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key  = `${sorted[i]}||${sorted[j]}`;
        const prev = comboMap.get(key) ?? { count: 0, views: 0, likes: 0, erSum: 0 };
        comboMap.set(key, {
          count:  prev.count  + 1,
          views:  prev.views  + post.views,
          likes:  prev.likes  + post.likes,
          erSum:  prev.erSum  + erVal,
        });
      }
    }
  }

  return Array.from(comboMap.entries())
    .filter(([, acc]) => acc.count >= 2)
    .map(([key, acc]) => {
      const [tagA, tagB] = key.split("||");
      const aEntry = tagMap.get(tagA);
      const bEntry = tagMap.get(tagB);
      const indivAvg =
        aEntry && bEntry
          ? ((aEntry.views / aEntry.count) + (bEntry.views / bEntry.count)) / 2
          : 0;
      const comboAvg = acc.views / acc.count;

      return {
        tagA,
        tagB,
        count:              acc.count,
        avgViews:           r1(comboAvg),
        avgLikes:           r1(acc.likes / acc.count),
        avgEngagementRate:  r2(acc.erSum  / acc.count),
        vsIndividualAvg:    indivAvg > 0 ? r2(comboAvg / indivAvg) : 1,
      };
    })
    .sort((a, b) => b.avgViews - a.avgViews || b.count - a.count)
    .slice(0, 10);
}

// ─── 推薦理由テキスト生成 ─────────────────────────────────────────────────────

export function buildReasonText(
  tag: string,
  frequency: number,
  highPerfCount: number,
  vsOverall: number | undefined,
  top30Rate: number | undefined
): string {
  const parts: string[] = [];

  parts.push(`上位20%投稿 ${highPerfCount}件中 ${frequency}件に出現`);

  if (vsOverall !== undefined && overallDiff(vsOverall) !== 0) {
    const sign = vsOverall >= 1 ? "+" : "";
    const pct  = Math.round((vsOverall - 1) * 100);
    parts.push(`全体比 ${sign}${pct}% の再生数`);
  }

  if (top30Rate !== undefined) {
    parts.push(`上位30%への出現率 ${Math.round(top30Rate * 100)}%`);
  }

  void tag; // suppress unused warning
  return parts.join("　/　");
}

function overallDiff(ratio: number): number {
  return Math.round((ratio - 1) * 100);
}
