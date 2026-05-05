import { BenchmarkForm } from "@/components/BenchmarkForm";

export default function NewBenchmarkPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">ベンチマーク投稿を登録</h2>
        <p className="text-sm text-gray-500 mt-1">
          参考アカウントの投稿データを手入力で登録します
        </p>
      </div>
      <BenchmarkForm mode="create" />
    </div>
  );
}
