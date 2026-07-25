"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Post = { _id: string; title: string; authorLoginId: string; location?: string; fileUrl?: string; attachmentContentType?: string; found?: boolean; views: number; createdAt: string; scheduledAt?: string; comments: unknown[]; canEdit?: boolean; canDelete?: boolean; canMarkFound?: boolean };
const locations = ["예지관", "의행관", "우암관", "융합인재관", "창의인재관", "아람관", "운동장", "모름/기타"];

export function BoardClient({ board, title, description, canWrite }: { board: string; title: string; description?: string; canWrite: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState("");
  const [thumbnailView, setThumbnailView] = useState(false);
  const lost = board.startsWith("lost-");
  const originalType = board === "lost-owner" ? "owner" : board === "lost-item" ? "item" : board;

  const load = useCallback(async () => {
    const response = await fetch(`/api/posts?board=${encodeURIComponent(board)}`, { cache: "no-store" });
    const result = await response.json() as { posts?: Post[]; error?: string };
    setLoading(false);
    if (!response.ok) return setError(result.error ?? "게시글을 불러오지 못했습니다.");
    setPosts(result.posts ?? []);
  }, [board]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!lost) return;
    setThumbnailView(window.localStorage.getItem("lost-thumbnail-view") === "true");
  }, [lost]);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    let fileUrl: string | undefined;
    const file = data.get("file");
    if (file instanceof File && file.size > 0) {
      const uploadData = new FormData(); uploadData.set("file", file);
      const uploadResponse = await fetch("/api/uploads", { method: "POST", body: uploadData });
      const uploadResult = await uploadResponse.json() as { fileUrl?: string; error?: string };
      if (!uploadResponse.ok) return setError(uploadResult.error ?? "파일을 업로드하지 못했습니다.");
      fileUrl = uploadResult.fileUrl;
    }
    const response = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      board, title: data.get("title"), content: data.get("content"), location: data.get("location") || undefined,
      fileUrl, scheduledAt: data.get("scheduledAt") ? new Date(String(data.get("scheduledAt"))).toISOString() : undefined,
    }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setError(result.error ?? "게시글을 등록하지 못했습니다.");
    form.reset(); await load();
  }

  async function remove(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (!response.ok) { const result = await response.json() as { error?: string }; return setError(result.error ?? "삭제하지 못했습니다."); }
    await load();
  }

  async function markFound(id: string) {
    const response = await fetch(`/api/posts/${id}/found`, { method: "PATCH" });
    if (!response.ok) { const result = await response.json() as { error?: string }; return setError(result.error ?? "주인 찾음 처리에 실패했습니다."); }
    await load();
  }

  function toggleThumbnailView() {
    setThumbnailView((enabled) => {
      const next = !enabled;
      window.localStorage.setItem("lost-thumbnail-view", String(next));
      return next;
    });
  }

  const filtered = location ? posts.filter((post) => post.location === location) : posts;
  return <>
    {description && <p className="lost-description">{description}</p>}
    {canWrite && <div className="card"><h2>{board === "notice" ? "공지 작성" : "새 글 올리기"}</h2><form className="board-form" onSubmit={createPost}>
      {board === "notice" && <input type="datetime-local" name="scheduledAt" required />}
      <div className={lost ? "lost-title-row" : ""}>{lost && <select name="location" defaultValue="모름/기타">{locations.map((item) => <option key={item}>{item}</option>)}</select>}<input type="text" name="title" placeholder="제목" required /></div>
      <textarea name="content" placeholder={board === "notice" ? "내용" : "자유롭게 이야기를 남겨보세요."} required />
      <input type="file" name="file" />
      <button type="submit">등록</button>
    </form></div>}
    {lost && <div className="lost-filter-bar"><button className={`lost-filter ${!location ? "active" : ""}`} onClick={() => setLocation("")}>전체</button>{locations.map((item) => <button className={`lost-filter ${location === item ? "active" : ""}`} onClick={() => setLocation(item)} key={item}>{item}</button>)}</div>}
    <h2>{title} 목록</h2>
    {lost && <button type="button" className={`thumbnail-switch ${thumbnailView ? "is-on" : ""}`} role="switch" aria-checked={thumbnailView} onClick={toggleThumbnailView}><span className="thumbnail-switch-icon" aria-hidden="true">▦</span><span>사진 썸네일</span><span className="thumbnail-switch-knob" aria-hidden="true" /></button>}
    {error && <p className="error-message">{error}</p>}
    {loading ? <p>불러오는 중...</p> : filtered.length === 0 ? <div className="card">아직 게시글이 없습니다.</div> : <div className={thumbnailView && lost ? "thumbnail-view" : ""}>{filtered.map((post) => {
      const hasImageThumbnail = Boolean(post.fileUrl && post.attachmentContentType?.startsWith("image/"));
      return <div className={`card lost-post-card${post.found ? " lost-found" : ""}${hasImageThumbnail ? " has-thumbnail" : ""}`} key={post._id}>
        {hasImageThumbnail && <div className="lost-thumbnail-frame" aria-label="게시글 첨부 사진">
          <span className="lost-thumbnail-fallback" aria-hidden="true">사진 없음</span>
          <img className="lost-thumbnail" src={post.fileUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
        </div>}
        <Link href={lost ? `/lost/${originalType}/${post._id}` : `/${originalType}/${post._id}`}><h3>{post.location && <span className="lost-location-badge">{post.location}</span>}{post.found && <span className="lost-found-badge">✓ 주인 찾음</span>} {post.title}</h3></Link>
        <div className="notice-stats">{board !== "anonymous" && board !== "notice" && <>✍ 작성자: {post.authorLoginId} | </>}👀 조회수: {post.views ?? 0} | 💬 댓글: {post.comments?.length ?? 0}</div>
        {(post.canEdit || post.canDelete || post.canMarkFound) && <div className="post-actions">{post.canMarkFound && <button className="lost-found-button" onClick={() => void markFound(post._id)}>✓ 주인 찾음 처리</button>}{post.canEdit && <Link href={`/edit/${post._id}`}>수정</Link>}{post.canDelete && <button className="danger-link" onClick={() => void remove(post._id)}>삭제</button>}</div>}
      </div>;
    })}</div>}
  </>;
}
