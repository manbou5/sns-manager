"use client";

import { useEffect, useState } from "react";
import { PostForm } from "@/components/PostForm";
import type { Post } from "@/types";

export default function EditPostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${params.id}`)
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
    return <div className="text-gray-400 py-12 text-center">読み込み中...</div>;
  }

  if (notFound || !post) {
    return <div className="text-red-500 py-12 text-center">投稿が見つかりません</div>;
  }

  if (post.status === "POSTED") {
    return (
      <div className="card max-w-lg text-center py-10">
        <p className="text-gray-500">投稿済みの投稿は編集できません</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">投稿編集</h2>
        <p className="text-gray-500 text-sm mt-1">
          ID: {post.id}
        </p>
      </div>
      <PostForm mode="edit" initial={post} />
    </div>
  );
}
