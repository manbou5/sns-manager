import { QueueNewForm } from "./QueueNewForm";

// searchParams を Server Component で受け取り、Client Form に渡す
// （useSearchParams の Suspense 問題を回避）
export default function QueueNewPage({
  searchParams,
}: {
  searchParams: { contentId?: string };
}) {
  return <QueueNewForm contentId={searchParams.contentId} />;
}
