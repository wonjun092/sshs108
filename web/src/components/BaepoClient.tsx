"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Entry = { _id: string; filename: string; size: number; revision: string; updatedAt: string };

export function BaepoClient({ admin }: { admin: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async (after?: string) => {
    try {
      const response = await fetch(`/api/baepo${after ? `?after=${encodeURIComponent(after)}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEntries(previous => after ? [...previous, ...data.entries] : data.entries);
      setNext(data.next);
    } catch (error) { setError(error instanceof Error ? error.message : "목록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch(editing ? `/api/baepo/${editing._id}` : "/api/baepo", {
        method: editing ? "PUT" : "POST",
        headers: editing ? { "If-Match": editing.revision } : undefined,
        body: new FormData(event.currentTarget),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(editing ? "HTML 파일을 교체했습니다." : `페이지를 등록했습니다: ${data.url}`);
      setEditing(null); formRef.current?.reset(); await load();
    } catch (error) { setError(error instanceof Error ? error.message : "업로드하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function remove(entry: Entry) {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/baepo/${entry._id}`, { method: "DELETE", headers: { "If-Match": entry.revision } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`/${entry._id} 페이지를 삭제했습니다.`);
      if (editing?._id === entry._id) { setEditing(null); formRef.current?.reset(); }
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : "삭제하지 못했습니다."); }
    finally { setBusy(false); setDeleting(null); }
  }

  return <div className="baepo-manager">
    <section className="baepo-card">
      <h1>HTML 파일로 페이지 만들기</h1>
      <p>승인된 계정으로 단일 HTML 파일을 올리면 <strong>/{"원하는-경로"}</strong>에서 누구나 볼 수 있습니다.</p>
      <p>UTF-8 형식의 .html 또는 .htm 파일, 최대 1MB입니다. CSS·JavaScript·이미지는 파일 안에 포함해주세요.
        외부 파일·통신, 로그인 정보·저장소 접근, 팝업·상위 페이지 이동은 지원하지 않습니다. 개인정보나 비밀키는 넣지 마세요.</p>
      <form ref={formRef} onSubmit={upload}>
        <fieldset disabled={busy}>
          <legend>{editing ? `/${editing._id} 파일 교체` : "새 페이지 등록"}</legend>
          {!editing && <label>페이지 경로
            <input name="slug" required pattern="[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?" maxLength={48}
              placeholder="example" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="baepo-slug-help" />
          </label>}
          <p id="baepo-slug-help">소문자 영문·숫자·하이픈, 1~48자. 기존 페이지와 이미 등록된 경로는 사용할 수 없습니다.</p>
          <label>HTML 파일<input type="file" name="file" accept=".html,.htm,text/html" required /></label>
          <div className="baepo-actions">
            <button type="submit">{busy ? "처리 중…" : editing ? "파일 교체" : "업로드"}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); formRef.current?.reset(); }}>교체 취소</button>}
          </div>
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="baepo-error">{error}</p>}
    </section>
    <section className="baepo-card" aria-busy={loading}>
      <div className="baepo-actions"><h2>{admin ? "전체 업로드 관리" : "내 업로드"}</h2>
        <button disabled={loading || busy} onClick={() => { setLoading(true); setError(""); setEditing(null); setDeleting(null); void load(); }}>새로고침</button></div>
      <p>{admin ? "관리자는 모든 페이지를 수정하거나 삭제할 수 있습니다." : "내가 올린 페이지를 수정하거나 삭제할 수 있습니다."} 파일을 교체해도 주소는 유지됩니다.</p>
      {!loading && !entries.length && <p>아직 등록한 페이지가 없습니다.</p>}
      <ul className="baepo-list">{entries.map(entry => <li key={entry._id}>
        <div><a href={`/${entry._id}`} target="_blank" rel="noreferrer">/{entry._id} ↗</a>
          <p>{entry.filename} · {(entry.size / 1024).toFixed(1)}KB · {new Date(entry.updatedAt).toLocaleString("ko-KR")}</p></div>
        <div className="baepo-actions">
          <button disabled={busy} onClick={() => { setEditing(entry); setDeleting(null); setError(""); setMessage(""); formRef.current?.reset(); formRef.current?.scrollIntoView({ behavior: "smooth" }); }}>파일 교체</button>
          <button disabled={busy} onClick={() => setDeleting(entry)}>삭제</button>
        </div>
        {deleting?._id === entry._id && <div className="baepo-confirm" role="group" aria-label="삭제 확인">
          <p>/{entry._id}을 삭제하면 복구할 수 없으며 다른 사람이 이 경로를 사용할 수 있습니다.</p>
          <button disabled={busy} onClick={() => void remove(entry)}>삭제 확인</button>{" "}
          <button disabled={busy} onClick={() => setDeleting(null)}>취소</button>
        </div>}
      </li>)}</ul>
      {loading && <p role="status">목록을 불러오는 중…</p>}
      {next && <button disabled={loading || busy} onClick={() => { setLoading(true); void load(next); }}>더 보기</button>}
    </section>
  </div>;
}
