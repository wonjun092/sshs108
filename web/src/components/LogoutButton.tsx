"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return <button className="header-link-button" onClick={logout}>로그아웃</button>;
}
