import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LegacyShell } from "@/components/LegacyShell";
import { OutingClient } from "@/components/OutingClient";
import { getGoogleSession } from "@/lib/google";
export default async function Page() { const session = await getSession(); if (!session) redirect("/login"); const google = await getGoogleSession(); return <LegacyShell user={session.loginId} role={session.role} title="📍 이석 현황/신청">{google ? <OutingClient /> : <div className="card"><h2>학교 Google 로그인이 필요합니다.</h2><p>이석 현황을 읽고 신청 내용을 Google Sheets에 반영하려면 학교 계정 권한이 필요합니다.</p><a href="/google_login"><button>학교 Google 로그인</button></a></div>}</LegacyShell>; }
