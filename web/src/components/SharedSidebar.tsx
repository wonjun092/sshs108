"use client";

import Link from "next/link";
import { useState } from "react";

export function SharedSidebar({
  role,
  triggerClassName = "hamburger",
}: {
  role: "admin" | "teacher" | "student";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [boardsOpen, setBoardsOpen] = useState(true);
  const [lostOpen, setLostOpen] = useState(false);
  const [quizzesOpen, setQuizzesOpen] = useState(false);

  return (
    <>
      <button className={triggerClassName} onClick={() => setOpen(true)} aria-label="메뉴 열기">&#9776;</button>
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
        <button className={`dropdown-btn ${quizzesOpen ? "active" : ""}`} onClick={() => setQuizzesOpen(!quizzesOpen)}>
          🧠 퀴즈 <span>▼</span>
        </button>
        {quizzesOpen && <div className="dropdown-container visible">
          <Link href="/quiz">🧪 주기율표 퀴즈</Link>
          <Link href="/quiz/aminoacid">🧬 아미노산 퀴즈</Link>
          <Link href="/quiz/hormone">🧠 호르몬 퀴즈</Link>
        </div>}
        <hr />
        <Link className="outing-link" href="/outing">📍 이석 현황/신청</Link>
        <Link href="/continuous_outing">🔄 연속 이석 신청</Link>
        <Link className="google-link" href="/google_login">🔑 학교 Google 로그인</Link>
      </aside>
    </>
  );
}
