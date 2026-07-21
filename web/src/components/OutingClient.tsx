"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

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
    const result = (await response.json()) as { reservations?: Reservation[]; error?: string };
    if (!response.ok) return setError(result.error ?? "예약을 불러오지 못했습니다.");
    setItems(result.reservations ?? []);
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/reservations", { cache: "no-store" })
      .then(async (response) => ({
        response,
        result: await response.json() as { reservations?: Reservation[]; error?: string },
      }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok) setError(result.error ?? "예약을 불러오지 못했습니다.");
        else setItems(result.reservations ?? []);
      });
    return () => { active = false; };
  }, []);

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
    await load();
  }

  return (
    <section>
      <div className="page-heading"><p className="eyebrow">Reservation</p><h1>이석 신청</h1></div>
      <p className="notice-box">현재 단계에서는 MongoDB 예약 저장까지만 연결했습니다. Google Sheets 반영은 다음 단계에서 추가됩니다.</p>
      <form className="form-card outing-form" onSubmit={submit}>
        <label>날짜<input name="date" type="date" required /></label>
        <label>학번<input name="studentId" required /></label>
        <label>이름<input name="name" required /></label>
        <label>교시<select name="period"><option>1교시</option><option>2교시</option></select></label>
        <label>장소<input name="location" required /></label>
        <button className="primary-button" type="submit">예약</button>
      </form>
      {error && <p className="error-message">{error}</p>}
      <div className="post-list">
        {items.map((item) => (
          <article className="post-card" key={item._id}>
            <h2>{item.date} · {item.period}</h2>
            <p>{item.studentId} {item.name} — {item.location}</p>
            <span className="tag">{item.status}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
