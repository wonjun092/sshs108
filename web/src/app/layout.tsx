import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "설곽 1-8 전자플랫폼",
  description: "SSHS108 학급 전자플랫폼",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
