"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード", icon: "🏠" },
  { href: "/posts", label: "投稿一覧", icon: "📋" },
  { href: "/posts/new", label: "新規投稿作成", icon: "✏️" },
  { href: "/calendar", label: "投稿カレンダー", icon: "📅" },
  { href: "/analytics", label: "分析", icon: "📊" },
  { href: "/benchmark", label: "ベンチマーク一覧", icon: "🔍" },
  { href: "/benchmark/analytics", label: "ベンチマーク集計", icon: "📊" },
  { href: "/benchmark/recommendations", label: "投稿案推薦", icon: "💡" },
  { href: "/content", label: "生成コンテンツ", icon: "📝" },
  { href: "/queue",       label: "投稿キュー",  icon: "📅" },
  { href: "/performance",          label: "実績管理", icon: "📈" },
  { href: "/performance/learning", label: "再学習",      icon: "🧠" },
  { href: "/dev-tools",            label: "開発ツール",  icon: "🛠" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="w-56 min-h-screen bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-5 border-b border-gray-700">
        <h1 className="text-lg font-bold text-brand-400">SNS Manager</h1>
        <p className="text-xs text-gray-400 mt-0.5">AI キャラクター運用</p>
      </div>

      <ul className="flex-1 py-4 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                pathname === href
                  ? "bg-brand-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">MVP v0.1.0</p>
      </div>
    </nav>
  );
}
