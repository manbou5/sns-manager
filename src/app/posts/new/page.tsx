import { PostForm } from "@/components/PostForm";

export default function NewPostPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">新規投稿作成</h2>
        <p className="text-gray-500 text-sm mt-1">
          投稿内容を入力し、下書き保存または予約投稿に設定してください
        </p>
      </div>
      <PostForm mode="create" />
    </div>
  );
}
