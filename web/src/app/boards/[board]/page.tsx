import { notFound, redirect } from "next/navigation";
import { BoardClient } from "@/components/BoardClient";
import { getSession } from "@/lib/auth";

const titles: Record<string, string> = {
  notice: "공지사항",
  free: "자유게시판",
  anonymous: "익명게시판",
  "lost-owner": "주인을 찾습니다",
  "lost-item": "물건을 찾습니다",
};

export default async function BoardPage({ params }: { params: Promise<{ board: string }> }) {
  if (!(await getSession())) redirect("/login");
  const { board } = await params;
  const title = titles[board];
  if (!title) notFound();
  return <BoardClient board={board} title={title} />;
}
