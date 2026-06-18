import type { Metadata } from "next";
import { Toaster } from "sonner";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "식단 칼로리 트래커",
  description:
    "식단을 기록하면 칼로리·영양성분을 자동 계산하고 물 섭취와 목표 칼로리를 관리합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
