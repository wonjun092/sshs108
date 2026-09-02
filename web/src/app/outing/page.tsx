import { redirect } from "next/navigation";
import { LegacyShell } from "@/components/LegacyShell";
import { OutingClient } from "@/components/OutingClient";
import { getSession } from "@/lib/auth";
import { getGoogleSession } from "@/lib/google";

type Props = {
  searchParams: Promise<{ google_error?: string }>;
};

const googleErrors: Record<string, string> = {
  access_denied:
    "Google 계정에서 권한 요청을 취소했거나 접근이 허용되지 않았습니다.",
  invalid_state:
    "Google 로그인 확인 정보가 만료되었습니다. 다시 로그인해 주세요.",
  missing_config: "Vercel Preview 환경에 Google OAuth 환경변수가 없습니다.",
  invalid_redirect_uri: "Google OAuth 콜백 주소 설정이 올바르지 않습니다.",
  redirect_uri_mismatch:
    "Google Cloud에 등록한 승인된 리디렉션 URI와 Vercel 콜백 주소가 다릅니다.",
  invalid_grant:
    "Google 로그인 코드가 만료되었거나 이미 사용되었습니다. 다시 로그인해 주세요.",
  token_exchange_failed: "Google 로그인 토큰을 발급받지 못했습니다.",
};

export default async function Page({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const google = await getGoogleSession();
  const { google_error: googleError } = await searchParams;
  const errorMessage = googleError
    ? (googleErrors[googleError] ??
      `Google 로그인에 실패했습니다. (${googleError})`)
    : null;

  return (
    <LegacyShell
      user={session.loginId}
      role={session.role}
      title="📍 이석 현황/신청"
    >
      {google ? (
        <OutingClient />
      ) : (
        <div className="card">
          <h2>학교 Google 로그인이 필요합니다.</h2>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          <p>
            이석 현황을 읽고 신청 내용을 Google Sheets에 반영하려면 학교 계정
            권한이 필요합니다.
          </p>
          <a href="/google_login">
            <button>학교 Google 로그인</button>
          </a>
        </div>
      )}
    </LegacyShell>
  );
}
