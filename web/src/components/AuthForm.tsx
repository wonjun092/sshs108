"use client";

import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string };
    setPending(false);
    if (!response.ok) return setError(result.error ?? "요청을 처리하지 못했습니다.");
    if (mode === "signup") {
      alert("가입 신청이 완료되었습니다! 관리자 승인 후 로그인이 가능합니다.");
      window.location.href = "/login";
    } else {
      window.location.href = "/notice";
    }
  }

  return <form className="legacy-auth-form" onSubmit={submit}>
    <input name="loginId" placeholder={mode === "signup" ? "쓰고 싶은 ID" : "아이디"} required />
    <input name="password" type="password" minLength={8} placeholder="비밀번호" required />
    {mode === "signup" && <>
      <input name="passwordConfirm" type="password" minLength={8} placeholder="비밀번호 재확인" required />
      <input name="studentId" placeholder="교번 (예: 26001)" required />
      <input name="name" placeholder="실명" required />
      <input name="birthDate" type="date" required />
    </>}
    {error && <p className="error-message">{error}</p>}
    <button type="submit" disabled={pending}>{pending ? "처리 중..." : mode === "login" ? "로그인" : "가입 신청"}</button>
    {mode === "login" && <button className="signup-button" type="button" onClick={() => { window.location.href = "/signup"; }}>회원가입</button>}
  </form>;
}
