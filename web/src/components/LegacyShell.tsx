import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { SharedSidebar } from "@/components/SharedSidebar";

type Props = {
  user: string;
  role: "admin" | "teacher" | "student";
  title: string;
  children: React.ReactNode;
};

export function LegacyShell({ user, role, title, children }: Props) {
  return (
    <>
      <header className="header">
        <div className="header-title"><SharedSidebar role={role} /><span>{title}</span></div>
        <div className="header-menu"><Link href="/mypage">마이페이지</Link><LogoutButton /></div>
      </header>
      <main className="container"><p className="current-user">현재 사용자: <strong>{user}</strong></p>{children}</main>
    </>
  );
}
