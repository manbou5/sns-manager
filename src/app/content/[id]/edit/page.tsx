"use client";

import { useEffect, useState } from "react";
import { ContentForm } from "@/components/ContentForm";
import type { GeneratedContent } from "@/types";

export default function EditContentPage({
  params,
}: {
  params: { id: string };
}) {
  const [item,     setItem]     = useState<GeneratedContent | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/content/${params.id}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setItem(data);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  }
  if (notFound || !item) {
    return (
      <div className="text-red-500 py-12 text-center">
        コンテンツが見つかりません
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">生成コンテンツ 編集</h2>
        <p className="text-gray-500 text-sm mt-1">ID: {item.id}</p>
      </div>
      <ContentForm mode="edit" initial={item} />
    </div>
  );
}
