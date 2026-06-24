import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dietduo.app",
  appName: "DietDuo",
  webDir: "out",
  server: {
    // 모바일 앱에서 Vercel 서버를 직접 로드하여 인증·API가 그대로 동작
    url: "https://diet-duo.vercel.app",
    cleartext: false,
    // 카카오 OAuth 팝업/리다이렉트 허용
    allowNavigation: ["*.kakao.com", "kauth.kakao.com"],
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
  },
};

export default config;
