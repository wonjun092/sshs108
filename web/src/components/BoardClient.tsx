"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Post = {
  _id: string;
  title: string;
  content: string;
  authorLoginId: string;
  location?: string;
  views: number;
  createdAt: string;
  comments: unknown[];
};

export function BoardClient({ board, title }: { board: string; title: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch(`/api/posts?board=${encodeURIComponent(board)}`, { cache: "no-store" });
    const result = (await response.json()) as { posts?: Post[]; error?: string };
    setLoading(false);
    if (!response.ok) return setError(result.error ?? "게시글을 불러오지 못했습니다.");
    setPosts(result.posts ?? []);
  }, [board]);

  useEffect(() => {
    let active = true;
    fetch(`/api/posts?board=${encodeURIComponent(board)}`, { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() as { posts?: Post[]; error?: string } }))
      .then(({ response, result }) => {
        if (!active) return;
        setLoading(false);
        if (!response.ok) setError(result.error ?? "게시글을 불러오지 못했습니다.");
        else setPosts(result.posts ?? []);
      });
    return () => { active = false; };
  }, [board]);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board,
        title: data.get("title"),
        content: data.get("content"),
        location: data.get("location") || undefined,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setError(result.error ?? "게시글을 등록하지 못했습니다.");
    form.reset();
    await load();
  }

  const lostBoard = board.startsWith("lost-");
  return (
    <section>
      <div className="page-heading"><p className="eyebrow">Board</p><h1>{title}</h1></div>
      <form className="form-card post-form" onSubmit={createPost}>
        <label>제목<input name="title" maxLength={200} required /></label>
        {lostBoard && (
          <label>장소
            <select name="location" defaultValue="모름/기타">
              {['예지관', '의행관', '우암관', '융합인재관', '창의인재관', '아람관', '운동장', '모름/기타'].map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </label>
        )}
        <label>내용<textarea name="content" rows={5} maxLength={20000} required /></label>
        <button className="primary-button" type="submit">등록</button>
      </form>
      {error && <p className="error-message">{error}</p>}
      {loading ? <p>불러오는 중...</p> : (
        <div className="post-list">
          {posts.length === 0 && <p className="empty-state">아직 게시글이 없습니다.</p>}
          {posts.map((post) => (
            <article className="post-card" key={post._id}>
              <div>
                <h2>{post.title}</h2>
                <p>{post.content}</p>
                {post.location && <span className="tag">{post.location}</span>}
              </div>
              <small>{post.authorLoginId} · 조회 {post.views} · 댓글 {post.comments.length}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
