import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트.
 *
 * 이 앱은 홈 화면에 추가해 네이티브처럼 쓰는 것을 전제로 한다.
 * Capacitor 네이티브 빌드는 server.url 로 이 사이트를 그대로 띄우는
 * WebView 껍데기라 기능 차이가 없고, iOS 는 무료 계정이면 7일마다
 * 만료돼 재설치가 필요하다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DietDuo — 식단 기록",
    short_name: "DietDuo",
    description:
      "식단을 기록하면 칼로리·영양성분을 자동 계산하고, 물 섭취와 운동을 함께 관리합니다.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 안드로이드가 아이콘을 원형·둥근사각형으로 잘라낼 때 쓰는 판본
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
