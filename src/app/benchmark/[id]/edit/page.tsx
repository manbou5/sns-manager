"use client";

import { useEffect, useState } from "react";
import { BenchmarkForm } from "@/components/BenchmarkForm";
import type { BenchmarkPost } from "@/types";

export default function EditBenchmarkPage({ params }: { params: { id: string } }) {
  const [post,      setPost]      = useState<BenchmarkPost | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);

  useEffect(() => {
    fetch(`/api/benchmark/${params.id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setPost(data);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return <div className="text-gray-400 text-center py-12">読み込み中...</div>;
  }
  if (notFound || !post) {
    return (
      <div className="card max-w-lg text-center py-10 text-red-500">
        データが見つかりません
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">ベンチマーク投稿を編集</h2>
        <p className="text-sm text-gray-500 mt-1">
          {post.accountName} のデータを編集します
        </p>
      </div>
      <BenchmarkForm mode="edit" initial={post} />
    </div>
  );
}
