"use client";

import { FormEvent, useEffect, useState } from "react";

type Post = { _id: string; board: string; title: string; content: string; location?: string; canEdit?: boolean };
function boardPath(board: string) { return board.startsWith("lost-") ? `/lost/${board.slice(5)}` : `/${board}`; }

export function EditPostClient({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null); const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/posts/${id}`).then(async (response) => ({ response, result: await response.json() as { post?: Post; error?: string } })).then(({ response, result }) => { if (!response.ok) setError(result.error ?? "불러오지 못했습니다."); else if (!result.post?.canEdit) setError("수정 권한이 없습니다."); else setPost(result.post); }); }, [id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/posts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: data.get("title"), content: data.get("content"), location: data.get("location") || undefined }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setError(result.error ?? "수정하지 못했습니다.");
    window.location.href = boardPath(post!.board);
  }
  if (error) return <p className="error-message">{error}</p>;
  if (!post) return <p>불러오는 중...</p>;
  return <div className="card"><form className="board-form" onSubmit={submit}><input name="title" defaultValue={post.title} required />{post.location && <input name="location" defaultValue={post.location} />}<textarea name="content" defaultValue={post.content} required /><button>수정 완료</button></form></div>;
}
