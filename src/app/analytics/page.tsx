"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { format } from "date-fns";
import type { Post } from "@/types";
import { CsvImport } from "@/components/CsvImport";

interface AnalyticsRecord {
  id: string;
  postId: string;
  impressions: number;
  likes: number;
  reposts: number;
  clicks: number;
  followerGain: number;
  recordedAt: string;
  post: Pick<Post, "id" | "title" | "genre" | "platform" | "scheduledAt" | "postedAt" | "caption">;
}

const GENRE_LABELS: Record<string, string> = {
  FASHION: "ファッション",
  LIFESTYLE: "ライフスタイル",
  PORTRAIT: "ポートレート",
  GRAVURE_STYLE: "グラビア風",
  OTHER: "その他",
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [postedPosts, setPostedPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<string>("");
  const [form, setForm] = useState({
    impressions: "",
    likes: "",
    reposts: "",
    clicks: "",
    followerGain: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, postsRes] = await Promise.all([
        fetch("/api/analytics"),
        fetch("/api/posts?status=POSTED"),
      ]);
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(Array.isArray(data) ? data : []);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPostedPosts(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("[fetchData]", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 選択した投稿の既存データをフォームに反映
  useEffect(() => {
    if (!selectedPost) return;
    const existing = analytics.find((a) => a.postId === selectedPost);
    if (existing) {
      setForm({
        impressions: String(existing.impressions),
        likes: String(existing.likes),
        reposts: String(existing.reposts),
        clicks: String(existing.clicks),
        followerGain: String(existing.followerGain),
      });
    } else {
      setForm({ impressions: "", likes: "", reposts: "", clicks: "", followerGain: "" });
    }
  }, [selectedPost, analytics]);

  const handleSave = async () => {
    if (!selectedPost) return;
    setSaving(true);
    await fetch(`/api/analytics/${selectedPost}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        impressions: Number(form.impressions) || 0,
        likes: Number(form.likes) || 0,
        reposts: Number(form.reposts) || 0,
        clicks: Number(form.clicks) || 0,
        followerGain: Number(form.followerGain) || 0,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchData();
  };

  // チャートデータ: 投稿ごとのエンゲージメント
  const chartData = analytics.slice(0, 10).map((a) => ({
    name: a.post.title ?? a.post.caption.slice(0, 12) + "…",
    いいね: a.likes,
    リポスト: a.reposts,
    クリック: a.clicks,
    インプレッション: a.impressions,
  }));

  // ジャンル別集計
  const genreStats = analytics.reduce<Record<string, { likes: number; impressions: number; count: number }>>(
    (acc, a) => {
      const g = a.post.genre;
      if (!acc[g]) acc[g] = { likes: 0, impressions: 0, count: 0 };
      acc[g].likes += a.likes;
      acc[g].impressions += a.impressions;
      acc[g].count += 1;
      return acc;
    },
    {}
  );

  const genreChartData = Object.entries(genreStats).map(([g, s]) => ({
    name: GENRE_LABELS[g] ?? g,
    平均いいね: s.count > 0 ? Math.round(s.likes / s.count) : 0,
    平均インプレッション: s.count > 0 ? Math.round(s.impressions / s.count) : 0,
  }));

  // 時間帯別集計
  const hourStats = analytics.reduce<Record<number, number>>((acc, a) => {
    const postedAt = a.post.postedAt ?? a.post.scheduledAt;
    if (!postedAt) return acc;
    const hour = new Date(postedAt).getHours();
    acc[hour] = (acc[hour] ?? 0) + a.likes;
    return acc;
  }, {});

  const hourChartData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}時`,
    いいね合計: hourStats[h] ?? 0,
  }));

  const COLORS = ["#ec4899", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

  return (
    <div className="max-w-5xl space-y-8">
      <h2 className="text-2xl font-bold">分析</h2>

      {/* データ入力 */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-gray-900">📝 分析データを入力</h3>
        <p className="text-sm text-gray-500">
          投稿済みの投稿を選択し、インプレッション数などを手入力してください
        </p>

        <div>
          <label className="label">投稿を選択</label>
          <select
            className="input"
            value={selectedPost}
            onChange={(e) => setSelectedPost(e.target.value)}
          >
            <option value="">-- 投稿を選択 --</option>
            {postedPosts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title ?? p.caption.slice(0, 30)} (
                {p.postedAt ? format(new Date(p.postedAt), "M/d HH:mm") : "—"})
              </option>
            ))}
          </select>
        </div>

        {selectedPost && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: "impressions", label: "インプレッション" },
                { key: "likes", label: "いいね数" },
                { key: "reposts", label: "リポスト数" },
                { key: "clicks", label: "クリック数" },
                { key: "followerGain", label: "フォロワー増加数" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form[key as keyof typeof form]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "保存中..." : saved ? "✓ 保存しました" : "保存する"}
            </button>
          </>
        )}
      </div>

      {/* CSVインポート */}
      <CsvImport onImportComplete={fetchData} />

      {analytics.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          分析データがありません。投稿済みの投稿にデータを入力してください。
        </div>
      ) : (
        <>
          {/* 投稿別エンゲージメント */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">
              投稿別エンゲージメント（直近10件）
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="いいね" fill="#ec4899" />
                <Bar dataKey="リポスト" fill="#8b5cf6" />
                <Bar dataKey="クリック" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ジャンル別平均 */}
          {genreChartData.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">
                ジャンル別平均エンゲージメント
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={genreChartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="平均いいね" fill="#ec4899">
                    {genreChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 時間帯別 */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">
              投稿時間帯別 いいね合計
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourChartData}>
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10 }}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="いいね合計" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* データテーブル */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">分析データ一覧</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">投稿</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">IMP</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">いいね</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">RT</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">クリック</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">F増</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {analytics.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[200px]">
                          {a.post.title ?? a.post.caption.slice(0, 20)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {GENRE_LABELS[a.post.genre] ?? a.post.genre} ·{" "}
                          {a.post.platform}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {a.impressions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-brand-600 font-medium">
                        {a.likes.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {a.reposts.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {a.clicks.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        +{a.followerGain}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
