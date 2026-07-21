import Link from "next/link";
import { getSession } from "@/lib/auth";

const services = [
  ["공지사항", "/boards/notice", "학교와 학급 공지를 확인합니다."],
  ["자유게시판", "/boards/free", "학생들이 자유롭게 의견을 나눕니다."],
  ["익명게시판", "/boards/anonymous", "작성자 정보가 화면에 노출되지 않습니다."],
  ["주인을 찾습니다", "/boards/lost-owner", "주운 물건의 주인을 찾습니다."],
  ["물건을 찾습니다", "/boards/lost-item", "잃어버린 물건을 등록합니다."],
  ["이석 신청", "/outing", "날짜와 교시별 이석 예약을 관리합니다."],
] as const;

export default async function HomePage() {
  const session = await getSession();
  return (
    <section>
      <div className="hero">
        <p className="eyebrow">Seoul Science High School</p>
        <h1>1학년 8반을 위한 하나의 공간</h1>
        <p>기존 Flask 서비스를 TypeScript, React, MongoDB 구조로 안전하게 이전하고 있습니다.</p>
        {!session && <Link className="primary-button" href="/login">로그인하여 시작하기</Link>}
      </div>
      <div className="card-grid">
        {services.map(([title, href, description]) => (
          <Link className="service-card" href={session ? href : "/login"} key={href}>
            <h2>{title}</h2>
            <p>{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
