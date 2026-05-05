import clsx from "clsx";
import type { PostStatus } from "@/types";

const STATUS_CONFIG: Record<
  PostStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: "下書き", className: "bg-gray-100 text-gray-700" },
  SCHEDULED: { label: "予約済み", className: "bg-blue-100 text-blue-700" },
  PENDING_CONFIRMATION: {
    label: "確認待ち",
    className: "bg-yellow-100 text-yellow-700 animate-pulse",
  },
  POSTED: { label: "投稿済み", className: "bg-green-100 text-green-700" },
  FAILED: { label: "失敗", className: "bg-red-100 text-red-700" },
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
