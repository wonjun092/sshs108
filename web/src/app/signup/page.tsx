import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return <><header className="header"><strong>SSHS108 회원가입</strong></header><div className="login-container"><div className="login-box"><h2>정보 입력</h2><AuthForm mode="signup" /><Link className="back-login" href="/login">로그인 화면으로 돌아가기</Link></div></div></>;
}
