"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";

type Props = {
  user: string;
  role: "admin" | "teacher" | "student";
  title: string;
  children: React.ReactNode;
};

export function LegacyShell({ user, role, title, children }: Props) {
  const [open, setOpen] = useState(false);
  const [boardsOpen, setBoardsOpen] = useState(true);
  const [lostOpen, setLostOpen] = useState(false);
  return (
    <>
      {open && <button aria-label="메뉴 닫기" className="sidenav-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidenav ${open ? "open" : ""}`}>
        <button className="closebtn" onClick={() => setOpen(false)} aria-label="닫기">&times;</button>
        <button className={`dropdown-btn ${boardsOpen ? "active" : ""}`} onClick={() => setBoardsOpen(!boardsOpen)}>
          📁 게시판 모음 <span>▼</span>
        </button>
        {boardsOpen && <div className="dropdown-container visible">
          <Link href="/notice">📢 공지 게시판</Link>
          {role !== "teacher" && <><Link href="/free">💬 자유 게시판</Link><Link href="/anonymous">👻 익명 게시판</Link></>}
        </div>}
        <button className={`dropdown-btn ${lostOpen ? "active" : ""}`} onClick={() => setLostOpen(!lostOpen)}>
          🎒 분실물 신고하기 <span>▼</span>
        </button>
        {lostOpen && <div className="dropdown-container visible">
          <Link href="/lost/owner">주인을 찾습니다</Link>
          <Link href="/lost/item">물건을 찾습니다</Link>
        </div>}
        {role === "admin" && <Link href="/admin_dashboard">👑 회원가입 신청</Link>}
        {role !== "teacher" && <a href="https://diep.io/" target="_blank" rel="noreferrer">🔍 Diep.io</a>}
        <a href="https://sshs.app/school/food" target="_blank" rel="noreferrer">🍔 급식 및 간식</a>
        <Link href="/english">📖 영어 단어 시험</Link>
        <Link href="/quiz">🧪 주기율표 퀴즈</Link>
        <hr />
        <Link className="outing-link" href="/outing">📍 이석 현황/신청</Link>
        <Link href="/continuous_outing">🔄 연속 이석 신청</Link>
        <Link className="google-link" href="/google_login">🔑 학교 Google 로그인</Link>
      </aside>
      <header className="header">
        <div className="header-title"><button className="hamburger" onClick={() => setOpen(true)} aria-label="메뉴 열기">&#9776;</button><span>{title}</span></div>
        <div className="header-menu"><Link href="/mypage">마이페이지</Link><LogoutButton /></div>
      </header>
      <main className="container"><p className="current-user">현재 사용자: <strong>{user}</strong></p>{children}</main>
    </>
  );
}
