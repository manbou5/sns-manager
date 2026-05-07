"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_GROUPS = [
  {
    label: "投稿管理",
    items: [
      { href: "/",          label: "ダッシュボード", icon: "🏠" },
      { href: "/posts",     label: "投稿一覧",       icon: "📋" },
      { href: "/posts/new", label: "新規投稿",       icon: "✏️" },
      { href: "/calendar",  label: "カレンダー",     icon: "📅" },
    ],
  },
  {
    label: "分析・ベンチマーク",
    items: [
      { href: "/analytics",                  label: "分析",           icon: "📊" },
      { href: "/benchmark",                  label: "ベンチマーク",   icon: "🔍" },
      { href: "/benchmark/analytics",        label: "集計",           icon: "📈" },
      { href: "/benchmark/recommendations",  label: "投稿案推薦",     icon: "💡" },
      { href: "/benchmark/bulk-analyze",     label: "一括解析CSV",    icon: "📦" },
    ],
  },
  {
    label: "AI生成・実績",
    items: [
      { href: "/content",              label: "生成コンテンツ", icon: "📝" },
      { href: "/queue",                label: "投稿キュー",     icon: "🚀" },
      { href: "/performance",          label: "実績管理",       icon: "📈" },
      { href: "/performance/learning", label: "再学習",         icon: "🧠" },
    ],
  },
  {
    label: "その他",
    items: [
      { href: "/dev-tools", label: "開発ツール", icon: "🛠" },
    ],
  },
];

function NavContent({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="p-5 border-b border-gray-700 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-brand-400">SNS Manager</h1>
          <p className="text-xs text-gray-400 mt-0.5">AI キャラクター運用</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-gray-400 hover:text-white transition-colors p-1"
            aria-label="閉じる"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-3 mb-1.5">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      pathname === href
                        ? "bg-brand-600 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    <span className="text-base leading-none">{icon}</span>
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700 shrink-0">
        <p className="text-xs text-gray-500">MVP v0.1.0</p>
      </div>
    </>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 bg-gray-900 text-white flex-col z-30">
        <NavContent pathname={pathname} />
      </nav>

      {/* Mobile: sticky top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-gray-900 text-white flex items-center px-4 z-30 shadow-md">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 -ml-1 text-gray-300 hover:text-white transition-colors"
          aria-label="メニューを開く"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <rect y="3" width="20" height="2" rx="1" />
            <rect y="9" width="20" height="2" rx="1" />
            <rect y="15" width="20" height="2" rx="1" />
          </svg>
        </button>
        <span className="ml-3 font-bold text-brand-400 text-base">SNS Manager</span>
      </div>

      {/* Mobile: slide-over drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <nav className="relative w-64 bg-gray-900 text-white flex flex-col h-full shadow-xl overflow-hidden">
            <NavContent pathname={pathname} onClose={() => setOpen(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
