"use client";

import { FormEvent, useState } from "react";
import { OUTING_LOCATIONS } from "@/lib/outing";

export function ContinuousOutingClient() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/reservations/continuous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        Object.fromEntries(new FormData(event.currentTarget).entries()),
      ),
    });
    const result = (await response.json()) as {
      added?: number;
      error?: string;
    };
    setPending(false);
    if (!response.ok) return setError(result.error ?? "예약하지 못했습니다.");
    alert(`총 ${result.added ?? 0}일의 월~목 예약이 완료되었습니다.`);
    window.location.href = "/outing";
  }
  return (
    <>
      <div className="card info-box">
        <h3>연속 이석 신청 안내</h3>
        <p>
          선택한 기간 중 월요일부터 목요일까지 예약합니다. 기숙사는 홀수 번호
          학생은 짝수 날짜, 짝수 번호 학생은 홀수 날짜에만 신청됩니다.
        </p>
      </div>
      <div className="card apply-card">
        <form className="outing-form" onSubmit={submit}>
          <label>
            시작일
            <input type="date" name="startDate" required />
          </label>
          <label>
            종료일
            <input type="date" name="endDate" required />
          </label>
          <input name="studentId" placeholder="학번 (예: 1801)" required />
          <input name="name" placeholder="이름 입력" required />
          <select name="period">
            <option value="1교시">1교시 (19:00~20:50)</option>
            <option value="2교시">2교시 (21:30~23:00)</option>
          </select>
          <select name="location" defaultValue="" required>
            <option value="" disabled>
              신청 장소 선택
            </option>
            {OUTING_LOCATIONS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          {error && <p className="error-message">{error}</p>}
          <button disabled={pending}>
            {pending ? "처리 중..." : "연속 신청"}
          </button>
        </form>
      </div>
    </>
  );
}
