import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "SSHS 108",
  description: "SSHS 108 학생 커뮤니티",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">SSHS 108</Link>
          <nav>
            {session ? (
              <>
                <Link href="/boards/notice">공지</Link>
                <Link href="/boards/free">자유</Link>
                <Link href="/boards/anonymous">익명</Link>
                <Link href="/boards/lost-owner">분실물</Link>
                <Link href="/outing">이석 신청</Link>
                <span className="user-chip">{session.loginId}</span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login">로그인</Link>
                <Link href="/signup">회원가입</Link>
              </>
            )}
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
