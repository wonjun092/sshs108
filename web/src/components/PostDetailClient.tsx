"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Comment = {
  _id: string;
  writer: string;
  content: string;
  createdAt: string;
  legacyTime?: string;
};
type Post = {
  _id: string;
  board: string;
  title: string;
  content: string;
  authorLoginId: string;
  location?: string;
  fileUrl?: string;
  found?: boolean;
  views: number;
  createdAt: string;
  comments: Comment[];
  canEdit?: boolean;
  canDelete?: boolean;
  canMarkFound?: boolean;
};

function boardPath(board: string) {
  return board.startsWith("lost-") ? `/lost/${board.slice(5)}` : `/${board}`;
}

export function PostDetailClient({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/posts/${id}`, { cache: "no-store" });
    const result = (await response.json()) as { post?: Post; error?: string };
    if (!response.ok)
      return setError(result.error ?? "게시글을 불러오지 못했습니다.");
    setPost(result.post ?? null);
  }, [id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function comment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`/api/posts/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: data.get("comment") }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok)
      return setError(result.error ?? "댓글을 등록하지 못했습니다.");
    form.reset();
    await load();
  }
  async function markFound() {
    const response = await fetch(`/api/posts/${id}/found`, { method: "PATCH" });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      return setError(result.error ?? "주인 찾음 처리에 실패했습니다.");
    }
    await load();
  }
  if (error) return <p className="error-message">{error}</p>;
  if (!post) return <p>불러오는 중...</p>;
  const anonymous = post.board === "anonymous";
  return (
    <>
      <div className={`card${post.found ? " lost-found" : ""}`}>
        <h2>
          {post.location && (
            <span className="lost-location-badge">{post.location}</span>
          )}
          {post.found && <span className="lost-found-badge">✓ 주인 찾음</span>}{" "}
          {post.title}
        </h2>
        <p className="notice-stats">
          {post.board !== "notice" && <>✍️ 작성자: {post.authorLoginId} | </>}
          작성일: {new Date(post.createdAt).toLocaleString("ko-KR")} | 👀
          조회수: {post.views}
        </p>
        {post.fileUrl && (
          <p>
            <a href={post.fileUrl} target="_blank" rel="noreferrer">
              첨부파일 보기
            </a>
          </p>
        )}
        <p className="post-content">{post.content}</p>
        {post.canMarkFound && (
          <button
            className="lost-found-button"
            onClick={() => void markFound()}
          >
            ✓ 주인 찾음 처리
          </button>
        )}
        {post.canEdit && <Link href={`/edit/${post._id}`}>수정</Link>}
      </div>
      <div className="card">
        <h3>댓글</h3>
        {post.comments.length ? (
          post.comments.map((item) => (
            <div className="comment-box" key={item._id}>
              <span className="comment-writer">
                {anonymous ? "익명" : item.writer}
              </span>
              <span className="comment-time">
                {item.legacyTime ??
                  new Date(item.createdAt).toLocaleString("ko-KR")}
              </span>
              <div className="comment-content">{item.content}</div>
            </div>
          ))
        ) : (
          <p>아직 댓글이 없습니다.</p>
        )}
        <form className="inline-form" onSubmit={comment}>
          <input name="comment" placeholder="댓글을 입력하세요..." required />
          <button>등록</button>
        </form>
      </div>
      <Link href={boardPath(post.board)}>
        <button>목록으로 돌아가기</button>
      </Link>
    </>
  );
}
