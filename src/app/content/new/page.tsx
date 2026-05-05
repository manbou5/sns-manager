import { ContentForm } from "@/components/ContentForm";

export default function NewContentPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">生成コンテンツ 新規作成</h2>
        <p className="text-gray-500 text-sm mt-1">
          AIプロンプトと投稿案を保存します。推薦機能で生成したプロンプトをそのまま貼り付けて使用できます。
        </p>
      </div>
      <ContentForm mode="create" />
    </div>
  );
}
