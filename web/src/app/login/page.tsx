import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage() {
  if (await getSession()) redirect("/notice");
  return <><header className="header login-header"><strong>SSHS108</strong><span>v0.0.1</span></header><div className="login-container"><div className="login-box"><h2>로그인</h2><AuthForm mode="login" /></div></div></>;
}
