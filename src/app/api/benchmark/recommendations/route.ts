import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decodeTags } from "@/lib/benchmarkCsv";
import type { BenchmarkRecommendationData, MediaType } from "@/types";

const MEDIA_LABELS: Record<string, string> = {
  IMAGE: "画像",
  VIDEO: "動画",
  MIXED: "画像+動画",
};

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function dedupeNotes(
  notes: (string | null | undefined)[],
  limit = 5
): string[] {
  return Array.from(
    new Set(
      notes
        .map((n) => n?.trim())
        .filter((n): n is string => !!n && n.length > 0)
    )
  ).slice(0, limit);
}

function buildAiPrompt({
  mediaLabel,
  duration,
  topTags,
  expressionExample,
  compositionExample,
  backgroundExample,
  applicationExample,
}: {
  mediaLabel: string;
  duration?: string;
  topTags: string[];
  expressionExample?: string;
  compositionExample?: string;
  backgroundExample?: string;
  applicationExample?: string;
}): string {
  const lines: string[] = ["# AIキャラクター投稿 生成プロンプト案", ""];

  if (expressionExample) {
    lines.push("## キャラクター・表情");
    lines.push(expressionExample, "");
  }

  if (compositionExample || backgroundExample) {
    lines.push("## 構図・背景");
    if (compositionExample) lines.push(`構図: ${compositionExample}`);
    if (backgroundExample) lines.push(`背景: ${backgroundExample}`);
    lines.push("");
  }

  lines.push("## メディア形式");
  lines.push(duration ? `${mediaLabel}（${duration}）` : mediaLabel, "");

  if (topTags.length > 0) {
    lines.push("## 重視する表現要素");
    lines.push(topTags.join("・"), "");
  }

  if (applicationExample) {
    lines.push("## 参考メモ（高パフォーマンス投稿より）");
    lines.push(applicationExample, "");
  }

  lines.push("---");
  lines.push(
    "上記の設定をもとに、SNS映えする高エンゲージメントなAIキャラクター投稿用コンテンツを生成してください。"
  );

  return lines.join("\n");
}

// ─── ルートハンドラー ──────────────────────────────────────────────────────────

export async function GET() {
  const posts = await prisma.benchmarkPost.findMany({
    select: {
      views: true,
      mediaType: true,
      videoDuration: true,
      growthReasonTags: true,
      compositionNote: true,
      characterNote: true,
      applicationNote: true,
    },
  });

  const fieldNotices = [
    "「表情」専用フィールドなし → characterNote（キャラクターノート）を代替使用中",
    "「背景」専用フィールドなし → compositionNote（構図ノート）を代替使用中",
    "精度向上には expressionNote・backgroundNote フィールドの追加を推奨",
  ];

  const empty: BenchmarkRecommendationData = {
    totalAnalyzed: posts.length,
    highPerfCount: 0,
    viewsThreshold: 0,
    recommendedTags: [],
    recommendedMediaType: null,
    recommendedDuration: null,
    compositionExamples: [],
    expressionExamples: [],
    backgroundExamples: [],
    applicationExamples: [],
    postTitleSuggestion: "",
    aiPromptSuggestion: "",
    fieldNotices,
  };

  if (posts.length === 0) return NextResponse.json(empty);

  // ── 上位20%を高パフォーマンス投稿として抽出 ──────────────────────────────────
  const sorted = [...posts].sort((a, b) => b.views - a.views);
  const top20pctCount = Math.max(1, Math.ceil(posts.length * 0.2));
  const highPerfPosts = sorted.slice(0, top20pctCount);
  const viewsThreshold = highPerfPosts[highPerfPosts.length - 1]?.views ?? 0;

  // ── タグ頻度集計 ──────────────────────────────────────────────────────────────
  type FreqEntry = { freq: number; totalViews: number };
  const tagFreqMap = new Map<string, FreqEntry>();

  for (const post of highPerfPosts) {
    const tags = decodeTags(post.growthReasonTags);
    for (const tag of tags) {
      const prev = tagFreqMap.get(tag) ?? { freq: 0, totalViews: 0 };
      tagFreqMap.set(tag, {
        freq: prev.freq + 1,
        totalViews: prev.totalViews + post.views,
      });
    }
  }

  const recommendedTags = Array.from(tagFreqMap.entries())
    .map(([tag, { freq, totalViews }]) => ({
      tag,
      frequency: freq,
      avgViews: Math.round(totalViews / freq),
    }))
    .sort((a, b) => b.frequency - a.frequency || b.avgViews - a.avgViews)
    .slice(0, 5);

  // ── メディア種別頻度集計 ────────────────────────────────────────────────────
  const mediaMap = new Map<string, FreqEntry>();
  for (const post of highPerfPosts) {
    const prev = mediaMap.get(post.mediaType) ?? { freq: 0, totalViews: 0 };
    mediaMap.set(post.mediaType, {
      freq: prev.freq + 1,
      totalViews: prev.totalViews + post.views,
    });
  }
  const topMedia = Array.from(mediaMap.entries()).sort(
    (a, b) => b[1].freq - a[1].freq
  )[0];
  const recommendedMediaType = topMedia
    ? {
        mediaType: topMedia[0] as MediaType,
        label: MEDIA_LABELS[topMedia[0]] ?? topMedia[0],
        frequency: topMedia[1].freq,
        avgViews: Math.round(topMedia[1].totalViews / topMedia[1].freq),
      }
    : null;

  // ── 動画尺頻度集計 ───────────────────────────────────────────────────────────
  const durMap = new Map<string, FreqEntry>();
  for (const post of highPerfPosts) {
    if (!post.videoDuration?.trim()) continue;
    const key = post.videoDuration.trim();
    const prev = durMap.get(key) ?? { freq: 0, totalViews: 0 };
    durMap.set(key, {
      freq: prev.freq + 1,
      totalViews: prev.totalViews + post.views,
    });
  }
  const topDur = Array.from(durMap.entries()).sort(
    (a, b) => b[1].freq - a[1].freq
  )[0];
  const recommendedDuration = topDur
    ? {
        videoDuration: topDur[0],
        frequency: topDur[1].freq,
        avgViews: Math.round(topDur[1].totalViews / topDur[1].freq),
      }
    : null;

  // ── ノート例を抽出（タグ別優先） ─────────────────────────────────────────────
  const withTag = (tag: string) =>
    highPerfPosts.filter((p) => decodeTags(p.growthReasonTags).includes(tag));

  const compositionSrc = withTag("構図");
  const compositionExamples = dedupeNotes(
    (compositionSrc.length > 0 ? compositionSrc : highPerfPosts).map(
      (p) => p.compositionNote
    )
  );

  const expressionSrc = withTag("表情");
  const expressionExamples = dedupeNotes(
    (expressionSrc.length > 0 ? expressionSrc : highPerfPosts).map(
      (p) => p.characterNote
    )
  );

  // 背景は専用フィールドなし → 背景タグ付き投稿の compositionNote のみ（fallback なし）
  const backgroundSrc = withTag("背景");
  const backgroundExamples = dedupeNotes(
    backgroundSrc.map((p) => p.compositionNote)
  );

  const applicationExamples = dedupeNotes(
    highPerfPosts.map((p) => p.applicationNote)
  );

  // ── 投稿案タイトル生成 ───────────────────────────────────────────────────────
  const topTagName = recommendedTags[0]?.tag ?? "";
  const mediaLabel = recommendedMediaType?.label ?? "投稿";
  const postTitleSuggestion = topTagName
    ? `【${mediaLabel}】${topTagName}を軸にしたキャラクター投稿`
    : `【${mediaLabel}】高エンゲージメントを狙ったキャラクター投稿`;

  // ── AI プロンプト生成 ────────────────────────────────────────────────────────
  const aiPromptSuggestion = buildAiPrompt({
    mediaLabel,
    duration: recommendedDuration?.videoDuration,
    topTags: recommendedTags.slice(0, 3).map((t) => t.tag),
    expressionExample: expressionExamples[0],
    compositionExample: compositionExamples[0],
    backgroundExample: backgroundExamples[0],
    applicationExample: applicationExamples[0],
  });

  const result: BenchmarkRecommendationData = {
    totalAnalyzed: posts.length,
    highPerfCount: top20pctCount,
    viewsThreshold,
    recommendedTags,
    recommendedMediaType,
    recommendedDuration,
    compositionExamples,
    expressionExamples,
    backgroundExamples,
    applicationExamples,
    postTitleSuggestion,
    aiPromptSuggestion,
    fieldNotices,
  };

  return NextResponse.json(result);
}
