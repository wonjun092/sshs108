"use client";

import { useCallback, useEffect, useState } from "react";
type PendingUser = {
  _id: string;
  loginId: string;
  name: string;
  studentId: string;
  birthDate: string;
};

export function AdminClient() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const result = (await response.json()) as {
      users?: PendingUser[];
      error?: string;
    };
    if (!response.ok) setError(result.error ?? "불러오지 못했습니다.");
    else setUsers(result.users ?? []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function decide(id: string, status: "active" | "rejected") {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      return setError(result.error ?? "처리하지 못했습니다.");
    }
    await load();
  }
  return (
    <div className="card">
      <h2>👑 가입 승인 대기 목록</h2>
      {error && <p className="error-message">{error}</p>}
      {users.length === 0 ? (
        <p>현재 승인 대기 중인 사용자가 없습니다.</p>
      ) : (
        <div className="table-wrapper">
          <table className="status-table">
            <thead>
              <tr>
                <th>아이디</th>
                <th>이름</th>
                <th>학번/교번</th>
                <th>생년월일</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.loginId}</td>
                  <td>{user.name}</td>
                  <td>{user.studentId}</td>
                  <td>{user.birthDate}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className="approve-btn"
                        onClick={() => void decide(user._id, "active")}
                      >
                        승인
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => void decide(user._id, "rejected")}
                      >
                        거절
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
