import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LegacyShell } from "@/components/LegacyShell";
import { AdminClient } from "@/components/AdminClient";
export default async function Page() { const session = await getSession(); if (!session) redirect("/login"); if (session.role !== "admin") redirect("/notice"); return <LegacyShell user={session.loginId} role={session.role} title="회원가입 신청"><AdminClient /></LegacyShell>; }
