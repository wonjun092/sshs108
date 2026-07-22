import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LegacyShell } from "@/components/LegacyShell";
import { EditPostClient } from "@/components/EditPostClient";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const session = await getSession(); if (!session) redirect("/login"); return <LegacyShell user={session.loginId} role={session.role} title="게시글 수정"><EditPostClient id={(await params).id} /></LegacyShell>; }
