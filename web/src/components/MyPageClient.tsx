"use client";

import { FormEvent, useState } from "react";
export function MyPageClient() {
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setMessage(""); const form = event.currentTarget; const data = new FormData(form); const response = await fetch("/api/account/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data.entries())) }); const result = await response.json() as { error?: string }; if (!response.ok) return setError(result.error ?? "변경하지 못했습니다."); form.reset(); setMessage("비밀번호가 성공적으로 변경되었습니다."); }
  return <div className="card"><h2>비밀번호 변경</h2><form className="board-form" onSubmit={submit}><input name="currentPassword" type="password" placeholder="현재 비밀번호" required /><input name="newPassword" type="password" minLength={8} placeholder="새 비밀번호" required /><input name="confirmPassword" type="password" minLength={8} placeholder="새 비밀번호 확인" required />{error && <p className="error-message">{error}</p>}{message && <p className="success-message">{message}</p>}<button>비밀번호 변경</button></form></div>;
}
