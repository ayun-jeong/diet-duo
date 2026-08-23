import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "DietDuo — 식단 기록",
  description:
    "식단을 기록하면 칼로리·영양성분을 자동 계산하고 물 섭취와 목표 칼로리를 관리합니다.",
  // 홈 화면에 추가했을 때 주소창 없이 전체화면으로 뜨게 한다 (iOS)
  appleWebApp: {
    capable: true,
    title: "DietDuo",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Next 는 최신 표준인 mobile-web-app-capable 만 내보낸다.
  // 구형 iOS 는 레거시 이름만 인식하므로 함께 넣는다.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  // 카톡 등으로 링크 공유 시 미리보기
  openGraph: {
    title: "DietDuo — 식단 기록",
    description: "먹은 걸 적으면 칼로리가 자동으로 계산됩니다.",
    type: "website",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  // 입력창을 눌렀을 때 화면이 확대되는 것을 막는다 (모바일에서 거슬림)
  maximumScale: 1,
  // 아이폰 노치·홈바 영역까지 배경이 이어지게 한다
  viewportFit: "cover",
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
