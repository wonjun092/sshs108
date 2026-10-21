import { redirect } from "next/navigation";
import { activeBaepoUser } from "@/lib/baepo-server";
import { BaepoError } from "@/lib/baepo-policy";
import { LegacyShell } from "@/components/LegacyShell";
import { BaepoClient } from "@/components/BaepoClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await activeBaepoUser().catch(error => {
    if (error instanceof BaepoError) redirect("/login");
    throw error;
  });
  return <LegacyShell user={user.loginId} role={user.role} title="HTML 페이지 업로드">
    <BaepoClient admin={user.role === "admin"} />
  </LegacyShell>;
}
