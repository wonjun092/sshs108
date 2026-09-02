import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LegacyShell } from "@/components/LegacyShell";
import { MyPageClient } from "@/components/MyPageClient";
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <LegacyShell user={session.loginId} role={session.role} title="마이페이지">
      <MyPageClient />
    </LegacyShell>
  );
}
