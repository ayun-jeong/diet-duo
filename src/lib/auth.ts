import type { NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";

export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as {
          kakao_account?: { profile?: { nickname?: string; profile_image_url?: string } };
        };
        token.name = p.kakao_account?.profile?.nickname ?? token.name;
        token.picture = p.kakao_account?.profile?.profile_image_url ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub!;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
    // Capacitor 앱에서 로그인 후 앱으로 복귀 허용
    async redirect({ url, baseUrl }) {
      if (url.startsWith("capacitor://") || url.startsWith("http://localhost")) {
        return url;
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
  // SameSite=None: Capacitor 앱(다른 오리진)에서 세션 쿠키 전송 허용
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "none",
        secure: true,
        path: "/",
      },
    },
  },
};
