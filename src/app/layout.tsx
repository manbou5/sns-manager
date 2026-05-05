import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "SNS Manager - AIキャラクター運用",
  description: "AIキャラクターSNSアカウント投稿管理システム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <ToastProvider>
          <Navigation />
          {/* md+: left padding for fixed sidebar / mobile: top padding for mobile header */}
          <main className="min-h-screen pt-12 md:pt-0 md:pl-56">
            <div className="p-4 md:p-8">{children}</div>
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
