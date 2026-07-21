import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <section className="narrow-page">
      <h1>회원가입</h1>
      <p>가입 후 관리자 승인이 필요합니다.</p>
      <AuthForm mode="signup" />
    </section>
  );
}
