import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <section className="narrow-page">
      <h1>로그인</h1>
      <AuthForm mode="login" />
      <p>계정이 없다면 <Link href="/signup">가입 신청</Link>을 해주세요.</p>
    </section>
  );
}
