import { PerformanceForm } from "@/components/PerformanceForm";

export default function PerformanceNewPage({
  searchParams,
}: {
  searchParams: { queueId?: string };
}) {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">実績入力</h2>
        <p className="text-sm text-gray-500 mt-1">
          投稿済みコンテンツの SNS パフォーマンスを記録します
        </p>
      </div>
      <PerformanceForm mode="create" queueId={searchParams.queueId} />
    </div>
  );
}
