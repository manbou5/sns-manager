import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { PromptOptimizeResult } from "@/types";

type MetricRow = {
  id: string;
  engagementRate: number;
  postQueue: {
    platform: string;
    generatedContent: {
      prompt: string | null;
      caption: string | null;
      hashtags: string | null;
      mediaType: string;
    };
  };
};

function extractHashtags(text: string): string[] {
  return text.match(/#[\w぀-鿿！-￯]+/g) ?? [];
}

export async function GET() {
  try {
  const metrics: MetricRow[] = await prisma.performanceMetric.findMany({
    include: {
      postQueue: {
        select: {
          platform: true,
          generatedContent: {
            select: {
              prompt: true,
              caption: true,
              hashtags: true,
              mediaType: true,
            },
          },
        },
      },
    },
    orderBy: { engagementRate: "desc" },
  });

  if (metrics.length === 0) {
    const empty: PromptOptimizeResult = {
      optimizedPrompt: "",
      recommendedTags: [],
      recommendedMediaType: "IMAGE",
      reason: "実績データがありません。投稿後に実績を入力してから再試行してください。",
      basedOnCount: 0,
      highErThreshold: 0,
    };
    return NextResponse.json(empty);
  }

  // ── High-ER slice (top 20%) ───────────────────────────────────────────────
  const highErCount = Math.max(1, Math.ceil(metrics.length * 0.2));
  const highErMetrics = metrics.slice(0, highErCount);
  const highErThreshold = Math.round(metrics[highErCount - 1].engagementRate * 100) / 100;
  const topEr = Math.round(metrics[0].engagementRate * 100) / 100;
  const avgEr =
    Math.round(
      (highErMetrics.reduce((s, m) => s + m.engagementRate, 0) / highErCount) * 100
    ) / 100;

  // ── recommendedMediaType (mode) ───────────────────────────────────────────
  const mediaCount = new Map<string, number>();
  for (const m of highErMetrics) {
    const mt = m.postQueue.generatedContent.mediaType;
    mediaCount.set(mt, (mediaCount.get(mt) ?? 0) + 1);
  }
  let recommendedMediaType = "IMAGE";
  let maxMtCount = 0;
  for (const [mt, cnt] of Array.from(mediaCount.entries())) {
    if (cnt > maxMtCount) { maxMtCount = cnt; recommendedMediaType = mt; }
  }

  // ── recommendedTags (top 8 by frequency) ─────────────────────────────────
  const tagCount = new Map<string, number>();
  for (const m of highErMetrics) {
    const { caption, hashtags } = m.postQueue.generatedContent;
    for (const src of [caption ?? "", hashtags ?? ""]) {
      for (const tag of extractHashtags(src)) {
        tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      }
    }
  }
  const recommendedTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  // ── optimizedPrompt ───────────────────────────────────────────────────────
  const prompts = highErMetrics
    .map((m) => m.postQueue.generatedContent.prompt)
    .filter((p): p is string => !!p && p.trim().length > 0);

  let optimizedPrompt = "";

  if (prompts.length === 0) {
    // Fallback: build from captions
    const captions = highErMetrics
      .map((m) => m.postQueue.generatedContent.caption)
      .filter((c): c is string => !!c && c.trim().length > 0);
    optimizedPrompt = captions[0] ?? "";
  } else if (prompts.length === 1) {
    optimizedPrompt = prompts[0];
  } else {
    // Base = top-1 prompt, append common lines found in 2+ prompts
    const basePrompt = prompts[0];
    const lineFreq = new Map<string, number>();
    for (const p of prompts) {
      const seen = new Set<string>();
      for (const raw of p.split("\n")) {
        const line = raw.trim();
        if (line.length < 6) continue;
        if (!seen.has(line)) {
          seen.add(line);
          lineFreq.set(line, (lineFreq.get(line) ?? 0) + 1);
        }
      }
    }
    const commonLines = Array.from(lineFreq.entries())
      .filter(([, cnt]) => cnt >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([line]) => line)
      // exclude lines already present in basePrompt
      .filter((line) => !basePrompt.includes(line));

    optimizedPrompt =
      commonLines.length > 0
        ? `${basePrompt}\n\n# 高ER投稿の共通要素（自動抽出）\n${commonLines.join("\n")}`
        : basePrompt;
  }

  // ── reason ────────────────────────────────────────────────────────────────
  const reasonParts: string[] = [
    `ER上位${highErCount}件（しきい値 ${highErThreshold}%）を分析。平均ER ${avgEr}%、最高ER ${topEr}%。`,
  ];
  if (prompts.length > 1) {
    reasonParts.push(`${prompts.length}件のプロンプトから共通要素を抽出して統合しました。`);
  } else if (prompts.length === 1) {
    reasonParts.push("最高ER投稿のプロンプトをそのまま使用しています。");
  } else {
    reasonParts.push("プロンプトデータが不足のため、キャプションをベースにしています。");
  }
  if (recommendedTags.length > 0) {
    reasonParts.push(`頻出ハッシュタグ ${recommendedTags.slice(0, 3).join(" ")} 等を推薦。`);
  }
  reasonParts.push(`推奨メディア種別: ${recommendedMediaType}（高ER投稿の最多種別）。`);

  const result: PromptOptimizeResult = {
    optimizedPrompt,
    recommendedTags,
    recommendedMediaType,
    reason: reasonParts.join(" "),
    basedOnCount: highErCount,
    highErThreshold,
  };

  return NextResponse.json(result);
  } catch (e) {
    console.error("[GET /api/prompt/optimize]", e);
    return NextResponse.json({ error: "プロンプト最適化に失敗しました" }, { status: 500 });
  }
}
