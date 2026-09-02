import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LegacyShell } from "@/components/LegacyShell";
import { ContinuousOutingClient } from "@/components/ContinuousOutingClient";
import { getGoogleSession } from "@/lib/google";
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  const google = await getGoogleSession();
  return (
    <LegacyShell
      user={session.loginId}
      role={session.role}
      title="🔄 연속 이석 신청"
    >
      {google ? (
        <ContinuousOutingClient />
      ) : (
        <div className="card">
          <h2>학교 Google 로그인이 필요합니다.</h2>
          <a href="/google_login">
            <button>학교 Google 로그인</button>
          </a>
        </div>
      )}
    </LegacyShell>
  );
}
