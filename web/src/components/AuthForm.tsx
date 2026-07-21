"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) return setError(result.error ?? "요청을 처리하지 못했습니다.");
    if (mode === "signup") {
      alert("가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
      router.push("/login");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <label>아이디<input name="loginId" required /></label>
      <label>비밀번호<input name="password" type="password" minLength={8} required /></label>
      {mode === "signup" && (
        <>
          <label>비밀번호 확인<input name="passwordConfirm" type="password" minLength={8} required /></label>
          <label>학번<input name="studentId" required /></label>
          <label>이름<input name="name" required /></label>
          <label>생년월일<input name="birthDate" placeholder="YYYY-MM-DD" required /></label>
        </>
      )}
      {error && <p className="error-message">{error}</p>}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "처리 중..." : mode === "login" ? "로그인" : "가입 신청"}
      </button>
    </form>
  );
}
