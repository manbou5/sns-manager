"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { BenchmarkRecommendationData } from "@/types";

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({
  text,
  label = "コピー",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
        copied
          ? "bg-green-50 border-green-300 text-green-700 font-medium"
          : "bg-white border-gray-200 text-gray-500 hover:border-brand-300 hover:text-brand-600"
      } ${className}`}
    >
      {copied ? "✓ コピー済み" : label}
    </button>
  );
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "万";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 mb-2">{children}</h3>
  );
}

// ─── NoteExampleList ──────────────────────────────────────────────────────────

function NoteExampleList({
  title,
  notes,
  notice,
}: {
  title: string;
  notes: string[];
  notice?: string;
}) {
  return (
    <div className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {notice && <p className="text-xs text-gray-400 -mt-1 mb-1">{notice}</p>}
      <ul className="space-y-1.5">
        {notes.map((note, i) => (
          <li
            key={i}
            className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2"
          >
            <span className="shrink-0 text-gray-400 text-xs mt-0.5 w-4">
              {i + 1}.
            </span>
            <span className="flex-1 text-sm text-gray-700 leading-snug">
              {note}
            </span>
            <CopyButton text={note} className="shrink-0 mt-0.5" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [data, setData] = useState<BenchmarkRecommendationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/benchmark/recommendations")
      .then((r) => {
        if (!r.ok) throw new Error("APIエラー");
        return r.json();
      })
      .then((d: BenchmarkRecommendationData) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-gray-400 text-center py-20">
        推薦データを計算中...
      </div>
    );
  }
  if (error) {
    return <div className="text-red-500 text-center py-20">{error}</div>;
  }
  if (!data) return null;

  if (data.totalAnalyzed === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <p className="text-gray-500 text-lg">
          ベンチマークデータがまだありません
        </p>
        <p className="text-gray-400 text-sm">
          投稿を登録すると、ここに推薦結果が表示されます
        </p>
        <Link href="/benchmark/new" className="btn-primary inline-block">
          最初のデータを登録する
        </Link>
      </div>
    );
  }

  const hasNotes =
    data.compositionExamples.length > 0 ||
    data.expressionExamples.length > 0 ||
    data.backgroundExamples.length > 0 ||
    data.applicationExamples.length > 0;

  return (
    <div className="max-w-4xl space-y-6">
      {/* ── ヘッダー ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">投稿案推薦</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            高パフォーマンス投稿の傾向から次のコンテンツを提案
          </p>
        </div>
        <Link href="/benchmark/analytics" className="btn-secondary text-sm">
          ← 集計に戻る
        </Link>
      </div>

      {/* ── 分析根拠 ── */}
      <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600">
        <span className="shrink-0 mt-0.5">📊</span>
        <span>
          <strong className="text-gray-900">{data.totalAnalyzed}</strong>{" "}
          件を分析し、再生数上位20%（
          <strong className="text-gray-900">{data.highPerfCount}</strong> 件、
          再生数{" "}
          <strong className="text-gray-900">
            {fmt(data.viewsThreshold)}
          </strong>{" "}
          以上）を高パフォーマンス投稿として推薦ロジックに使用しました。
        </span>
      </div>

      {/* ── 推奨タグ ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>推奨タグ</SectionTitle>
          {data.recommendedTags.length > 0 && (
            <CopyButton
              text={data.recommendedTags.map((t) => t.tag).join(" / ")}
              label="タグ一覧をコピー"
            />
          )}
        </div>
        {data.recommendedTags.length === 0 ? (
          <p className="text-sm text-gray-400">タグ付き投稿がありません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.recommendedTags.map((t) => (
              <div
                key={t.tag}
                className="group flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-full pl-3 pr-2 py-1.5"
              >
                <span className="text-sm font-semibold text-brand-800">
                  {t.tag}
                </span>
                <span className="text-xs text-brand-500">
                  {t.frequency}件 / 平均{fmt(t.avgViews)}再生
                </span>
                <CopyButton text={t.tag} className="opacity-0 group-hover:opacity-100" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 推奨メディア種別・動画尺 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card space-y-2">
          <SectionTitle>推奨メディア種別</SectionTitle>
          {data.recommendedMediaType ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-brand-700">
                  {data.recommendedMediaType.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  高パフォーマンス {data.recommendedMediaType.frequency} 件 ／
                  平均再生数 {fmt(data.recommendedMediaType.avgViews)}
                </p>
              </div>
              <CopyButton text={data.recommendedMediaType.label} />
            </div>
          ) : (
            <p className="text-sm text-gray-400">データなし</p>
          )}
        </div>

        <div className="card space-y-2">
          <SectionTitle>推奨動画尺</SectionTitle>
          {data.recommendedDuration ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-brand-700 font-mono">
                  {data.recommendedDuration.videoDuration}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  高パフォーマンス {data.recommendedDuration.frequency} 件 ／
                  平均再生数 {fmt(data.recommendedDuration.avgViews)}
                </p>
              </div>
              <CopyButton text={data.recommendedDuration.videoDuration} />
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              動画尺が設定された投稿がありません
            </p>
          )}
        </div>
      </div>

      {/* ── 投稿ヒント（ノート例） ── */}
      {hasNotes && (
        <div className="card space-y-5">
          <h3 className="font-semibold text-gray-900">
            投稿ヒント
            <span className="ml-2 text-xs font-normal text-gray-400">
              高パフォーマンス投稿より抽出
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {data.compositionExamples.length > 0 && (
              <NoteExampleList
                title="推奨構図"
                notes={data.compositionExamples}
              />
            )}
            {data.expressionExamples.length > 0 && (
              <NoteExampleList
                title="推奨キャラクター・表情"
                notes={data.expressionExamples}
                notice="※ characterNote より抽出（表情専用フィールド代替）"
              />
            )}
            {data.backgroundExamples.length > 0 && (
              <NoteExampleList
                title="推奨背景"
                notes={data.backgroundExamples}
                notice="※ 背景タグ付き投稿の compositionNote より抽出"
              />
            )}
            {data.applicationExamples.length > 0 && (
              <NoteExampleList
                title="応用メモ"
                notes={data.applicationExamples}
              />
            )}
          </div>
        </div>
      )}

      {/* ── 投稿案タイトル ── */}
      {data.postTitleSuggestion && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <SectionTitle>投稿案タイトル</SectionTitle>
            <CopyButton text={data.postTitleSuggestion} />
          </div>
          <p className="text-gray-800">{data.postTitleSuggestion}</p>
        </div>
      )}

      {/* ── 生成AIプロンプト ── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">生成AIプロンプト案</h3>
          <CopyButton
            text={data.aiPromptSuggestion}
            label="全文コピー"
            className="font-semibold text-sm px-3 py-1.5"
          />
        </div>
        <p className="text-xs text-gray-400">
          画像生成AI・チャットAIにそのまま貼り付けて使用できます
        </p>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed select-all">
          {data.aiPromptSuggestion}
        </pre>
      </div>

      {/* ── フィールド不足の通知 ── */}
      {data.fieldNotices.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">
            推薦精度向上のための提案
          </p>
          <ul className="space-y-1.5">
            {data.fieldNotices.map((notice, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-amber-700"
              >
                <span className="shrink-0">
                  {i === data.fieldNotices.length - 1 ? "💡" : "⚠"}
                </span>
                <span>{notice}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
