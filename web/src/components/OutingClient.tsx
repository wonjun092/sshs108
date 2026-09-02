"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { OUTING_LOCATIONS } from "@/lib/outing";
import { SheetStatus } from "@/components/SheetStatus";
type Reservation = {
  _id: string;
  date: string;
  studentId: string;
  name: string;
  period: string;
  location: string;
  status: string;
};

export function OutingClient() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/reservations", { cache: "no-store" });
    const result = (await response.json()) as {
      reservations?: Reservation[];
      error?: string;
    };
    if (!response.ok) setError(result.error ?? "예약을 불러오지 못했습니다.");
    else setItems(result.reservations ?? []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setError(result.error ?? "예약하지 못했습니다.");
    form.reset();
    alert("예약이 완료되었습니다.");
    await load();
  }
  async function cancel(id: string) {
    if (!confirm("정말 이 예약을 취소/삭제하시겠습니까?")) return;
    const response = await fetch("/api/reservations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      return setError(result.error ?? "취소하지 못했습니다.");
    }
    await load();
  }
  return (
    <>
      <div className="card apply-card">
        <h2>신청하기</h2>
        <form className="outing-form" onSubmit={submit}>
          <input type="date" name="date" required />
          <input name="studentId" placeholder="학번 (예: 1101)" required />
          <input name="name" placeholder="이름" required />
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
          <button>신청</button>
        </form>
        {error && <p className="error-message">{error}</p>}
      </div>
      <div className="card">
        <h3>📅 향후 예약 현황</h3>
        {items.length === 0 ? (
          <p>예약 내역이 없습니다.</p>
        ) : (
          items.map((item) => (
            <div className="reservation-row" key={item._id}>
              <span>
                <strong>{item.date}</strong> | {item.period} | {item.location}
              </span>
              <button
                className="reject-btn"
                onClick={() => void cancel(item._id)}
              >
                예약 취소
              </button>
            </div>
          ))
        )}
      </div>
      <SheetStatus />
    </>
  );
}
