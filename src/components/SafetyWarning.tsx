import type { SafetyCheckResult } from "@/types";

export function SafetyWarning({ result }: { result: SafetyCheckResult | null }) {
  if (!result) return null;
  if (result.errors.length === 0 && result.warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {result.errors.map((issue, i) => (
        <div
          key={i}
          className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm"
        >
          <span className="text-red-500 font-bold shrink-0">🚫 ブロック</span>
          <div>
            <p className="text-red-700 font-medium">{issue.message}</p>
            {issue.matchedText && (
              <p className="text-red-500 text-xs mt-0.5">
                該当: 「{issue.matchedText}」
              </p>
            )}
          </div>
        </div>
      ))}

      {result.warnings.map((issue, i) => (
        <div
          key={i}
          className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm"
        >
          <span className="text-yellow-600 font-bold shrink-0">⚠️ 警告</span>
          <div>
            <p className="text-yellow-700 font-medium">{issue.message}</p>
            {issue.matchedText && (
              <p className="text-yellow-600 text-xs mt-0.5">
                該当: 「{issue.matchedText}」
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
