import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import "./autoboard.css";
import "./whiteboard.css";
import "./captions.css";
import "./library.css";

export const metadata: Metadata = {
  title: "autoboard · 말로 이어가는 수업",
  description: "수업 자료를 바탕으로 실시간 자막과 자동 판서를 연결하고, 수업 후 복습 PDF로 저장하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
